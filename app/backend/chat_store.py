
from __future__ import annotations

from pathlib import Path
import json
from uuid import uuid4
from datetime import datetime, timezone

from config import MESSAGES_FILENAME
from memory import ensure_project_memory, get_project_path, read_legacy_chat, append_chat as append_legacy_chat

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_messages_path(project_name: str) -> Path:
    ensure_project_memory(project_name)
    return get_project_path(project_name) / MESSAGES_FILENAME

def _write_message(path: Path, message: dict) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(message, ensure_ascii=False) + "\n")

def ensure_messages_store(project_name: str) -> Path:
    path = get_messages_path(project_name)
    if path.exists():
        return path

    path.touch()

    legacy_text = read_legacy_chat(project_name)
    if legacy_text.strip():
        blocks = [b.strip() for b in legacy_text.split("\n\n") if b.strip()]
        for block in blocks:
            if ":" in block:
                role_prefix, content = block.split(":", 1)
                role = role_prefix.strip().lower()
                append_message(project_name, role=role, content=content.strip(), message_type="legacy_import", mirror_legacy=False)

    return path

def append_message(project_name: str, role: str, content: str, message_type: str = "chat", metadata: dict | None = None, mirror_legacy: bool = True) -> dict:
    path = ensure_messages_store(project_name)
    message = {
        "id": str(uuid4()),
        "project_name": project_name,
        "role": str(role),
        "content": str(content or ""),
        "message_type": str(message_type or "chat"),
        "timestamp": now_iso(),
        "metadata": metadata or {},
    }
    _write_message(path, message)
    if mirror_legacy and role in {"user", "assistant", "system"}:
        append_legacy_chat(project_name, role, content)
    return message

def read_messages(project_name: str) -> list[dict]:
    path = ensure_messages_store(project_name)
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

def read_messages_page(project_name: str, offset: int = 0, limit: int = 50) -> dict:
    all_messages = read_messages(project_name)
    total = len(all_messages)
    try:
        offset = max(0, int(offset))
    except Exception:
        offset = 0
    try:
        limit = max(1, min(200, int(limit)))
    except Exception:
        limit = 50

    start = max(0, total - offset - limit)
    end = total - offset
    page_items = all_messages[start:end]
    has_more = start > 0
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": has_more,
        "items": page_items,
    }

def count_messages(project_name: str) -> int:
    return len(read_messages(project_name))
