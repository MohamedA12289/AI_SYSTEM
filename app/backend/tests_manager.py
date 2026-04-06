
from __future__ import annotations

from pathlib import Path
import json
from uuid import uuid4
from datetime import datetime, timezone

from config import TESTS_FILENAME
from memory import ensure_project_memory, get_project_path
from command_tools import run_safe_command

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _tests_path(project_name: str) -> Path:
    ensure_project_memory(project_name)
    return get_project_path(project_name) / TESTS_FILENAME

def _read(project_name: str) -> dict:
    path = _tests_path(project_name)
    if not path.exists():
        data = {"tests": [], "runs": []}
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {"tests": [], "runs": []}
    if not isinstance(data, dict):
        data = {"tests": [], "runs": []}
    data.setdefault("tests", [])
    data.setdefault("runs", [])
    return data

def _write(project_name: str, data: dict) -> dict:
    path = _tests_path(project_name)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def list_tests(project_name: str) -> dict:
    return _read(project_name)

def create_test(project_name: str, title: str, command: list[str], timeout_seconds: int = 30) -> dict:
    if not str(title or "").strip():
        raise ValueError("Test title cannot be empty.")
    data = _read(project_name)
    item = {
        "id": str(uuid4()),
        "title": str(title).strip(),
        "command": [str(x) for x in command],
        "timeout_seconds": int(timeout_seconds),
        "created_at": now_iso(),
    }
    data["tests"].append(item)
    _write(project_name, data)
    return item

def update_test(project_name: str, test_id: str, title: str | None = None, command: list[str] | None = None, timeout_seconds: int | None = None) -> dict:
    data = _read(project_name)
    for item in data["tests"]:
        if item.get("id") == test_id:
            if title is not None:
                item["title"] = str(title).strip() or item["title"]
            if command is not None:
                item["command"] = [str(x) for x in command]
            if timeout_seconds is not None:
                item["timeout_seconds"] = int(timeout_seconds)
            _write(project_name, data)
            return item
    raise FileNotFoundError("Test not found.")

def delete_test(project_name: str, test_id: str) -> dict:
    data = _read(project_name)
    before = len(data["tests"])
    data["tests"] = [x for x in data["tests"] if x.get("id") != test_id]
    if len(data["tests"]) == before:
        raise FileNotFoundError("Test not found.")
    _write(project_name, data)
    return {"deleted": True, "test_id": test_id}

def run_test(project_name: str, test_id: str) -> dict:
    data = _read(project_name)
    test = None
    for item in data["tests"]:
        if item.get("id") == test_id:
            test = item
            break
    if test is None:
        raise FileNotFoundError("Test not found.")

    result = run_safe_command(
        project_name=project_name,
        command=test["command"],
        timeout_seconds=test.get("timeout_seconds", 30),
    )
    run_record = {
        "id": str(uuid4()),
        "test_id": test_id,
        "title": test["title"],
        "timestamp": now_iso(),
        "result": result,
    }
    data["runs"].append(run_record)
    _write(project_name, data)
    return run_record
