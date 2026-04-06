
from __future__ import annotations

from pathlib import Path
import json
from uuid import uuid4
from datetime import datetime, timezone

from config import APPROVALS_FILENAME
from memory import ensure_project_memory, get_project_path

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _approvals_path(project_name: str) -> Path:
    ensure_project_memory(project_name)
    return get_project_path(project_name) / APPROVALS_FILENAME

def _read(project_name: str) -> dict:
    path = _approvals_path(project_name)
    if not path.exists():
        data = {"items": []}
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {"items": []}
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        data = {"items": []}
    return data

def _write(project_name: str, data: dict) -> dict:
    path = _approvals_path(project_name)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def list_approvals(project_name: str, status: str | None = None) -> dict:
    data = _read(project_name)
    items = data["items"]
    if status:
        items = [x for x in items if x.get("status") == status]
    return {"items": items}

def create_approval(project_name: str, approval_type: str, payload: dict, summary: str = "") -> dict:
    data = _read(project_name)
    item = {
        "id": str(uuid4()),
        "project_name": project_name,
        "approval_type": approval_type,
        "status": "pending",
        "summary": str(summary or ""),
        "payload": payload or {},
        "created_at": now_iso(),
        "resolved_at": None,
        "resolution_note": "",
    }
    data["items"].append(item)
    _write(project_name, data)
    return item

def get_approval(project_name: str, approval_id: str) -> dict:
    data = _read(project_name)
    for item in data["items"]:
        if item.get("id") == approval_id:
            return item
    raise FileNotFoundError("Approval not found.")

def resolve_approval(project_name: str, approval_id: str, status: str, note: str = "") -> dict:
    if status not in {"approved", "rejected", "cancelled"}:
        raise ValueError("Invalid approval status.")
    data = _read(project_name)
    for item in data["items"]:
        if item.get("id") == approval_id:
            item["status"] = status
            item["resolved_at"] = now_iso()
            item["resolution_note"] = str(note or "")
            _write(project_name, data)
            return item
    raise FileNotFoundError("Approval not found.")
