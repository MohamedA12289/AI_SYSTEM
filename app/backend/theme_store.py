"""Theme bundles stored as JSON files in app/backend/themes/ and ~/.cubos/themes/."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

_BUILTIN_DIR = Path(__file__).resolve().parent / "themes"
_USER_DIR = Path(os.path.expanduser("~/.cubos/themes"))
_ACTIVE_FILE = Path(os.path.expanduser("~/.cubos/active_theme.json"))

_DEFAULT_THEMES: Dict[str, Dict[str, Any]] = {
    "dark": {
        "name": "dark",
        "label": "Dark",
        "colors": {
            "bg": "#0b0d10",
            "panel": "#13161a",
            "fg": "#e6e6e6",
            "muted": "#9aa0a6",
            "accent": "#4f8cff",
            "success": "#4ade80",
            "warn": "#fbbf24",
            "error": "#f87171",
            "border": "#22262c",
        },
    },
    "light": {
        "name": "light",
        "label": "Light",
        "colors": {
            "bg": "#ffffff",
            "panel": "#f5f6f8",
            "fg": "#1a1a1a",
            "muted": "#5f6368",
            "accent": "#1d6fff",
            "success": "#16a34a",
            "warn": "#d97706",
            "error": "#dc2626",
            "border": "#e1e4e8",
        },
    },
    "midnight": {
        "name": "midnight",
        "label": "Midnight",
        "colors": {
            "bg": "#06070a",
            "panel": "#0d1117",
            "fg": "#cdd9e5",
            "muted": "#768390",
            "accent": "#539bf5",
            "success": "#57ab5a",
            "warn": "#c69026",
            "error": "#e5534b",
            "border": "#1b1f24",
        },
    },
}


def _ensure_dirs() -> None:
    _BUILTIN_DIR.mkdir(parents=True, exist_ok=True)
    _USER_DIR.mkdir(parents=True, exist_ok=True)
    _ACTIVE_FILE.parent.mkdir(parents=True, exist_ok=True)
    for name, data in _DEFAULT_THEMES.items():
        p = _BUILTIN_DIR / f"{name}.json"
        if not p.exists():
            p.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _load_dir(directory: Path) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    if not directory.exists():
        return out
    for p in directory.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        name = data.get("name") or p.stem
        data["name"] = name
        data["_path"] = str(p)
        out[name] = data
    return out


def list_themes() -> List[Dict[str, Any]]:
    _ensure_dirs()
    themes: Dict[str, Dict[str, Any]] = {}
    themes.update(_load_dir(_BUILTIN_DIR))
    themes.update(_load_dir(_USER_DIR))
    return sorted(themes.values(), key=lambda t: t.get("name", ""))


def get_theme(name: str) -> Optional[Dict[str, Any]]:
    for t in list_themes():
        if t.get("name") == name:
            return t
    return None


def get_active() -> Dict[str, Any]:
    _ensure_dirs()
    if _ACTIVE_FILE.exists():
        try:
            data = json.loads(_ACTIVE_FILE.read_text(encoding="utf-8"))
            name = data.get("name", "dark")
        except Exception:
            name = "dark"
    else:
        name = "dark"
    theme = get_theme(name) or get_theme("dark") or list(_DEFAULT_THEMES.values())[0]
    return theme


def set_active(name: str) -> Dict[str, Any]:
    _ensure_dirs()
    theme = get_theme(name)
    if theme is None:
        return {"ok": False, "error": f"unknown_theme: {name}"}
    _ACTIVE_FILE.write_text(json.dumps({"name": name}), encoding="utf-8")
    return {"ok": True, "active": name, "theme": theme}


def save_theme(name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_dirs()
    safe = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip()
    if not safe:
        return {"ok": False, "error": "invalid_name"}
    payload = dict(data)
    payload["name"] = safe
    payload.setdefault("label", safe.title())
    payload.setdefault("colors", {})
    p = _USER_DIR / f"{safe}.json"
    p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {"ok": True, "path": str(p), "theme": payload}


def delete_theme(name: str) -> Dict[str, Any]:
    p = _USER_DIR / f"{name}.json"
    if not p.exists():
        return {"ok": False, "error": "not_found_or_builtin"}
    p.unlink()
    return {"ok": True}


def run_theme_op(op: str, **kwargs: Any) -> Dict[str, Any]:
    if op == "list":
        return {"ok": True, "themes": list_themes(), "active": get_active().get("name")}
    if op == "get":
        t = get_theme(kwargs.get("name", ""))
        return {"ok": t is not None, "theme": t}
    if op == "active":
        return {"ok": True, "theme": get_active()}
    if op == "set_active":
        return set_active(kwargs.get("name", ""))
    if op == "save":
        return save_theme(kwargs.get("name", ""), kwargs.get("data", {}))
    if op == "delete":
        return delete_theme(kwargs.get("name", ""))
    return {"ok": False, "error": f"unknown_op: {op}"}
