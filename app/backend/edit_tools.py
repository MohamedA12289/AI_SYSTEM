"""
Anchor-based file editing.

Avoids rewriting whole files. The agent supplies a list of edit ops, each one
matching a unique anchor (substring) in the current file:

* ``replace``      - replace ``anchor`` with ``replacement``
* ``insert_after`` - insert ``content`` immediately after ``anchor``
* ``insert_before``- insert ``content`` immediately before ``anchor``
* ``delete``       - delete ``anchor``

Each anchor MUST appear exactly once in the current file content; otherwise the
op is rejected with a clear error so the agent can read more context and retry.
This is the core safety property that makes anchor-edits reliable.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from file_tools import resolve_safe_path
from diff_tools import build_unified_diff


def _count(haystack: str, needle: str) -> int:
    if not needle:
        return 0
    count = 0
    start = 0
    while True:
        idx = haystack.find(needle, start)
        if idx == -1:
            return count
        count += 1
        start = idx + 1
    return count


def _apply_one(text: str, op: Dict[str, Any]) -> Tuple[str, str]:
    """Apply a single op. Returns (new_text, summary). Raises on error."""
    op_type = (op.get("op") or op.get("type") or "").strip().lower()
    anchor = op.get("anchor")
    if anchor is None:
        anchor = op.get("find")
    if not isinstance(anchor, str) or anchor == "":
        raise ValueError("Each edit op requires a non-empty 'anchor' string.")

    occurrences = _count(text, anchor)
    if occurrences == 0:
        snippet = anchor if len(anchor) <= 80 else anchor[:80] + "..."
        raise ValueError(f"Anchor not found in file: {snippet!r}")
    if occurrences > 1:
        snippet = anchor if len(anchor) <= 80 else anchor[:80] + "..."
        raise ValueError(
            f"Anchor matches {occurrences} times (must be unique). "
            f"Add surrounding context to make it unique. anchor={snippet!r}"
        )

    if op_type in {"replace", ""}:
        replacement = op.get("replacement")
        if replacement is None:
            replacement = op.get("replace", "")
        if not isinstance(replacement, str):
            replacement = str(replacement)
        return text.replace(anchor, replacement, 1), f"replace ({len(anchor)}->{len(replacement)} chars)"

    if op_type == "insert_after":
        content = op.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        idx = text.find(anchor) + len(anchor)
        return text[:idx] + content + text[idx:], f"insert_after (+{len(content)} chars)"

    if op_type == "insert_before":
        content = op.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        idx = text.find(anchor)
        return text[:idx] + content + text[idx:], f"insert_before (+{len(content)} chars)"

    if op_type == "delete":
        return text.replace(anchor, "", 1), f"delete (-{len(anchor)} chars)"

    raise ValueError(f"Unknown edit op type: {op_type!r}")


def edit_file(project_name: str, relative_path: str, edits: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Apply a list of anchor-based edits to a project file.

    Returns a dict with:
        * status        - "edited"
        * path          - relative path
        * applied       - list of per-op summaries
        * diff          - unified diff between old and new content
        * old_size, new_size
    """
    if not isinstance(edits, list) or not edits:
        raise ValueError("'edits' must be a non-empty list of edit ops.")

    target = resolve_safe_path(project_name, relative_path)
    if not target.exists():
        raise FileNotFoundError("File does not exist. Use write_file to create it.")
    if target.is_dir():
        raise IsADirectoryError("Target path is a directory, not a file.")

    try:
        original = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise ValueError("This file is not a readable UTF-8 text file.")

    current = original
    applied: List[str] = []
    for i, op in enumerate(edits):
        if not isinstance(op, dict):
            raise ValueError(f"Edit op #{i} must be a JSON object.")
        try:
            current, summary = _apply_one(current, op)
        except ValueError as e:
            raise ValueError(f"Edit op #{i} failed: {e}")
        applied.append(summary)

    target.write_text(current, encoding="utf-8")
    diff = build_unified_diff(original, current, path_label=relative_path)
    return {
        "status": "edited",
        "project_name": project_name,
        "path": relative_path,
        "applied": applied,
        "old_size": len(original),
        "new_size": len(current),
        "diff": diff,
    }


def preview_edit_file(project_name: str, relative_path: str, edits: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Same as :func:`edit_file` but does not write to disk."""
    if not isinstance(edits, list) or not edits:
        raise ValueError("'edits' must be a non-empty list of edit ops.")
    target = resolve_safe_path(project_name, relative_path)
    if not target.exists():
        raise FileNotFoundError("File does not exist.")
    original = target.read_text(encoding="utf-8")
    current = original
    applied: List[str] = []
    for i, op in enumerate(edits):
        if not isinstance(op, dict):
            raise ValueError(f"Edit op #{i} must be a JSON object.")
        current, summary = _apply_one(current, op)
        applied.append(summary)
    diff = build_unified_diff(original, current, path_label=relative_path)
    return {
        "status": "preview",
        "project_name": project_name,
        "path": relative_path,
        "applied": applied,
        "old_size": len(original),
        "new_size": len(current),
        "diff": diff,
    }
