
from __future__ import annotations

from pathlib import Path

from file_tools import get_project_root
from memory import read_notes, read_tasks, read_memory_entries

def search_project(project_name: str, query: str, max_results: int = 50) -> dict:
    cleaned = str(query or "").strip().lower()
    if not cleaned:
        raise ValueError("Query cannot be empty.")

    results = []

    root = get_project_root(project_name)
    for path in root.rglob("*"):
        if len(results) >= max_results:
            break
        try:
            rel = path.relative_to(root)
        except Exception:
            rel = path
        rel_text = str(rel).replace("\\", "/")
        if cleaned in rel_text.lower():
            results.append({"kind": "path", "path": rel_text, "match": rel_text})

        if path.is_file():
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            lower = text.lower()
            idx = lower.find(cleaned)
            if idx != -1:
                snippet = text[max(0, idx - 60): idx + len(cleaned) + 120].replace("\n", " ")
                results.append({"kind": "file_content", "path": rel_text, "match": snippet})
        if len(results) >= max_results:
            break

    notes = read_notes(project_name).get("notes", [])
    for note in notes:
        content = str(note.get("content", ""))
        if cleaned in content.lower():
            results.append({"kind": "note", "id": note.get("id"), "match": content})
        if len(results) >= max_results:
            break

    tasks = read_tasks(project_name).get("tasks", [])
    for task in tasks:
        title = str(task.get("title", ""))
        if cleaned in title.lower():
            results.append({"kind": "task", "id": task.get("id"), "match": title})
        if len(results) >= max_results:
            break

    memories = read_memory_entries(project_name).get("entries", [])
    for entry in memories:
        title = str(entry.get("key", "")) + " " + str(entry.get("value", ""))
        if cleaned in title.lower():
            results.append({"kind": "memory", "id": entry.get("id"), "match": title})
        if len(results) >= max_results:
            break

    return {"query": cleaned, "results": results[:max_results]}
