
from __future__ import annotations

from pathlib import Path
import json
from uuid import uuid4
from datetime import datetime, timezone

from config import MESSAGES_FILENAME
from memory import ensure_project_memory, get_project_path, read_legacy_chat, append_chat as append_legacy_chat

THREADS_FILENAME = "threads.json"
THREADS_DIR_NAME = "threads"

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


# ============================================================================
# Thread Storage System
# ============================================================================

def get_threads_path(project_name: str) -> Path:
    """Get path to threads.json for a project"""
    ensure_project_memory(project_name)
    return get_project_path(project_name) / THREADS_FILENAME

def get_threads_dir(project_name: str) -> Path:
    """Get path to threads/ directory for a project"""
    ensure_project_memory(project_name)
    threads_dir = get_project_path(project_name) / THREADS_DIR_NAME
    threads_dir.mkdir(exist_ok=True)
    return threads_dir

def get_thread_messages_path(project_name: str, thread_id: str) -> Path:
    """Get path to thread messages JSONL file"""
    threads_dir = get_threads_dir(project_name)
    return threads_dir / f"{thread_id}.jsonl"

def _read_threads_json(project_name: str) -> dict:
    """Read threads.json, return {threads: [...]}"""
    path = get_threads_path(project_name)
    if not path.exists():
        return {"threads": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"threads": []}
        if not isinstance(data.get("threads"), list):
            data["threads"] = []
        return data
    except Exception:
        return {"threads": []}

def _write_threads_json(project_name: str, data: dict) -> None:
    """Write threads.json"""
    path = get_threads_path(project_name)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def ensure_threads_store(project_name: str) -> Path:
    """Ensure threads.json exists for project"""
    path = get_threads_path(project_name)
    if not path.exists():
        _write_threads_json(project_name, {"threads": []})
    get_threads_dir(project_name)  # Ensure threads/ directory exists
    return path

def create_thread(project_name: str, title: str = "New Conversation") -> dict:
    """Create a new thread for a project"""
    ensure_threads_store(project_name)

    thread_id = f"{project_name}_{uuid4()}"
    thread = {
        "thread_id": thread_id,
        "id": thread_id,
        "project_name": project_name,
        "title": str(title).strip() or "New Conversation",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "message_count": 0,
    }

    data = _read_threads_json(project_name)
    data["threads"].append(thread)
    _write_threads_json(project_name, data)

    # Create empty thread messages file
    thread_messages_path = get_thread_messages_path(project_name, thread_id)
    thread_messages_path.touch()

    return thread

def list_threads(project_name: str) -> list[dict]:
    """List all threads for a project, sorted by updated_at descending"""
    ensure_threads_store(project_name)
    data = _read_threads_json(project_name)
    threads = data.get("threads", [])
    # Ensure all threads have 'id' field for frontend compatibility
    for thread in threads:
        if "id" not in thread and "thread_id" in thread:
            thread["id"] = thread["thread_id"]
    # Sort by updated_at, most recent first
    try:
        threads.sort(key=lambda t: t.get("updated_at", ""), reverse=True)
    except Exception:
        pass
    return threads

def get_thread(project_name: str, thread_id: str) -> dict:
    """Get a single thread by ID"""
    threads = list_threads(project_name)
    for thread in threads:
        if thread.get("thread_id") == thread_id:
            return thread
    raise FileNotFoundError(f"Thread {thread_id} not found in project {project_name}")

def update_thread_title(project_name: str, thread_id: str, title: str) -> dict:
    """Update thread title"""
    data = _read_threads_json(project_name)
    threads = data.get("threads", [])

    for thread in threads:
        if thread.get("thread_id") == thread_id:
            thread["title"] = str(title).strip() or thread.get("title", "New Conversation")
            thread["updated_at"] = now_iso()
            if "id" not in thread:
                thread["id"] = thread["thread_id"]
            _write_threads_json(project_name, data)
            return thread

    raise FileNotFoundError(f"Thread {thread_id} not found")

def delete_thread(project_name: str, thread_id: str) -> dict:
    """Delete a thread and its messages"""
    data = _read_threads_json(project_name)
    threads = data.get("threads", [])

    deleted_thread = None
    for i, thread in enumerate(threads):
        if thread.get("thread_id") == thread_id:
            deleted_thread = threads.pop(i)
            break

    if not deleted_thread:
        raise FileNotFoundError(f"Thread {thread_id} not found")

    _write_threads_json(project_name, data)

    # Delete thread messages file
    thread_messages_path = get_thread_messages_path(project_name, thread_id)
    if thread_messages_path.exists():
        thread_messages_path.unlink()

    # Ensure id field exists for frontend compatibility
    if "id" not in deleted_thread and "thread_id" in deleted_thread:
        deleted_thread["id"] = deleted_thread["thread_id"]

    return deleted_thread

def append_thread_message(
    project_name: str,
    thread_id: str,
    role: str,
    content: str,
    message_type: str = "chat",
    metadata: dict | None = None,
) -> dict:
    """Append a message to a thread"""
    # Verify thread exists
    thread = get_thread(project_name, thread_id)

    # Create message
    message = {
        "id": str(uuid4()),
        "thread_id": thread_id,
        "project_name": project_name,
        "role": str(role),
        "content": str(content or ""),
        "message_type": str(message_type or "chat"),
        "timestamp": now_iso(),
        "metadata": metadata or {},
    }

    # Write message to thread JSONL file
    thread_messages_path = get_thread_messages_path(project_name, thread_id)
    _write_message(thread_messages_path, message)

    # Update thread metadata (updated_at, message_count)
    data = _read_threads_json(project_name)
    for t in data["threads"]:
        if t.get("thread_id") == thread_id:
            t["updated_at"] = now_iso()
            t["message_count"] = t.get("message_count", 0) + 1
            break
    _write_threads_json(project_name, data)

    return message

def read_thread_messages(project_name: str, thread_id: str) -> list[dict]:
    """Read all messages from a thread"""
    # Verify thread exists
    get_thread(project_name, thread_id)

    thread_messages_path = get_thread_messages_path(project_name, thread_id)
    if not thread_messages_path.exists():
        return []

    items = []
    for raw in thread_messages_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            items.append(json.loads(line))
        except Exception:
            continue
    return items

def read_thread_messages_page(
    project_name: str,
    thread_id: str,
    offset: int = 0,
    limit: int = 50
) -> dict:
    """Read paginated messages from a thread"""
    all_messages = read_thread_messages(project_name, thread_id)
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

def count_thread_messages(project_name: str, thread_id: str) -> int:
    """Count messages in a thread"""
    return len(read_thread_messages(project_name, thread_id))
