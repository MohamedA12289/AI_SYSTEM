"""Minimal LSP client.

Spawns a language server (pylsp for Python, typescript-language-server for
JS/TS) on demand, talks JSON-RPC over stdio, and exposes high-level
operations: definition, references, diagnostics, format.

Servers are launched lazily and cached per language. Each server is
initialized once and shut down on process exit.
"""
from __future__ import annotations

import json
import os
import sys
import shutil
import subprocess
import threading
import atexit
from typing import Any, Dict, List, Optional, Tuple

from process_utils import with_hidden_subprocess

# --- language -> server command --------------------------------------------------
_PYLSP_CMD: List[str] = [sys.executable, "-m", "pylsp"]


def _ts_cmd() -> Optional[List[str]]:
    exe = shutil.which("typescript-language-server")
    if exe:
        return [exe, "--stdio"]
    # Fallback to npx if available
    npx = shutil.which("npx")
    if npx:
        return [npx, "-y", "typescript-language-server", "--stdio"]
    return None


_LANG_BY_EXT = {
    ".py": "python",
    ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescriptreact",
    ".mjs": "javascript", ".cjs": "javascript",
}


def detect_language(path: str) -> Optional[str]:
    return _LANG_BY_EXT.get(os.path.splitext(path)[1].lower())


def _server_cmd(lang: str) -> Optional[List[str]]:
    if lang == "python":
        return _PYLSP_CMD
    if lang in ("javascript", "typescript", "typescriptreact"):
        return _ts_cmd()
    return None


# --- JSON-RPC plumbing -----------------------------------------------------------
class _LspServer:
    def __init__(self, lang: str, cmd: List[str], root_uri: str):
        self.lang = lang
        self.cmd = cmd
        self.root_uri = root_uri
        self.proc: Optional[subprocess.Popen] = None
        self._id = 0
        self._lock = threading.Lock()
        self._resp: Dict[int, Any] = {}
        self._diags: Dict[str, list] = {}
        self._reader: Optional[threading.Thread] = None
        self._stopped = False
        self._initialized = False

    def start(self) -> None:
        self.proc = subprocess.Popen(
            self.cmd,
            **with_hidden_subprocess({
                "stdin": subprocess.PIPE,
                "stdout": subprocess.PIPE,
                "stderr": subprocess.DEVNULL,
                "bufsize": 0,
            }),
        )
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        self._initialize()

    def _read_loop(self) -> None:
        assert self.proc and self.proc.stdout
        out = self.proc.stdout
        try:
            while not self._stopped:
                # Read header
                length = None
                while True:
                    line = out.readline()
                    if not line:
                        return
                    if line in (b"\r\n", b"\n", b""):
                        break
                    if line.lower().startswith(b"content-length:"):
                        try:
                            length = int(line.split(b":", 1)[1].strip())
                        except Exception:
                            length = None
                if not length:
                    continue
                payload = out.read(length)
                if not payload:
                    return
                try:
                    msg = json.loads(payload.decode("utf-8", errors="replace"))
                except Exception:
                    continue
                if "id" in msg and ("result" in msg or "error" in msg):
                    self._resp[msg["id"]] = msg
                elif msg.get("method") == "textDocument/publishDiagnostics":
                    params = msg.get("params", {})
                    uri = params.get("uri", "")
                    self._diags[uri] = params.get("diagnostics", [])
        except Exception:
            return

    def _send(self, payload: dict) -> None:
        assert self.proc and self.proc.stdin
        body = json.dumps(payload).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
        with self._lock:
            self.proc.stdin.write(header + body)
            self.proc.stdin.flush()

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def request(self, method: str, params: dict, timeout: float = 8.0) -> dict:
        rid = self._next_id()
        self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        import time
        deadline = time.time() + timeout
        while time.time() < deadline:
            if rid in self._resp:
                return self._resp.pop(rid)
            time.sleep(0.02)
        raise TimeoutError(f"LSP request {method} timed out")

    def notify(self, method: str, params: dict) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def _initialize(self) -> None:
        init_params = {
            "processId": os.getpid(),
            "rootUri": self.root_uri,
            "capabilities": {
                "textDocument": {
                    "synchronization": {"didSave": True, "willSave": False, "dynamicRegistration": False},
                    "definition": {"dynamicRegistration": False},
                    "references": {"dynamicRegistration": False},
                    "publishDiagnostics": {"relatedInformation": False},
                    "formatting": {"dynamicRegistration": False},
                }
            },
            "workspaceFolders": [{"uri": self.root_uri, "name": "workspace"}],
        }
        try:
            self.request("initialize", init_params, timeout=15.0)
        except Exception:
            pass
        self.notify("initialized", {})
        self._initialized = True

    def open_doc(self, path: str, text: str, lang_id: str) -> str:
        uri = _path_to_uri(path)
        self.notify("textDocument/didOpen", {
            "textDocument": {"uri": uri, "languageId": lang_id, "version": 1, "text": text}
        })
        return uri

    def close_doc(self, uri: str) -> None:
        try:
            self.notify("textDocument/didClose", {"textDocument": {"uri": uri}})
        except Exception:
            pass

    def shutdown(self) -> None:
        self._stopped = True
        try:
            if self.proc and self.proc.poll() is None:
                try:
                    self.request("shutdown", {}, timeout=2.0)
                except Exception:
                    pass
                try:
                    self.notify("exit", {})
                except Exception:
                    pass
                try:
                    self.proc.terminate()
                except Exception:
                    pass
        except Exception:
            pass


# --- Server cache ---------------------------------------------------------------
_servers: Dict[Tuple[str, str], _LspServer] = {}
_servers_lock = threading.Lock()


def _path_to_uri(path: str) -> str:
    p = os.path.abspath(path).replace("\\", "/")
    if not p.startswith("/"):
        p = "/" + p
    return "file://" + p


def _get_server(lang: str, root: str) -> Optional[_LspServer]:
    cmd = _server_cmd(lang)
    if not cmd:
        return None
    key = (lang, os.path.abspath(root))
    with _servers_lock:
        srv = _servers.get(key)
        if srv and srv.proc and srv.proc.poll() is None:
            return srv
        try:
            srv = _LspServer(lang, cmd, _path_to_uri(root))
            srv.start()
            _servers[key] = srv
            return srv
        except Exception:
            return None


@atexit.register
def _cleanup_all() -> None:
    with _servers_lock:
        for s in list(_servers.values()):
            try:
                s.shutdown()
            except Exception:
                pass
        _servers.clear()


# --- High-level operations -------------------------------------------------------
def is_available(lang: str) -> bool:
    return _server_cmd(lang) is not None


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _do_doc_request(method: str, abs_path: str, line: int, character: int, root: Optional[str] = None) -> Any:
    lang = detect_language(abs_path)
    if not lang:
        raise ValueError(f"Unsupported file extension: {abs_path}")
    root = root or os.path.dirname(abs_path)
    srv = _get_server(lang, root)
    if not srv:
        raise RuntimeError(f"LSP server unavailable for {lang}")
    text = _read_text(abs_path)
    lang_id = {"typescriptreact": "typescriptreact"}.get(lang, lang)
    uri = srv.open_doc(abs_path, text, lang_id)
    try:
        resp = srv.request(method, {
            "textDocument": {"uri": uri},
            "position": {"line": line, "character": character},
        }, timeout=10.0)
        return resp.get("result")
    finally:
        srv.close_doc(uri)


def lsp_definition(abs_path: str, line: int, character: int, root: Optional[str] = None) -> Any:
    return _do_doc_request("textDocument/definition", abs_path, line, character, root)


def lsp_references(abs_path: str, line: int, character: int, root: Optional[str] = None) -> Any:
    return _do_doc_request("textDocument/references", abs_path, line, character, root)


def lsp_diagnostics(abs_path: str, root: Optional[str] = None, wait_seconds: float = 2.0) -> List[dict]:
    lang = detect_language(abs_path)
    if not lang:
        raise ValueError(f"Unsupported file extension: {abs_path}")
    root = root or os.path.dirname(abs_path)
    srv = _get_server(lang, root)
    if not srv:
        raise RuntimeError(f"LSP server unavailable for {lang}")
    text = _read_text(abs_path)
    lang_id = {"typescriptreact": "typescriptreact"}.get(lang, lang)
    uri = srv.open_doc(abs_path, text, lang_id)
    try:
        import time
        time.sleep(wait_seconds)
        return list(srv._diags.get(uri, []))
    finally:
        srv.close_doc(uri)


def lsp_format(abs_path: str, root: Optional[str] = None, tab_size: int = 4, insert_spaces: bool = True) -> Any:
    lang = detect_language(abs_path)
    if not lang:
        raise ValueError(f"Unsupported file extension: {abs_path}")
    root = root or os.path.dirname(abs_path)
    srv = _get_server(lang, root)
    if not srv:
        raise RuntimeError(f"LSP server unavailable for {lang}")
    text = _read_text(abs_path)
    lang_id = {"typescriptreact": "typescriptreact"}.get(lang, lang)
    uri = srv.open_doc(abs_path, text, lang_id)
    try:
        resp = srv.request("textDocument/formatting", {
            "textDocument": {"uri": uri},
            "options": {"tabSize": tab_size, "insertSpaces": insert_spaces},
        }, timeout=10.0)
        return resp.get("result")
    finally:
        srv.close_doc(uri)


def run_lsp_op(project_name: str, op: str, args: dict) -> dict:
    """Dispatcher used by agent_tools."""
    from file_tools import get_project_scope_info  # local import
    op = (op or "").strip().lower()
    rel = args.get("path") or ""
    scope = get_project_scope_info(project_name)
    root = scope.get("root") or scope.get("project_root") or os.getcwd()
    abs_path = os.path.abspath(os.path.join(root, rel)) if rel else None
    line = int(args.get("line", 0))
    character = int(args.get("character", 0))
    if op == "available":
        return {"python": is_available("python"), "typescript": is_available("typescript")}
    if not abs_path:
        raise ValueError("lsp op requires 'path'")
    if op == "definition":
        return {"result": lsp_definition(abs_path, line, character, root)}
    if op == "references":
        return {"result": lsp_references(abs_path, line, character, root)}
    if op == "diagnostics":
        return {"result": lsp_diagnostics(abs_path, root, wait_seconds=float(args.get("wait", 2.0)))}
    if op == "format":
        return {"result": lsp_format(abs_path, root)}
    raise ValueError(f"Unknown lsp op: {op!r}")
