"""Exhaustive endpoint test harness.

Approach:
1. Spawn the real backend on a free port.
2. Fetch /openapi.json to discover EVERY route the app actually exposes.
3. For each route, fire a request with a default payload (smart defaults
   for known body shapes; empty {} otherwise). Path params get safe stubs.
4. Also exercise an explicit "frontend paths" list - the literal URLs the
   renderer calls - to catch any path mismatches the openapi sweep can't see.
5. Run the WebSocket tests.
6. Write TEST_REPORT.md with every result. Exit non-zero on required failure.
"""
from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import socket
import subprocess
import sys
import time
import wave
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

REPO = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO / "app" / "backend"
VENV_PY = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
REPORT_PATH = REPO / "TEST_REPORT.md"
FRONTEND_DIR = REPO / "app" / "frontend" / "src"

RESULTS: List[Dict[str, Any]] = []

# Path params -> sensible stubs
PARAM_STUBS: Dict[str, str] = {
    "project": "_harness",
    "project_name": "_harness",
    "name": "default",
    "id": "1",
    "task_id": "1",
    "thread_id": "1",
    "session_id": "harness",
    "role": "architect",
    "theme": "dark",
    "provider": "ollama",
    "model": "llama3.1",
    "file_path": "README.md",
    "path": "README.md",
    "command": "echo",
}

# Body templates by path keyword
def _default_body(path: str, schema: Optional[dict]) -> Optional[dict]:
    p = path.lower()
    # Try to honor the openapi requestBody schema if it's simple
    if schema:
        try:
            ref = schema.get("$ref")
            # We can't resolve refs here easily; fall through to keyword heuristics
        except Exception:
            pass
    if "voice/transcribe" in p:
        return None  # files upload, handled specially
    if "themes/active" in p:
        return {"name": "dark"}
    if "/themes" in p and "active" not in p:
        return {"name": "_harness_theme", "data": {"label": "H",
                                                    "colors": {"bg": "#000"}}}
    if "history" in p and "search" not in p:
        return {"content": "harness", "session_id": "harness", "role": "user"}
    if "projects/create" in p or path.endswith("/create"):
        return {"project_name": f"_h_{int(time.time())}",
                "input_path": str(REPO / "workspaces" / "_h")}
    if "projects/import" in p or path.endswith("/import"):
        return {"project_name": f"_h_imp_{int(time.time())}",
                "input_path": str(REPO)}
    if "clone" in p:
        return {"url": "https://github.com/octocat/Hello-World.git",
                "name": f"_h_clone_{int(time.time())}",
                "project_path": str(REPO / "workspaces" / "_h_clone")}
    if "commit" in p:
        return {"message": "harness", "project_path": str(REPO)}
    if "stage" in p or "unstage" in p:
        return {"files": ["README.md"], "project_path": str(REPO)}
    if "pull" in p or "push" in p:
        return {"project_path": str(REPO)}
    if "set-remote" in p or "remote" in p:
        return {"project_path": str(REPO), "url": "https://example.com/x.git"}
    if "/settings" in p and "provider" in p:
        return {"provider": "ollama"}
    if "/settings" in p:
        return {"key": "harness_key", "value": "harness_val"}
    if "ai/chat" in p or path.endswith("/chat"):
        return {"messages": [{"role": "user", "content": "ping"}],
                "model": "llama3.1", "stream": False}
    if "ai/complete" in p or path.endswith("/complete"):
        return {"prompt": "ping", "model": "llama3.1"}
    if "auth/pat" in p:
        return {"token": "ghp_test_invalid"}
    if "slash" in p and "run" in p:
        return {"name": "help", "args": {}}
    if "/secrets" in p:
        return {"name": "TEST_KEY", "value": "test"}
    return {}


def _fill_path(path: str) -> str:
    """Replace {param} with a stub."""
    def repl(m):
        name = m.group(1)
        return PARAM_STUBS.get(name, "test")
    import re
    return re.sub(r"\{([^/}]+)\}", repl, path)


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _wait_health(base: str, timeout: float = 30.0) -> bool:
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            r = httpx.get(base + "/", timeout=2.0)
            if r.status_code < 500:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False


def _make_wav_bytes(duration_s: float = 0.5, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b"\x00\x00" * int(sr * duration_s))
    return buf.getvalue()


def record(name: str, method: str, url: str, status: int, latency_ms: float,
           ok: bool, note: str = "", body: Any = None,
           required: bool = False, group: str = "openapi") -> None:
    excerpt = ""
    if body is not None:
        s = body if isinstance(body, str) else json.dumps(body, default=str)
        excerpt = s[:200].replace("\n", " ")
    RESULTS.append({
        "group": group,
        "name": name,
        "method": method,
        "url": url,
        "status": status,
        "latency_ms": round(latency_ms, 1),
        "ok": ok,
        "required": required,
        "note": note,
        "excerpt": excerpt,
    })


# Routes we skip from the auto-sweep because they:
#   - hang (long-running streams),
#   - mutate global state catastrophically,
#   - are upgrade/install ops we shouldn't fire unsolicited,
#   - require multipart we handle in the explicit suite.
AUTO_SKIP_SUBSTRINGS = [
    "/voice/transcribe",       # multipart - explicit suite
    "/voice/download",         # heavy download
    "/self-upgrade/apply",     # mutates app
    "/self-upgrade/install",
    "/shutdown",
    "/restart",
    "/exit",
    "/kill",
    "/ws/",                    # websockets handled separately
    "/docs",
    "/openapi.json",
    "/redoc",
    # Long-running / blocking endpoints
    "/api/ai/chat",
    "/api/ai/complete",
    "/api/ai/stream",
    "/ai/chat",
    "/ai/complete",
    "/ai/stream",
    "/agent/run",
    "/agent/stream",
    "/agent/chat",
    "/chat/stream",
    "/chat/send",
    "/ollama/generate",
    "/ollama/chat",
    "/groq/chat",
    "/groq/complete",
    "/model/pull",
    "/models/pull",
    "/files/watch",
    "/stream",
]

PER_CALL_TIMEOUT = 6.0

# Methods we attempt
ATTEMPT_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}

CODEX_DUPLICATE_ROUTE_ALLOWLIST = {
    ("POST", "/project/{project_name}/workspace/analyze"),
    ("POST", "/project/{project_name}/pair/review"),
    ("POST", "/project/{project_name}/pair/plan"),
    ("POST", "/project/{project_name}/pair/refactor-preview"),
    ("POST", "/project/{project_name}/cowork/instruction"),
    ("POST", "/projects/{project_name}/source/link"),
    ("POST", "/project/{project_name}/source/link"),
    ("POST", "/project/{project_name}/media/transcribe-file"),
    ("POST", "/project/{project_name}/voice/chat"),
    ("POST", "/project/{project_name}/research/deep-report"),
    ("POST", "/project/{project_name}/data/dashboard-summary"),
    ("POST", "/project/{project_name}/scaffold/app"),
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Codex-safe CubOS endpoint harness")
    parser.add_argument(
        "--base-path",
        default=str(REPO),
        help="CubOS runtime base path. Defaults to the current repo copy.",
    )
    parser.add_argument(
        "--report",
        default="TEST_REPORT-CODEX.md",
        help="Report path. Relative paths are resolved from the repo root.",
    )
    parser.add_argument(
        "--no-write-report",
        action="store_true",
        help="Run checks without writing a markdown report.",
    )
    parser.add_argument(
        "--preflight-only",
        action="store_true",
        help="Validate Python, imports, base-path safety, and duplicate routes only.",
    )
    parser.add_argument(
        "--strict-duplicates",
        action="store_true",
        help="Fail preflight on any unallowlisted duplicate static route.",
    )
    return parser.parse_args()


def _resolve_report_path(value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = REPO / path
    return path.resolve()


def _can_run_python(py: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            [py, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except Exception as exc:
        return False, str(exc)
    out = (result.stdout or result.stderr or "").strip()
    if result.returncode != 0:
        return False, out or f"exit {result.returncode}"
    return True, out


def _select_python() -> tuple[str, bool, str]:
    candidates: list[str] = []
    env_py = os.environ.get("CUBOS_PYTHON", "").strip()
    if env_py:
        candidates.append(env_py)
    if VENV_PY.exists():
        candidates.append(str(VENV_PY))
    candidates.append(sys.executable)

    seen: set[str] = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        ok, detail = _can_run_python(candidate)
        if ok:
            return candidate, True, detail
    fallback = candidates[0] if candidates else sys.executable
    ok, detail = _can_run_python(fallback)
    return fallback, ok, detail


def _path_under(path: Path, base: Path) -> bool:
    try:
        path.resolve().relative_to(base.resolve())
        return True
    except Exception:
        return False


def _legacy_base_for(base_path: Path) -> Optional[Path]:
    name = base_path.name
    if name.endswith(" - Codex"):
        return base_path.with_name(name[:-len(" - Codex")])
    if name.endswith("-Codex"):
        return base_path.with_name(name[:-len("-Codex")])
    return None


def _registry_path_safety(base_path: Path) -> tuple[bool, list[str]]:
    messages: list[str] = []
    registry_path = base_path / "configs" / "projects_registry.json"
    if not registry_path.exists():
        return True, [f"registry not present yet: {registry_path}"]

    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, [f"could not read registry: {exc}"]

    legacy_base = _legacy_base_for(base_path)
    problems: list[str] = []
    for item in data.get("projects", []):
        if not isinstance(item, dict):
            continue
        name = item.get("project_name", "(unknown)")
        for key in ("workspace_root", "memory_root", "scope_root", "linked_source"):
            value = item.get(key)
            if not isinstance(value, str) or not value:
                continue
            value_path = Path(value)
            if legacy_base and _path_under(value_path, legacy_base):
                problems.append(f"{name}.{key} points at legacy base: {value}")
    if problems:
        return False, problems
    messages.append(f"registry path safety ok: {registry_path}")
    return True, messages


def _static_duplicate_routes() -> dict[tuple[str, str], list[str]]:
    import re
    route_re = re.compile(r"@(app|router)\.(get|post|put|patch|delete|websocket)\(\s*['\"]([^'\"]+)['\"]")
    prefix_re = re.compile(r"router\s*=\s*APIRouter\(\s*prefix\s*=\s*['\"]([^'\"]+)['\"]")
    routes: dict[tuple[str, str], list[str]] = {}
    for path in BACKEND_DIR.rglob("*.py"):
        rel_parts = {part.lower() for part in path.relative_to(BACKEND_DIR).parts}
        if {"venv", "build", "dist", "__pycache__"} & rel_parts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        prefix_match = prefix_re.search(text)
        router_prefix = prefix_match.group(1) if prefix_match else ""
        for line, raw_line in enumerate(text.splitlines(), 1):
            stripped = raw_line.lstrip()
            if not stripped.startswith("@"):
                continue
            match = route_re.match(stripped)
            if not match:
                continue
            target, method, raw_route = match.groups()
            full_route = raw_route
            if target == "router" and router_prefix:
                full_route = router_prefix.rstrip("/") + "/" + raw_route.lstrip("/")
            key = (method.upper(), full_route)
            routes.setdefault(key, []).append(f"{path.relative_to(REPO)}:{line}")
    return {
        key: locations
        for key, locations in routes.items()
        if len(locations) > 1 and key not in CODEX_DUPLICATE_ROUTE_ALLOWLIST
    }


def _run_preflight(args: argparse.Namespace) -> bool:
    base_path = Path(args.base_path).resolve()
    print("=== Codex preflight ===")
    print(f"repo: {REPO}")
    print(f"base path: {base_path}")

    ok = True
    if not base_path.exists():
        print(f"[FAIL] base path does not exist: {base_path}")
        ok = False

    py, py_ok, py_detail = _select_python()
    print(f"python: {py} ({py_detail})")
    if not py_ok:
        print("[FAIL] no runnable Python found. Repair or rebuild the backend venv before full tests.")
        ok = False
    else:
        env = os.environ.copy()
        env["CUBOS_BASE_PATH"] = str(base_path)
        imports = subprocess.run(
            [py, "-c", "import fastapi, uvicorn, httpx; print('backend imports ok')"],
            cwd=str(BACKEND_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if imports.returncode != 0:
            print("[FAIL] backend dependency import check failed")
            print((imports.stdout or "")[-1000:])
            print((imports.stderr or "")[-1000:])
            ok = False
        else:
            print("[PASS] backend dependency imports ok")

    registry_ok, registry_messages = _registry_path_safety(base_path)
    for message in registry_messages:
        print(("[PASS] " if registry_ok else "[FAIL] ") + message)
    ok = ok and registry_ok

    duplicate_routes = _static_duplicate_routes()
    if duplicate_routes:
        print("[WARN] unallowlisted duplicate static routes found:")
        for (method, path), locations in sorted(duplicate_routes.items()):
            print(f"  {method} {path}: {', '.join(locations)}")
        if args.strict_duplicates:
            ok = False
    else:
        print("[PASS] no unallowlisted duplicate static routes")

    print("[PASS] preflight complete" if ok else "[FAIL] preflight failed")
    return ok


async def _do_request(c: httpx.AsyncClient, method: str, path: str,
                      body: Optional[dict]) -> httpx.Response:
    """One request, hard-capped by asyncio.wait_for so a hung backend
    can't poison the whole client."""
    async def go():
        if method == "GET":
            return await c.get(path, timeout=PER_CALL_TIMEOUT)
        if method == "DELETE":
            return await c.delete(path, timeout=PER_CALL_TIMEOUT)
        kwargs = {"json": body} if body is not None else {}
        return await c.request(method, path, timeout=PER_CALL_TIMEOUT, **kwargs)
    return await asyncio.wait_for(go(), timeout=PER_CALL_TIMEOUT + 2)


async def hit_openapi_route(c: httpx.AsyncClient, method: str, raw_path: str,
                            op: dict) -> None:
    """Fire a request at a discovered route with sensible defaults."""
    path = _fill_path(raw_path)
    t0 = time.time()
    try:
        body = _default_body(raw_path, None) if method in ("POST", "PUT", "PATCH") else None
        r = await _do_request(c, method, path, body)
        latency = (time.time() - t0) * 1000
        ok = r.status_code < 500
        try:
            body_out: Any = r.json()
        except Exception:
            body_out = r.text[:200]
        record(f"auto:{method} {raw_path}", method, path, r.status_code,
               latency, ok,
               note=("" if ok else "5xx server error"),
               body=body_out, required=False, group="openapi_sweep")
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {method:6} {raw_path:55} {r.status_code:>4} {latency:>5.0f}ms", flush=True)
    except (asyncio.TimeoutError, Exception) as e:
        latency = (time.time() - t0) * 1000
        record(f"auto:{method} {raw_path}", method, path, 0, latency, False,
               note=("timeout" if isinstance(e, asyncio.TimeoutError) else str(e))[:180],
               required=False, group="openapi_sweep")
        msg = "timeout" if isinstance(e, asyncio.TimeoutError) else str(e)[:60]
        print(f"  [FAIL] {method:6} {raw_path:55}  ERR {latency:>5.0f}ms  {msg}", flush=True)


async def scan_frontend_paths() -> List[Tuple[str, str, str]]:
    """Re-scan frontend for fetch() / apiClient calls. Return (method, path, source)."""
    import re
    pats = [
        re.compile(r'fetch\(\s*[`\'"]([^`\'"]+)[`\'"]'),
        re.compile(r'(?:apiClient|api|backend)\.(?:get|post|put|delete|patch)\(\s*[`\'"]([^`\'"]+)[`\'"]'),
        re.compile(r'axios\.(?:get|post|put|delete|patch)\(\s*[`\'"]([^`\'"]+)[`\'"]'),
    ]
    api_base_pat = re.compile(r'\$\{[^}]*[Aa]pi[Bb]ase[^}]*\}|\$\{[^}]*BASE[^}]*\}|\$\{[^}]+\}')
    out: List[Tuple[str, str, str]] = []
    if not FRONTEND_DIR.exists():
        return out
    for dp, _, fns in os.walk(FRONTEND_DIR):
        if any(x in dp for x in ("node_modules", "dist", "build")):
            continue
        for fn in fns:
            if not fn.endswith((".ts", ".tsx", ".js", ".jsx")):
                continue
            p = Path(dp) / fn
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for pat in pats:
                for m in pat.finditer(text):
                    raw = m.group(1)
                    # Drop scheme+host
                    s = re.sub(r'^https?://[^/]+', '', raw)
                    s = re.sub(r'^wss?://[^/]+', '', s)
                    s = api_base_pat.sub('', s, count=1)
                    if not s.startswith('/'):
                        continue
                    s = s.split('?', 1)[0]
                    # Replace ${var} segments with stubs
                    s = re.sub(r'\$\{[^}]+\}', 'test', s)
                    ctx = text[max(0, m.start() - 30): m.start() + 80]
                    method = "GET"
                    for kw, mtd in [
                        ("method: 'POST'", "POST"), ('method: "POST"', "POST"),
                        ("method: 'PUT'", "PUT"), ("method: 'DELETE'", "DELETE"),
                        ("method: 'PATCH'", "PATCH"),
                        (".post(", "POST"), (".put(", "PUT"),
                        (".delete(", "DELETE"), (".patch(", "PATCH"),
                    ]:
                        if kw in ctx:
                            method = mtd
                            break
                    out.append((method, s, str(p.relative_to(REPO))))
    # Dedupe
    seen = set()
    uniq = []
    for m, p, s in out:
        k = (m, p)
        if k in seen:
            continue
        seen.add(k)
        uniq.append((m, p, s))
    return uniq


async def hit_frontend_paths(c: httpx.AsyncClient, base: str) -> None:
    """For every literal path the frontend calls, fire a real request via the
    shared (already-warm) client and record whether the backend actually
    serves it. Each call is hard-capped by asyncio.wait_for so a hung route
    cannot freeze the suite."""
    paths = await scan_frontend_paths()
    print(f"\n=== Frontend-call sweep ({len(paths)} unique paths) ===", flush=True)
    for method, path, src in sorted(paths, key=lambda x: x[1]):
        if any(s in path for s in AUTO_SKIP_SUBSTRINGS):
            print(f"  [skip] {method:6} {path}", flush=True)
            continue
        t0 = time.time()
        try:
            body = _default_body(path, None) if method in ("POST", "PUT", "PATCH") else None
            r = await _do_request(c, method, path, body)
            latency = (time.time() - t0) * 1000
            status = r.status_code
            is_404 = status == 404
            is_5xx = status >= 500
            ok = (not is_404) and (not is_5xx)
            try:
                body_out: Any = r.json()
            except Exception:
                body_out = r.text[:200]
            note = ""
            if is_404:
                note = f"FRONTEND CALLS THIS, BACKEND HAS NO ROUTE ({src})"
            elif is_5xx:
                note = f"server error ({src})"
            record(f"fe:{method} {path}", method, path, status,
                   latency, ok, note=note[:180], body=body_out,
                   required=is_404, group="frontend_sweep")
            flag = "PASS" if ok else ("404 " if is_404 else "FAIL")
            print(f"  [{flag}] {method:6} {path:55} {status:>4} {latency:>5.0f}ms", flush=True)
        except asyncio.TimeoutError:
            latency = (time.time() - t0) * 1000
            record(f"fe:{method} {path}", method, path, 0, latency, False,
                   note=f"timeout >{PER_CALL_TIMEOUT}s ({src})"[:180],
                   required=True, group="frontend_sweep")
            print(f"  [TIME] {method:6} {path:55}  ERR {latency:>5.0f}ms  timeout", flush=True)
        except Exception as e:
            latency = (time.time() - t0) * 1000
            record(f"fe:{method} {path}", method, path, 0, latency, False,
                   note=f"{type(e).__name__}: {str(e)[:120]} ({src})",
                   required=True, group="frontend_sweep")
            print(f"  [FAIL] {method:6} {path:55}  ERR {latency:>5.0f}ms  {type(e).__name__}", flush=True)


async def run_explicit(c: httpx.AsyncClient) -> None:
    """The original named-suite checks - keep them as a quick sanity layer."""
    print("\n=== Core / Health ===")
    for path in ["/", "/projects", "/settings", "/models",
                 "/settings/providers", "/settings/provider"]:
        t0 = time.time()
        try:
            r = await c.get(path)
            ok = r.status_code < 500
            record(f"core:{path}", "GET", path, r.status_code,
                   (time.time()-t0)*1000, ok,
                   body=r.text[:200], required=True, group="core")
        except Exception as e:
            record(f"core:{path}", "GET", path, 0, (time.time()-t0)*1000,
                   False, note=str(e)[:180], required=True, group="core")


async def ws_terminal_test(base: str) -> None:
    import websockets
    proj = "_harness"
    ws_url = base.replace("http://", "ws://") + f"/ws/terminal/{proj}"
    t0 = time.time()
    try:
        async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:
            # Wait for any banner / prompt
            await asyncio.sleep(0.5)
            try:
                while True:
                    await asyncio.wait_for(ws.recv(), timeout=0.5)
            except asyncio.TimeoutError:
                pass
            await ws.send(json.dumps({"type": "input", "data": "echo hi\r\n"}))
            got = ""
            try:
                for _ in range(20):
                    msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    got += str(msg)
                    if "hi" in got and ("\n" in got or "\r" in got):
                        break
            except asyncio.TimeoutError:
                pass
            ok = "hi" in got
            record("ws_terminal_echo", "WS", ws_url, 200 if ok else 0,
                   (time.time()-t0)*1000, ok,
                   note="echo roundtrip" if ok else f"no 'hi' in {got[:120]!r}",
                   required=True, group="websocket")
    except Exception as e:
        record("ws_terminal_connect", "WS", ws_url, 0,
               (time.time()-t0)*1000, False, note=str(e)[:200],
               required=True, group="websocket")


async def ws_voice_test(base: str) -> None:
    import websockets
    ws_url = base.replace("http://", "ws://") + "/ws/voice"
    t0 = time.time()
    try:
        async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:
            await ws.send(_make_wav_bytes())
            await ws.send("__end__")
            got = None
            try:
                got = await asyncio.wait_for(ws.recv(), timeout=20)
            except asyncio.TimeoutError:
                got = None
            ok = got is not None
            record("ws_voice", "WS", ws_url, 200 if ok else 0,
                   (time.time()-t0)*1000, ok,
                   note="received response" if ok else "no response",
                   required=False, group="websocket")
    except Exception as e:
        record("ws_voice_connect", "WS", ws_url, 0,
               (time.time()-t0)*1000, False, note=str(e)[:200],
               required=False, group="websocket")


async def voice_transcribe_explicit(c: httpx.AsyncClient) -> None:
    print("\n=== Voice transcribe (multipart) ===")
    wav = _make_wav_bytes()
    t0 = time.time()
    try:
        r = await c.post("/voice/transcribe",
                         files={"file": ("test.wav", wav, "audio/wav")})
        ok = r.status_code < 500
        try:
            body = r.json()
        except Exception:
            body = r.text[:200]
        record("voice_transcribe_wav", "POST", "/voice/transcribe",
               r.status_code, (time.time()-t0)*1000, ok,
               note=("" if ok else "5xx"), body=body,
               required=False, group="voice")
    except Exception as e:
        record("voice_transcribe_wav", "POST", "/voice/transcribe", 0,
               (time.time()-t0)*1000, False, note=str(e)[:180],
               required=False, group="voice")


async def run_suite(base: str) -> None:
    headers = {"X-CubOS-Test": "1"}
    async with httpx.AsyncClient(base_url=base, headers=headers,
                                  timeout=15.0) as c:
        await run_explicit(c)

        # Run frontend-call sweep FIRST while the client is fresh and the
        # backend event loop isn't yet bogged down by whisper init from the
        # /voice/* sweep. This prevents false-positive timeouts.
        await hit_frontend_paths(c, base)

        # Fetch openapi
        print("\n=== OpenAPI discovery ===")
        try:
            spec = (await c.get("/openapi.json", timeout=10)).json()
        except Exception as e:
            print(f"  ERROR: couldn't fetch /openapi.json: {e}")
            spec = {"paths": {}}

        paths = spec.get("paths", {})
        n_routes = sum(1 for _ in paths for _m in paths[_])
        print(f"  discovered {n_routes} (method, path) pairs")

        printed_groups = set()
        for path, methods in sorted(paths.items()):
            if any(s in path for s in AUTO_SKIP_SUBSTRINGS):
                continue
            for method, op in methods.items():
                method_u = method.upper()
                if method_u not in ATTEMPT_METHODS:
                    continue
                group = path.split("/")[1] if "/" in path[1:] else "root"
                if group not in printed_groups:
                    print(f"\n--- sweep group: /{group}/* ---")
                    printed_groups.add(group)
                await hit_openapi_route(c, method_u, path, op)

        await voice_transcribe_explicit(c)

        print("\n=== WebSocket: /ws/terminal ===")
        await ws_terminal_test(base)
        print("\n=== WebSocket: /ws/voice ===")
        await ws_voice_test(base)


def write_report() -> None:
    by_group: Dict[str, List[Dict[str, Any]]] = {}
    for r in RESULTS:
        by_group.setdefault(r["group"], []).append(r)

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    failed = total - passed
    required_failed = sum(1 for r in RESULTS if not r["ok"] and r["required"])

    lines = [
        "# CubOS Codex Test Report",
        "",
        f"Generated: {datetime.now().isoformat()}",
        "",
        f"**Total checks:** {total}  ·  **Passed:** {passed}  ·  "
        f"**Failed:** {failed}  ·  **Required-failed:** {required_failed}",
        "",
        "## Summary by group",
        "",
        "| Group | Total | Pass | Fail | Required-fail |",
        "|---|---|---|---|---|",
    ]
    for g in sorted(by_group):
        items = by_group[g]
        p = sum(1 for r in items if r["ok"])
        f = len(items) - p
        rf = sum(1 for r in items if not r["ok"] and r["required"])
        lines.append(f"| {g} | {len(items)} | {p} | {f} | {rf} |")

    for g in sorted(by_group):
        items = by_group[g]
        lines += ["", f"## Group: {g}", "",
                  "| # | Method | URL | Status | ms | OK | Required | Note |",
                  "|---|---|---|---|---|---|---|---|"]
        for i, r in enumerate(items, 1):
            ok_s = "PASS" if r["ok"] else "FAIL"
            req_s = "yes" if r["required"] else "no"
            url = r["url"].replace("|", "\\|")
            note = (r["note"] or "").replace("|", "\\|").replace("\n", " ")
            lines.append(
                f"| {i} | {r['method']} | `{url}` | {r['status']} | "
                f"{r['latency_ms']} | {ok_s} | {req_s} | {note} |")

    lines += ["", "## Failures", ""]
    for r in RESULTS:
        if r["ok"]:
            continue
        lines += [
            f"### [{r['group']}] {r['method']} {r['url']}",
            f"- status: `{r['status']}` · latency: `{r['latency_ms']}ms` · "
            f"required: `{r['required']}`",
            f"- note: {r['note']}",
            f"- body: `{r['excerpt']}`",
            "",
        ]

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {REPORT_PATH}")


def main() -> int:
    args = _parse_args()
    global REPORT_PATH
    REPORT_PATH = _resolve_report_path(args.report)

    if args.preflight_only:
        return 0 if _run_preflight(args) else 2
    if not _run_preflight(args):
        return 2

    port = _free_port()
    base = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["CUBOS_PORT"] = str(port)
    env["CUBOS_BASE_PATH"] = str(Path(args.base_path).resolve())

    py, py_ok, py_detail = _select_python()
    if not py_ok:
        print(f"No runnable Python found for backend: {py_detail}")
        return 2
    cmd = [py, "-m", "uvicorn", "main:app", "--host", "127.0.0.1",
           "--port", str(port), "--log-level", "warning"]
    print(f"Spawning backend: {' '.join(cmd)} (cwd={BACKEND_DIR})")
    proc = subprocess.Popen(
        cmd, cwd=str(BACKEND_DIR), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    try:
        if not _wait_health(base):
            print("Backend failed to become healthy within 30s")
            try:
                err = proc.stderr.read().decode("utf-8", errors="ignore")[-2000:]
                print("stderr tail:\n" + err)
            except Exception:
                pass
            return 2
        print(f"Backend up at {base}\n")
        asyncio.run(run_suite(base))
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    if args.no_write_report:
        print("\nSkipped report write because --no-write-report was set.")
    else:
        write_report()
    required_failed = sum(1 for r in RESULTS if not r["ok"] and r["required"])
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\nDone. Total {total} · Passed {passed} · "
          f"Required-failed {required_failed}")
    return 0 if required_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
