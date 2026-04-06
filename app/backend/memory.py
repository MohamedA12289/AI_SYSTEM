
from __future__ import annotations

from pathlib import Path
import json
from datetime import datetime, timezone

from config import (
    MEMORY_BASE_PATH,
    LEGACY_CHAT_FILENAME,
    SUMMARY_FILENAME,
    TASKS_FILENAME,
    NOTES_FILENAME,
    MEMORY_FILENAME,
)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def validate_project_name(project_name: str):
    if not project_name or not str(project_name).strip():
        raise ValueError("Project name cannot be empty.")
    invalid_parts = ["..", "/", "\\", ":"]
    if any(part in str(project_name) for part in invalid_parts):
        raise ValueError("Invalid project name.")

def get_project_path(project_name: str) -> Path:
    validate_project_name(project_name)
    return MEMORY_BASE_PATH / project_name

def _ensure_json(path: Path, default_value):
    if not path.exists():
        path.write_text(json.dumps(default_value, indent=2), encoding="utf-8")
        return
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        path.write_text(json.dumps(default_value, indent=2), encoding="utf-8")

def ensure_project_memory(project_name: str):
    project_path = get_project_path(project_name)
    project_path.mkdir(parents=True, exist_ok=True)

    legacy_chat = project_path / LEGACY_CHAT_FILENAME
    if not legacy_chat.exists():
        legacy_chat.write_text("", encoding="utf-8")

    _ensure_json(project_path / SUMMARY_FILENAME, {
        "project_name": project_name,
        "summary_text": "",
        "updated_at": None,
        "source_message_count": 0,
    })
    _ensure_json(project_path / TASKS_FILENAME, {"tasks": []})
    _ensure_json(project_path / NOTES_FILENAME, {"notes": []})
    _ensure_json(project_path / MEMORY_FILENAME, {"entries": []})

def read_legacy_chat(project_name: str) -> str:
    ensure_project_memory(project_name)
    return (get_project_path(project_name) / LEGACY_CHAT_FILENAME).read_text(encoding="utf-8")

def append_chat(project_name: str, role: str, message: str):
    ensure_project_memory(project_name)
    legacy_chat = get_project_path(project_name) / LEGACY_CHAT_FILENAME
    with legacy_chat.open("a", encoding="utf-8") as f:
        f.write(f"{str(role).upper()}: {message}\n\n")

def read_chat(project_name: str) -> str:
    return read_legacy_chat(project_name)

def _read_json(path: Path, default_value):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = default_value
        path.write_text(json.dumps(default_value, indent=2), encoding="utf-8")
    return data

def read_tasks(project_name: str) -> dict:
    ensure_project_memory(project_name)
    return _read_json(get_project_path(project_name) / TASKS_FILENAME, {"tasks": []})

def write_tasks(project_name: str, data: dict) -> dict:
    ensure_project_memory(project_name)
    path = get_project_path(project_name) / TASKS_FILENAME
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def read_notes(project_name: str) -> dict:
    ensure_project_memory(project_name)
    return _read_json(get_project_path(project_name) / NOTES_FILENAME, {"notes": []})

def write_notes(project_name: str, data: dict) -> dict:
    ensure_project_memory(project_name)
    path = get_project_path(project_name) / NOTES_FILENAME
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def read_memory_entries(project_name: str) -> dict:
    ensure_project_memory(project_name)
    return _read_json(get_project_path(project_name) / MEMORY_FILENAME, {"entries": []})

def write_memory_entries(project_name: str, data: dict) -> dict:
    ensure_project_memory(project_name)
    path = get_project_path(project_name) / MEMORY_FILENAME
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def read_summary(project_name: str) -> dict:
    ensure_project_memory(project_name)
    return _read_json(get_project_path(project_name) / SUMMARY_FILENAME, {
        "project_name": project_name,
        "summary_text": "",
        "updated_at": None,
        "source_message_count": 0,
    })

def write_summary(project_name: str, summary_text: str, source_message_count: int) -> dict:
    ensure_project_memory(project_name)
    data = {
        "project_name": project_name,
        "summary_text": str(summary_text or ""),
        "updated_at": now_iso(),
        "source_message_count": int(source_message_count),
    }
    path = get_project_path(project_name) / SUMMARY_FILENAME
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data
