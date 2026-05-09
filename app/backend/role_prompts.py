"""
Role / agent system-prompt loader.

System prompts live in ``app/backend/prompts/roles/<role>.prompt`` and are
adapted from the gpt-pilot project. Use :func:`get_role_prompt` to retrieve
a role's text and :func:`list_roles` to enumerate the available roles.
"""

from __future__ import annotations

import pathlib
from typing import Dict, List, Optional

_ROLES_DIR = pathlib.Path(__file__).parent / "prompts" / "roles"
_CACHE: Dict[str, str] = {}


def _roles_dir() -> pathlib.Path:
    return _ROLES_DIR


def list_roles() -> List[str]:
    """Return the sorted list of available role names (file stems)."""
    if not _roles_dir().exists():
        return []
    return sorted(p.stem for p in _roles_dir().glob("*.prompt"))


def get_role_prompt(role: str) -> Optional[str]:
    """Return the system prompt text for ``role`` or ``None`` if missing."""
    role = (role or "").strip().lower()
    if not role:
        return None
    if role in _CACHE:
        return _CACHE[role]
    path = _roles_dir() / f"{role}.prompt"
    if not path.exists():
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return None
    _CACHE[role] = text
    return text


def reload_roles() -> None:
    """Drop the in-memory cache so subsequent reads pick up disk changes."""
    _CACHE.clear()
