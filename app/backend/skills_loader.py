"""Skill bundles loader.

A "skill" is a named bundle of {system_prompt, allowed_tools, default_model,
default_provider, role}. Skills are stored as YAML files in
``app/backend/skills/<name>.yaml`` and hot-reloaded on demand.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover
    yaml = None  # type: ignore

_HERE = os.path.dirname(os.path.abspath(__file__))
SKILLS_DIR = os.path.join(_HERE, "skills")
os.makedirs(SKILLS_DIR, exist_ok=True)

_cache: Dict[str, Dict[str, Any]] = {}


def _validate(skill: Dict[str, Any], path: str) -> Dict[str, Any]:
    if not isinstance(skill, dict):
        raise ValueError(f"Skill at {path} is not a YAML mapping")
    name = skill.get("name") or os.path.splitext(os.path.basename(path))[0]
    skill["name"] = str(name)
    skill.setdefault("description", "")
    skill.setdefault("role", None)
    skill.setdefault("system_prompt", "")
    skill.setdefault("provider", None)
    skill.setdefault("model", None)
    tools = skill.get("allowed_tools")
    if tools is not None and not isinstance(tools, list):
        raise ValueError(f"Skill {name}: allowed_tools must be a list")
    skill["allowed_tools"] = list(tools) if tools else []
    return skill


def _scan_dir() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    if not os.path.isdir(SKILLS_DIR) or yaml is None:
        return out
    for fn in os.listdir(SKILLS_DIR):
        if not fn.lower().endswith((".yaml", ".yml")):
            continue
        path = os.path.join(SKILLS_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            skill = _validate(data, path)
            out[skill["name"]] = skill
        except Exception as e:
            out[os.path.splitext(fn)[0]] = {
                "name": os.path.splitext(fn)[0],
                "error": str(e),
                "_path": path,
            }
    return out


def reload_skills() -> Dict[str, Dict[str, Any]]:
    global _cache
    _cache = _scan_dir()
    return _cache


def list_skills() -> List[Dict[str, Any]]:
    if not _cache:
        reload_skills()
    items = []
    for name, s in _cache.items():
        items.append({
            "name": name,
            "description": s.get("description", ""),
            "role": s.get("role"),
            "provider": s.get("provider"),
            "model": s.get("model"),
            "allowed_tools": s.get("allowed_tools", []),
            "error": s.get("error"),
        })
    items.sort(key=lambda x: x["name"])
    return items


def get_skill(name: str) -> Optional[Dict[str, Any]]:
    if not _cache:
        reload_skills()
    return _cache.get(name)


def resolve_skill(name: str) -> Dict[str, Any]:
    s = get_skill(name)
    if not s:
        raise ValueError(f"Unknown skill: {name!r}")
    if s.get("error"):
        raise ValueError(f"Skill {name} failed to load: {s['error']}")
    resolved = dict(s)
    role = s.get("role")
    if role:
        try:
            from role_prompts import get_role_prompt
            role_text = get_role_prompt(role) or ""
            base = resolved.get("system_prompt") or ""
            resolved["system_prompt"] = (role_text + ("\n\n" + base if base else "")).strip()
        except Exception:
            pass
    return resolved


def run_skill_op(project_name: str, op: str, args: dict) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if op in ("", "list"):
        return {"skills": list_skills()}
    if op == "get":
        name = args.get("name") or ""
        s = get_skill(name)
        if not s:
            raise ValueError(f"Unknown skill: {name!r}")
        return s
    if op == "resolve":
        name = args.get("name") or ""
        return resolve_skill(name)
    if op == "reload":
        reload_skills()
        return {"skills": list_skills()}
    raise ValueError(f"Unknown skill op: {op!r}")
