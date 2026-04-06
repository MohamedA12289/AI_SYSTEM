
from __future__ import annotations

from pathlib import Path
import json
from uuid import uuid4
from datetime import datetime, timezone

from config import ACTIVITY_FILENAME, GLOBAL_ACTIVITY_PATH
from memory import ensure_project_memory, get_project_path

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _project_activity_path(project_name: str) -> Path:
    ensure_project_memory(project_name)
    return get_project_path(project_name) / ACTIVITY_FILENAME

def _append_jsonl(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")

def log_activity(project_name: str, action: str, detail: str = "", type: str = "activity", metadata: dict | None = None) -> dict:
    entry = {
        "id": str(uuid4()),
        "project_name": project_name,
        "action": str(action or "").strip(),
        "detail": str(detail or "").strip(),
        "type": str(type or "activity").strip(),
        "metadata": metadata or {},
        "timestamp": now_iso(),
    }
    _append_jsonl(_project_activity_path(project_name), entry)
    _append_jsonl(GLOBAL_ACTIVITY_PATH, entry)
    return entry

def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    items = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            items.append(json.loads(line))
        except Exception:
            continue
    return items

def read_project_activity(project_name: str, limit: int = 100) -> dict:
    items = _read_jsonl(_project_activity_path(project_name))
    items = items[-max(1, min(int(limit), 500)):]
    return {"items": items}

def read_global_activity(limit: int = 200) -> dict:
    items = _read_jsonl(GLOBAL_ACTIVITY_PATH)
    items = items[-max(1, min(int(limit), 1000)):]
    return {"items": items}
