
from __future__ import annotations

from pathlib import Path
import json
import shutil
from uuid import uuid4
from datetime import datetime, timezone

from config import SNAPSHOTS_DIRNAME
from file_tools import get_project_root
from memory import ensure_project_memory, get_project_path

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _snapshots_root(project_name: str) -> Path:
    ensure_project_memory(project_name)
    root = get_project_path(project_name) / SNAPSHOTS_DIRNAME
    root.mkdir(parents=True, exist_ok=True)
    return root

def _meta_path(project_name: str) -> Path:
    root = _snapshots_root(project_name)
    return root / "index.json"

def _read_meta(project_name: str) -> dict:
    path = _meta_path(project_name)
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

def _write_meta(project_name: str, data: dict) -> dict:
    path = _meta_path(project_name)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def list_snapshots(project_name: str) -> dict:
    return _read_meta(project_name)

def create_snapshot(project_name: str, note: str = "") -> dict:
    source_root = get_project_root(project_name)
    snapshots_root = _snapshots_root(project_name)
    snapshot_id = str(uuid4())
    snapshot_dir = snapshots_root / snapshot_id
    workspace_copy = snapshot_dir / "workspace"
    workspace_copy.parent.mkdir(parents=True, exist_ok=True)

    if workspace_copy.exists():
        shutil.rmtree(workspace_copy)

    shutil.copytree(source_root, workspace_copy, dirs_exist_ok=True)

    item = {
        "id": snapshot_id,
        "project_name": project_name,
        "note": str(note or ""),
        "created_at": now_iso(),
        "path": str(workspace_copy),
    }
    data = _read_meta(project_name)
    data["items"].append(item)
    _write_meta(project_name, data)
    return item

def restore_snapshot(project_name: str, snapshot_id: str) -> dict:
    data = _read_meta(project_name)
    match = None
    for item in data["items"]:
        if item.get("id") == snapshot_id:
            match = item
            break
    if match is None:
        raise FileNotFoundError("Snapshot not found.")

    source = Path(match["path"])
    if not source.exists():
        raise FileNotFoundError("Snapshot data is missing.")

    target = get_project_root(project_name)
    shutil.copytree(source, target, dirs_exist_ok=True)
    return {
        "restored": True,
        "snapshot_id": snapshot_id,
        "project_name": project_name,
    }
