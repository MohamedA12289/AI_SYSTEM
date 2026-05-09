"""Prompt history stored in SQLite for recall and search."""
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

_DB_PATH = Path(os.path.expanduser("~/.cubos/prompt_history.db"))


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(_DB_PATH))
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS prompt_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            session_id TEXT,
            role TEXT,
            content TEXT NOT NULL,
            tags TEXT
        )
        """
    )
    c.execute("CREATE INDEX IF NOT EXISTS idx_ph_ts ON prompt_history(ts DESC)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_ph_session ON prompt_history(session_id)")
    return c


def add_entry(content: str, *, session_id: Optional[str] = None, role: str = "user", tags: str = "") -> int:
    if not content or not content.strip():
        return -1
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO prompt_history(ts, session_id, role, content, tags) VALUES(?,?,?,?,?)",
            (time.time(), session_id, role, content, tags),
        )
        return int(cur.lastrowid or -1)


def list_entries(limit: int = 100, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _conn() as c:
        if session_id:
            rows = c.execute(
                "SELECT id, ts, session_id, role, content, tags FROM prompt_history WHERE session_id=? ORDER BY ts DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT id, ts, session_id, role, content, tags FROM prompt_history ORDER BY ts DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [
        {"id": r[0], "ts": r[1], "session_id": r[2], "role": r[3], "content": r[4], "tags": r[5]}
        for r in rows
    ]


def search(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    q = f"%{query}%"
    with _conn() as c:
        rows = c.execute(
            "SELECT id, ts, session_id, role, content, tags FROM prompt_history WHERE content LIKE ? ORDER BY ts DESC LIMIT ?",
            (q, limit),
        ).fetchall()
    return [
        {"id": r[0], "ts": r[1], "session_id": r[2], "role": r[3], "content": r[4], "tags": r[5]}
        for r in rows
    ]


def delete_entry(entry_id: int) -> Dict[str, Any]:
    with _conn() as c:
        cur = c.execute("DELETE FROM prompt_history WHERE id=?", (entry_id,))
        return {"ok": True, "deleted": cur.rowcount}


def clear_all(session_id: Optional[str] = None) -> Dict[str, Any]:
    with _conn() as c:
        if session_id:
            cur = c.execute("DELETE FROM prompt_history WHERE session_id=?", (session_id,))
        else:
            cur = c.execute("DELETE FROM prompt_history")
        return {"ok": True, "deleted": cur.rowcount}


def run_history_op(op: str, **kwargs: Any) -> Dict[str, Any]:
    if op == "add":
        eid = add_entry(
            kwargs.get("content", ""),
            session_id=kwargs.get("session_id"),
            role=kwargs.get("role", "user"),
            tags=kwargs.get("tags", ""),
        )
        return {"ok": eid > 0, "id": eid}
    if op == "list":
        return {"ok": True, "entries": list_entries(int(kwargs.get("limit", 100)), kwargs.get("session_id"))}
    if op == "search":
        return {"ok": True, "entries": search(kwargs.get("query", ""), int(kwargs.get("limit", 50)))}
    if op == "delete":
        return delete_entry(int(kwargs.get("id", 0)))
    if op == "clear":
        return clear_all(kwargs.get("session_id"))
    return {"ok": False, "error": f"unknown_op: {op}"}
