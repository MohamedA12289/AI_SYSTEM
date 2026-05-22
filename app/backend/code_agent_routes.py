from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from file_tools import get_project_root, list_directory, read_text_file, resolve_safe_path
from ollama_client import ask_ollama
from command_tools import run_safe_command, normalize_command_list, validate_command, normalize_timeout
from memory import read_memory_entries, write_memory_entries, validate_project_name
from config import ALLOWED_EXECUTABLES
from project_registry import assert_project_registered

router = APIRouter()

TEXT_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml",
    ".toml", ".md", ".txt", ".html", ".css", ".scss", ".sh", ".go",
    ".rs", ".java", ".cs", ".cpp", ".c", ".h", ".sql", ".env",
}

ENTRY_PATTERNS = [
    "main.py", "app.py", "server.py", "index.py",
    "main.ts", "main.tsx", "index.ts", "index.tsx", "App.tsx", "App.ts",
    "package.json", "pyproject.toml", "requirements.txt", "setup.py",
    "Makefile", "Dockerfile", "docker-compose.yml",
    "vite.config.ts", "vite.config.js", "tsconfig.json", "tailwind.config.ts",
]

ROUTE_PATTERNS = ["router", "routes", "route", "endpoint", "controller", "handler"]
PAGE_PATTERNS = ["pages", "page", "views", "view", "screens", "screen"]
SERVICE_PATTERNS = ["service", "services", "api", "client", "store"]
TEST_PATTERNS = [".test.", ".spec.", "test_", "_test.", "tests/", "__tests__/"]


def _walk_project(project_name: str, max_files: int = 300) -> list[dict]:
    root = get_project_root(project_name)
    items = []
    skip_dirs = {
        "__pycache__", ".git", "node_modules", "venv", ".venv",
        "dist", "build", ".next", ".nuxt", "coverage", ".cache",
        "migrations", "static", "public", "assets",
    }

    def _walk(path: Path, rel: str, depth: int):
        if depth > 6 or len(items) >= max_files:
            return
        try:
            for child in sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
                if child.is_dir():
                    if child.name.startswith(".") or child.name in skip_dirs:
                        continue
                    child_rel = f"{rel}/{child.name}" if rel else child.name
                    _walk(child, child_rel, depth + 1)
                elif child.is_file():
                    if child.suffix.lower() in TEXT_EXTS or child.name in ENTRY_PATTERNS:
                        child_rel = f"{rel}/{child.name}" if rel else child.name
                        items.append({"path": child_rel, "name": child.name, "size": child.stat().st_size})
        except PermissionError:
            pass

    _walk(root, "", 0)
    return items


def _categorize_file(path: str, name: str) -> list[str]:
    cats = []
    lower_path = path.lower()
    lower_name = name.lower()

    if lower_name in [e.lower() for e in ENTRY_PATTERNS]:
        cats.append("entry_point")
    if any(p in lower_path for p in ROUTE_PATTERNS):
        cats.append("route")
    if any(p in lower_path for p in PAGE_PATTERNS):
        cats.append("page")
    if any(p in lower_path for p in SERVICE_PATTERNS):
        cats.append("service")
    if any(p in lower_path for p in TEST_PATTERNS) or any(p in lower_name for p in [".test.", ".spec.", "test_"]):
        cats.append("test")
    if lower_name.endswith((".ts", ".tsx", ".js", ".jsx")) and not cats:
        cats.append("frontend")
    if lower_name.endswith(".py") and not cats:
        cats.append("backend")
    if not cats:
        cats.append("other")
    return cats


def _read_file_snippet(project_name: str, rel_path: str, max_chars: int = 1500) -> str:
    try:
        content = read_text_file(project_name, rel_path)
        if isinstance(content, dict):
            content = content.get("content", "")
        return str(content)[:max_chars]
    except Exception:
        return ""


def _read_memory_entry_list(project_name: str) -> list[dict]:
    data = read_memory_entries(project_name)
    if isinstance(data, dict):
        entries = data.get("entries", [])
    elif isinstance(data, list):
        entries = data
    else:
        entries = []
    return [entry for entry in entries if isinstance(entry, dict)]


def _write_memory_entry_list(project_name: str, entries: list[dict]) -> dict:
    return write_memory_entries(project_name, {"entries": entries})


class WorkspaceMapRequest(BaseModel):
    focus: str = ""


@router.post("/project/{project_name}/coagent/workspace-map")
def workspace_map(project_name: str, body: WorkspaceMapRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name)
    categorized: dict[str, list[str]] = {}
    for f in files:
        for cat in _categorize_file(f["path"], f["name"]):
            categorized.setdefault(cat, []).append(f["path"])

    entry_snippets: list[dict] = []
    for path in (categorized.get("entry_point", []) + categorized.get("route", []))[:6]:
        snippet = _read_file_snippet(project_name, path, 800)
        if snippet:
            entry_snippets.append({"path": path, "snippet": snippet[:400]})

    focus_note = f"\nFocus: {body.focus}" if body.focus else ""
    prompt = f"""Analyze this project workspace map and summarize:
- What the project is and does
- Key entry points and routes
- Frontend/backend split (if any)
- Major dependencies noted
- Suggested starting points for modifications{focus_note}

Files by category:
{json.dumps(categorized, indent=2)}

Entry point snippets:
{json.dumps(entry_snippets, indent=2)}

Respond in this JSON format:
{{
  "summary": "...",
  "entry_points": ["file1", "file2"],
  "frontend_files": ["..."],
  "backend_files": ["..."],
  "route_files": ["..."],
  "test_files": ["..."],
  "key_insights": ["insight1", "insight2"],
  "suggested_start_files": ["file1"]
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "project_name": project_name,
        "total_files": len(files),
        "categorized": categorized,
        "analysis": parsed or {"summary": raw, "key_insights": []},
        "raw": raw,
    }


class FileTargetsRequest(BaseModel):
    task: str
    context_files: list[str] = []


@router.post("/project/{project_name}/coagent/file-targets")
def file_targets(project_name: str, body: FileTargetsRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name, max_files=200)
    file_list = [f["path"] for f in files]

    snippets = []
    for path in body.context_files[:4]:
        s = _read_file_snippet(project_name, path, 600)
        if s:
            snippets.append(f"=== {path} ===\n{s}")

    snippet_text = "\n\n".join(snippets) if snippets else "No context files provided."
    prompt = f"""Given this coding task, identify exactly which files should be modified.

Task: {body.task}

Project files:
{chr(10).join(file_list[:120])}

Context from currently open files:
{snippet_text}

Respond ONLY with this JSON:
{{
  "primary_files": ["path/to/file1", "path/to/file2"],
  "secondary_files": ["path/to/supporting"],
  "do_not_touch": ["path/to/stable"],
  "new_files_needed": ["path/to/new"],
  "reasoning": "brief explanation of why these files"
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "task": body.task,
        "targets": parsed or {"primary_files": [], "reasoning": raw},
        "raw": raw,
    }


class WhyFailingRequest(BaseModel):
    error_text: str
    context_files: list[str] = []
    recent_changes: list[str] = []


@router.post("/project/{project_name}/coagent/why-failing")
def why_failing(project_name: str, body: WhyFailingRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name, max_files=150)
    file_list = [f["path"] for f in files]

    snippets = []
    for path in body.context_files[:3]:
        s = _read_file_snippet(project_name, path, 500)
        if s:
            snippets.append(f"=== {path} ===\n{s}")

    snippet_text = "\n\n".join(snippets) if snippets else ""
    recent = "\n".join(body.recent_changes) if body.recent_changes else "None provided."

    prompt = f"""Diagnose why this error/failure is occurring.

Error / failure output:
{body.error_text[:2000]}

Recent changes:
{recent}

Project files available:
{chr(10).join(file_list[:80])}

Context snippets:
{snippet_text}

Respond ONLY with this JSON:
{{
  "likely_cause": "clear explanation",
  "likely_files": ["file1", "file2"],
  "likely_function_or_route": "functionName or /route/path",
  "root_cause_type": "type_error | import_error | logic_error | network_error | config_error | test_assertion | other",
  "debug_steps": ["step 1", "step 2"],
  "suggested_fix": "brief description of fix"
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "diagnosis": parsed or {"likely_cause": raw, "debug_steps": []},
        "raw": raw,
    }


class WiringTraceRequest(BaseModel):
    feature: str
    starting_file: str = ""


@router.post("/project/{project_name}/coagent/wiring-trace")
def wiring_trace(project_name: str, body: WiringTraceRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name, max_files=200)
    file_list = [f["path"] for f in files]

    start_snippet = ""
    if body.starting_file:
        s = _read_file_snippet(project_name, body.starting_file, 800)
        if s:
            start_snippet = f"\n=== Starting file: {body.starting_file} ===\n{s}"

    prompt = f"""Trace how the feature "{body.feature}" is wired through the project.

{start_snippet}

All project files:
{chr(10).join(file_list[:120])}

Identify the full wiring chain from frontend to backend.
Respond ONLY with this JSON:
{{
  "feature": "{body.feature}",
  "chain": [
    {{"layer": "frontend_component", "file": "path", "symbol": "ComponentName", "notes": "..."}},
    {{"layer": "api_call", "file": "path", "symbol": "api.xxx.method", "notes": "..."}},
    {{"layer": "backend_route", "file": "path", "symbol": "/route/path", "notes": "..."}},
    {{"layer": "handler", "file": "path", "symbol": "function_name", "notes": "..."}}
  ],
  "gaps": ["any detected mismatch or missing wiring"],
  "summary": "one sentence summary"
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "feature": body.feature,
        "trace": parsed or {"chain": [], "summary": raw},
        "raw": raw,
    }


@router.post("/project/{project_name}/coagent/cleanup-scan")
def cleanup_scan(project_name: str):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    root = get_project_root(project_name)

    JUNK_PATTERNS = [
        r".*_backup_\d+.*",
        r".*_bak_\d+.*",
        r".*\.bak$",
        r".*_old\b.*",
        r".*_copy\b.*",
        r".*_temp\b.*",
        r".*_tmp\b.*",
        r".*_fix_round\d+.*",
        r".*_replace_backup.*",
        r".*\.orig$",
        r".*~$",
    ]

    junk_items = []
    try:
        for item in root.rglob("*"):
            if item.is_dir() or item.is_file():
                rel = str(item.relative_to(root)).replace("\\", "/")
                name = item.name
                for pat in JUNK_PATTERNS:
                    if re.match(pat, name, re.IGNORECASE) or re.match(pat, rel, re.IGNORECASE):
                        junk_items.append({
                            "path": rel,
                            "type": "directory" if item.is_dir() else "file",
                            "size": item.stat().st_size if item.is_file() else 0,
                            "pattern_matched": pat,
                        })
                        break
    except Exception:
        pass

    return {
        "project_name": project_name,
        "junk_items": junk_items[:50],
        "count": len(junk_items),
        "note": "Review before deleting. Use file delete endpoints to remove items after approval.",
    }


@router.post("/project/{project_name}/coagent/api-contracts")
def api_contracts(project_name: str):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name, max_files=200)

    route_files = [f for f in files if any(p in f["path"].lower() for p in ROUTE_PATTERNS + ["main.py", "app.py"])]
    service_files = [f for f in files if any(p in f["path"].lower() for p in ["api.ts", "api.js", "services/", "service/"])]

    backend_snippets = []
    for f in route_files[:5]:
        s = _read_file_snippet(project_name, f["path"], 600)
        if s:
            backend_snippets.append(f"=== {f['path']} ===\n{s}")

    frontend_snippets = []
    for f in service_files[:3]:
        s = _read_file_snippet(project_name, f["path"], 600)
        if s:
            frontend_snippets.append(f"=== {f['path']} ===\n{s}")

    prompt = f"""Analyze the API contracts between frontend and backend in this project.

Backend routes:
{chr(10).join(backend_snippets[:3])}

Frontend API calls:
{chr(10).join(frontend_snippets[:2])}

Identify:
- Duplicate routes
- Mismatched endpoint names or paths
- Missing fields in responses
- Suspicious duplicate handlers
- Frontend calls that have no matching backend route

Respond ONLY with this JSON:
{{
  "issues": [
    {{"type": "duplicate_route|missing_field|path_mismatch|orphan_call|other", "description": "...", "files": ["file1"], "severity": "high|medium|low"}}
  ],
  "summary": "overall assessment",
  "healthy_routes": ["list of routes that look fine"]
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "analysis": parsed or {"issues": [], "summary": raw},
        "scanned_backend_files": [f["path"] for f in route_files[:5]],
        "scanned_frontend_files": [f["path"] for f in service_files[:3]],
        "raw": raw,
    }


class ProjectStateRequest(BaseModel):
    focus: str = ""


@router.post("/project/{project_name}/coagent/project-state")
def project_state(project_name: str, body: ProjectStateRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    files = _walk_project(project_name, max_files=200)
    categorized: dict[str, list[str]] = {}
    for f in files:
        for cat in _categorize_file(f["path"], f["name"]):
            categorized.setdefault(cat, []).append(f["path"])

    memory_entries = []
    try:
        raw_mem = _read_memory_entry_list(project_name)
        memory_entries = [{"key": e.get("key", ""), "value": e.get("value", "")} for e in raw_mem[:10]]
    except Exception:
        pass

    focus_note = f"\nFocus area: {body.focus}" if body.focus else ""
    prompt = f"""Summarize the current state of this project.{focus_note}

Project structure:
{json.dumps(categorized, indent=2)}

Stored memory/notes:
{json.dumps(memory_entries, indent=2)}

Respond ONLY with this JSON:
{{
  "what_it_is": "one clear sentence describing the project",
  "current_features": ["feature 1", "feature 2"],
  "recently_changed": ["observation 1"],
  "known_issues": ["issue 1"],
  "risks": ["risk 1"],
  "best_next_steps": ["step 1", "step 2"],
  "architecture_notes": "brief description of architecture"
}}"""

    raw = ask_ollama(prompt)
    parsed = None
    try:
        m = re.search(r"\{[\s\S]+\}", raw)
        if m:
            parsed = json.loads(m.group(0))
    except Exception:
        pass

    return {
        "project_name": project_name,
        "state": parsed or {"what_it_is": raw, "best_next_steps": []},
        "raw": raw,
    }


class RunCommandRequest(BaseModel):
    command: list[str]
    timeout_seconds: int = 30
    require_approval: bool = False


@router.post("/project/{project_name}/coagent/run-command")
def run_command(project_name: str, body: RunCommandRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    try:
        result = run_safe_command(project_name, body.command, body.timeout_seconds)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CodingMemoryRequest(BaseModel):
    action: str = "read"
    key: str = ""
    value: str = ""
    pinned: bool = False


@router.post("/project/{project_name}/coagent/coding-memory")
def coding_memory(project_name: str, body: CodingMemoryRequest):
    assert_project_registered(project_name)
    validate_project_name(project_name)
    if body.action == "read":
        try:
            entries = _read_memory_entry_list(project_name)
            return {"entries": entries}
        except Exception:
            return {"entries": []}
    elif body.action == "write":
        if not body.key or not body.value:
            raise HTTPException(status_code=400, detail="key and value required for write")
        try:
            entries = _read_memory_entry_list(project_name)
            existing = next((e for e in entries if e.get("key") == body.key), None)
            if existing:
                existing["value"] = body.value
                existing["pinned"] = body.pinned
            else:
                entries.append({"key": body.key, "value": body.value, "pinned": body.pinned})
            _write_memory_entry_list(project_name, entries)
            return {"saved": True, "key": body.key}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="action must be 'read' or 'write'")
