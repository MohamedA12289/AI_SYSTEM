"""
Lightweight per-project plan / todo store backed by SQLite.

A "plan" has a title and an ordered list of items, each item has a status:
``pending`` / ``in_progress`` / ``done`` / ``cancelled``.

Storage:
    <AI_SYSTEM>/memory/projects/<project_name>/plans.sqlite

Tables:
    plans(id INTEGER PK, title TEXT, created_at TEXT, status TEXT)
    plan_items(id INTEGER PK, plan_id INT FK, position INT, content TEXT,
               status TEXT, updated_at TEXT)

Exposed via ``run_plan_op(project_name, op, args)`` for the agent action
``plan`` in :mod:`agent_tools`.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import MEMORY_BASE_PATH
from memory import validate_project_name


_VALID_ITEM_STATUS = {"pending", "in_progress", "done", "cancelled"}
_VALID_PLAN_STATUS = {"active", "completed", "cancelled"}


def _db_path(project_name: str) -> Path:
    validate_project_name(project_name)
    base = MEMORY_BASE_PATH / project_name
    base.mkdir(parents=True, exist_ok=True)
    return base / "plans.sqlite"


def _connect(project_name: str) -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path(project_name)))
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS plan_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            content TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS plan_items_plan_idx ON plan_items(plan_id, position);
        """
    )
    return conn


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def _plan_to_dict(row: sqlite3.Row, items: List[sqlite3.Row]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "items": [
            {
                "id": it["id"],
                "position": it["position"],
                "content": it["content"],
                "status": it["status"],
                "updated_at": it["updated_at"],
            }
            for it in items
        ],
    }


def create_plan(project_name: str, title: str, items: Optional[List[str]] = None) -> Dict[str, Any]:
    title = (title or "").strip()
    if not title:
        raise ValueError("plan title is required")
    items = items or []
    now = _now()
    with _connect(project_name) as conn:
        cur = conn.execute(
            "INSERT INTO plans (title, status, created_at, updated_at) VALUES (?, 'active', ?, ?)",
            (title, now, now),
        )
        plan_id = cur.lastrowid
        for i, content in enumerate(items):
            content_str = (content or "").strip() if isinstance(content, str) else str(content).strip()
            if not content_str:
                continue
            conn.execute(
                "INSERT INTO plan_items (plan_id, position, content, status, updated_at) "
                "VALUES (?, ?, ?, 'pending', ?)",
                (plan_id, i, content_str, now),
            )
        conn.commit()
        return get_plan(project_name, plan_id)


def get_plan(project_name: str, plan_id: int) -> Dict[str, Any]:
    with _connect(project_name) as conn:
        row = conn.execute("SELECT * FROM plans WHERE id = ?", (plan_id,)).fetchone()
        if not row:
            raise ValueError(f"plan {plan_id} not found")
        items = conn.execute(
            "SELECT * FROM plan_items WHERE plan_id = ? ORDER BY position ASC, id ASC",
            (plan_id,),
        ).fetchall()
        return _plan_to_dict(row, items)


def list_plans(project_name: str) -> List[Dict[str, Any]]:
    with _connect(project_name) as conn:
        rows = conn.execute("SELECT * FROM plans ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            items = conn.execute(
                "SELECT * FROM plan_items WHERE plan_id = ? ORDER BY position ASC, id ASC",
                (row["id"],),
            ).fetchall()
            result.append(_plan_to_dict(row, items))
        return result


def add_item(project_name: str, plan_id: int, content: str) -> Dict[str, Any]:
    content = (content or "").strip()
    if not content:
        raise ValueError("item content is required")
    now = _now()
    with _connect(project_name) as conn:
        # Determine next position
        row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) AS max_pos FROM plan_items WHERE plan_id = ?",
            (plan_id,),
        ).fetchone()
        next_pos = (row["max_pos"] if row else -1) + 1
        conn.execute(
            "INSERT INTO plan_items (plan_id, position, content, status, updated_at) "
            "VALUES (?, ?, ?, 'pending', ?)",
            (plan_id, next_pos, content, now),
        )
        conn.execute("UPDATE plans SET updated_at = ? WHERE id = ?", (now, plan_id))
        conn.commit()
    return get_plan(project_name, plan_id)


def set_item_status(project_name: str, item_id: int, status: str) -> Dict[str, Any]:
    status = (status or "").strip().lower()
    if status not in _VALID_ITEM_STATUS:
        raise ValueError(f"status must be one of {sorted(_VALID_ITEM_STATUS)}")
    now = _now()
    with _connect(project_name) as conn:
        row = conn.execute("SELECT plan_id FROM plan_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise ValueError(f"item {item_id} not found")
        conn.execute(
            "UPDATE plan_items SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, item_id),
        )
        conn.execute("UPDATE plans SET updated_at = ? WHERE id = ?", (now, row["plan_id"]))
        conn.commit()
        return get_plan(project_name, row["plan_id"])


def set_plan_status(project_name: str, plan_id: int, status: str) -> Dict[str, Any]:
    status = (status or "").strip().lower()
    if status not in _VALID_PLAN_STATUS:
        raise ValueError(f"plan status must be one of {sorted(_VALID_PLAN_STATUS)}")
    with _connect(project_name) as conn:
        conn.execute(
            "UPDATE plans SET status = ?, updated_at = ? WHERE id = ?",
            (status, _now(), plan_id),
        )
        conn.commit()
    return get_plan(project_name, plan_id)


def delete_plan(project_name: str, plan_id: int) -> Dict[str, Any]:
    with _connect(project_name) as conn:
        conn.execute("DELETE FROM plan_items WHERE plan_id = ?", (plan_id,))
        conn.execute("DELETE FROM plans WHERE id = ?", (plan_id,))
        conn.commit()
    return {"deleted": plan_id}


def run_plan_op(project_name: str, op: str, args: Dict[str, Any]) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if op == "create":
        items = args.get("items") or []
        if not isinstance(items, list):
            raise ValueError("'items' must be a list")
        return create_plan(project_name, args.get("title", ""), items)
    if op == "list":
        return {"plans": list_plans(project_name)}
    if op == "get":
        return get_plan(project_name, int(args.get("plan_id")))
    if op == "add_item":
        return add_item(project_name, int(args.get("plan_id")), args.get("content", ""))
    if op == "set_status":
        # Item-level status update.
        return set_item_status(project_name, int(args.get("item_id")), args.get("status", ""))
    if op == "set_plan_status":
        return set_plan_status(project_name, int(args.get("plan_id")), args.get("status", ""))
    if op == "delete":
        return delete_plan(project_name, int(args.get("plan_id")))
    raise ValueError(f"Unknown plan op: {op}")
