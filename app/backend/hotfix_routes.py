from __future__ import annotations

import os
from fastapi import APIRouter, Query

from file_tools import get_project_root
from memory import get_project_path

router = APIRouter()

TEXT_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
    ".toml", ".xml", ".html", ".css", ".csv", ".tsv", ".sql", ".log", ".env",
    ".ini", ".ps1", ".bat", ".java", ".go", ".rs", ".php", ".rb", ".swift", ".kt",
    ".docx", ".pptx", ".pdf"
}

def _safe_read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except Exception:
        return ""

def _collect_roots(project_name: str) -> list[str]:
    roots = []
    try:
        roots.append(str(get_project_root(project_name)))
    except Exception:
        pass
    try:
        roots.append(str(get_project_path(project_name)))
    except Exception:
        pass

    seen = []
    for item in roots:
        if item and item not in seen:
            seen.append(item)
    return seen

@router.get("/project/{project_name}/documents/search")
def documents_search_hotfix(project_name: str, query: str = Query(...), limit: int = Query(default=20)):
    q = str(query or "").strip().lower()
    if not q:
        return {"query": query, "results": []}

    results = []

    for root in _collect_roots(project_name):
        if not os.path.exists(root):
            continue

        for dirpath, _, filenames in os.walk(root):
            for name in filenames:
                full_path = os.path.join(dirpath, name)
                ext = os.path.splitext(name)[1].lower()
                rel_path = os.path.relpath(full_path, root).replace("\\", "/")

                if q in name.lower():
                    results.append({
                        "kind": "document_path",
                        "path": rel_path,
                        "match": name
                    })

                if ext in TEXT_EXTENSIONS:
                    text = _safe_read_text(full_path)
                    if text:
                        lowered = text.lower()
                        idx = lowered.find(q)
                        if idx != -1:
                            snippet = text[max(0, idx - 60): idx + 160].replace("\n", " ").strip()
                            results.append({
                                "kind": "document_content",
                                "path": rel_path,
                                "match": snippet
                            })

                if len(results) >= limit:
                    return {"query": query, "results": results[:limit]}

    return {"query": query, "results": results[:limit]}
