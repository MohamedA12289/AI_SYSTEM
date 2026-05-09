"""Slash commands loaded from ~/.cubos/commands/*.py.

Each command file defines a `run(args: str, ctx: dict) -> dict` function.
Commands are referenced via /name in chat input.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

_COMMANDS_DIR = Path(os.path.expanduser("~/.cubos/commands"))
_BUILTIN_DIR = Path(__file__).resolve().parent / "commands_builtin"

_CACHE: Dict[str, Any] = {}
_MTIMES: Dict[str, float] = {}


def _ensure_dirs() -> None:
    _COMMANDS_DIR.mkdir(parents=True, exist_ok=True)


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(f"_slashcmd_{path.stem}", str(path))
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"load_failed: {exc}"}
    return mod


def _scan_dir(directory: Path) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not directory.exists():
        return out
    for p in directory.glob("*.py"):
        if p.name.startswith("_"):
            continue
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        key = str(p)
        if _MTIMES.get(key) != mtime:
            mod = _load_module(p)
            _CACHE[key] = mod
            _MTIMES[key] = mtime
        mod = _CACHE.get(key)
        if mod is None or isinstance(mod, dict):
            continue
        name = getattr(mod, "NAME", p.stem)
        out[name] = {
            "name": name,
            "description": getattr(mod, "DESCRIPTION", ""),
            "path": str(p),
            "module": mod,
        }
    return out


def list_commands() -> List[Dict[str, str]]:
    _ensure_dirs()
    cmds = {}
    cmds.update(_scan_dir(_BUILTIN_DIR))
    cmds.update(_scan_dir(_COMMANDS_DIR))
    return [
        {"name": v["name"], "description": v["description"], "path": v["path"]}
        for v in sorted(cmds.values(), key=lambda x: x["name"])
    ]


def run_command(name: str, args: str = "", ctx: Dict[str, Any] | None = None) -> Dict[str, Any]:
    _ensure_dirs()
    cmds = {}
    cmds.update(_scan_dir(_BUILTIN_DIR))
    cmds.update(_scan_dir(_COMMANDS_DIR))
    if name not in cmds:
        return {"ok": False, "error": f"unknown_command: {name}"}
    mod = cmds[name]["module"]
    fn = getattr(mod, "run", None)
    if not callable(fn):
        return {"ok": False, "error": "command_missing_run"}
    try:
        result = fn(args, ctx or {})
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"command_error: {exc}"}
    if isinstance(result, dict):
        result.setdefault("ok", True)
        return result
    return {"ok": True, "result": result}


def create_command(name: str, body: str, description: str = "") -> Dict[str, Any]:
    _ensure_dirs()
    safe = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
    if not safe:
        return {"ok": False, "error": "invalid_name"}
    path = _COMMANDS_DIR / f"{safe}.py"
    template = (
        f'NAME = "{safe}"\n'
        f'DESCRIPTION = {description!r}\n\n'
        "def run(args: str, ctx: dict):\n"
        f"{body}\n"
    ) if not body.lstrip().startswith("NAME") else body
    path.write_text(template, encoding="utf-8")
    return {"ok": True, "path": str(path)}


def delete_command(name: str) -> Dict[str, Any]:
    path = _COMMANDS_DIR / f"{name}.py"
    if not path.exists():
        return {"ok": False, "error": "not_found"}
    path.unlink()
    return {"ok": True}


def run_slash_op(op: str, **kwargs: Any) -> Dict[str, Any]:
    if op == "list":
        return {"ok": True, "commands": list_commands()}
    if op == "run":
        return run_command(kwargs.get("name", ""), kwargs.get("args", ""), kwargs.get("ctx"))
    if op == "create":
        return create_command(kwargs.get("name", ""), kwargs.get("body", ""), kwargs.get("description", ""))
    if op == "delete":
        return delete_command(kwargs.get("name", ""))
    return {"ok": False, "error": f"unknown_op: {op}"}
