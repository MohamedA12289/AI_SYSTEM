from __future__ import annotations

import json
import os
import csv
import io
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ai_client import ask_ai
from file_tools import get_project_root, list_directory, read_text_file
from project_registry import get_registered_project, update_project, create_project
from memory import validate_project_name
from config import WORKSPACES_BASE_PATH, MEMORY_BASE_PATH

router = APIRouter()

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _get_project_or_404(project_name: str) -> dict:
    try:
        return get_registered_project(project_name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")

def _read_files_context(project_name: str, paths: list[str], max_chars: int = 6000) -> str:
    root = get_project_root(project_name)
    parts: list[str] = []
    total = 0
    for p in paths:
        try:
            full = (root / p).resolve()
            if root not in full.parents and full != root:
                continue
            content = full.read_text(encoding="utf-8", errors="replace")[:2000]
            parts.append(f"--- {p} ---\n{content}")
            total += len(content)
            if total >= max_chars:
                break
        except Exception:
            continue
    return "\n\n".join(parts) if parts else "(no file content available)"


# ─── Workspace Analyze ────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    paths: list[str] = []
    focus: str = "Give a broad high-level analysis."

@router.post("/project/{project_name}/workspace/analyze")
def workspace_analyze(project_name: str, req: AnalyzeRequest):
    _get_project_or_404(project_name)
    context = _read_files_context(project_name, req.paths)
    system = (
        "You are a senior software architect. Analyze the provided code/files and produce "
        "a structured workspace analysis covering: architecture overview, key dependencies, "
        "code quality observations, potential risks, and recommended next actions."
    )
    user = f"Focus: {req.focus}\n\nFiles:\n{context}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "analysis": result, "provider": provider, "paths": req.paths}


# ─── Pair Review ──────────────────────────────────────────────────────────────

class PairReviewRequest(BaseModel):
    paths: list[str] = []
    prompt: str = "Review this code and tell me the most important issues and improvements."

@router.post("/project/{project_name}/pair/review")
def pair_review(project_name: str, req: PairReviewRequest):
    _get_project_or_404(project_name)
    context = _read_files_context(project_name, req.paths)
    system = (
        "You are an expert code reviewer. Provide a thorough, actionable code review. "
        "Structure your response as: 1) Critical Issues, 2) Improvements, 3) Positive Observations, "
        "4) Specific recommendations with line references where possible."
    )
    user = f"{req.prompt}\n\nFiles:\n{context}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "review": result, "provider": provider, "paths": req.paths}


# ─── Pair Plan ────────────────────────────────────────────────────────────────

class PairPlanRequest(BaseModel):
    paths: list[str] = []
    prompt: str = "Create a practical implementation plan for these files."

@router.post("/project/{project_name}/pair/plan")
def pair_plan(project_name: str, req: PairPlanRequest):
    _get_project_or_404(project_name)
    context = _read_files_context(project_name, req.paths)
    system = (
        "You are a technical project planner. Based on the provided code and instructions, "
        "produce a detailed implementation plan with: impacted files, ordered steps, "
        "estimated complexity, risks, test plan, and the single most important next action."
    )
    user = f"{req.prompt}\n\nFiles:\n{context}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "plan": result, "provider": provider, "paths": req.paths}


# ─── Refactor Preview ─────────────────────────────────────────────────────────

class RefactorPreviewRequest(BaseModel):
    path: str
    prompt: str = "Preview the best refactor for this file in plain language."

@router.post("/project/{project_name}/pair/refactor-preview")
def refactor_preview(project_name: str, req: RefactorPreviewRequest):
    _get_project_or_404(project_name)
    context = _read_files_context(project_name, [req.path])
    system = (
        "You are a refactoring expert. Analyze the provided file and describe in plain language "
        "the best refactoring strategy. Include: what to change, why, expected benefits, "
        "potential side effects, and a brief example of the key transformation."
    )
    user = f"{req.prompt}\n\nFile: {req.path}\n{context}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "preview": result, "provider": provider, "path": req.path}


# ─── Cowork ───────────────────────────────────────────────────────────────────

class CoworkRequest(BaseModel):
    mode: str = "review"
    paths: list[str] = []
    instruction: str = "Help improve this workspace and explain the next best actions."

@router.post("/project/{project_name}/cowork/instruction")
def cowork_instruction(project_name: str, req: CoworkRequest):
    _get_project_or_404(project_name)
    context = _read_files_context(project_name, req.paths)
    system = (
        f"You are a collaborative AI assistant in '{req.mode}' mode. "
        "Work alongside the developer to provide hands-on guidance. "
        "Be direct, practical, and context-aware. Suggest concrete edits or next steps."
    )
    user = f"Instruction: {req.instruction}\n\nFiles:\n{context}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "response": result, "mode": req.mode, "provider": provider}


# ─── Deep Research ────────────────────────────────────────────────────────────

class DeepResearchRequest(BaseModel):
    prompt: str
    save_report: bool = False

@router.post("/project/{project_name}/research/deep-report")
def deep_research(project_name: str, req: DeepResearchRequest):
    _get_project_or_404(project_name)
    system = (
        "You are a deep research assistant. Produce a comprehensive, well-structured research report. "
        "Include: executive summary, key findings, technical details, trade-offs, references/sources "
        "(cite real sources where applicable), and a conclusions section."
    )
    user = req.prompt
    result, provider = ask_ai(system, user)

    report_path: str | None = None
    if req.save_report:
        try:
            root = get_project_root(project_name)
            reports_dir = root / "research_reports"
            reports_dir.mkdir(exist_ok=True)
            slug = req.prompt[:40].strip().replace(" ", "_").replace("/", "-")
            fname = f"{slug}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            (reports_dir / fname).write_text(f"# Research: {req.prompt}\n\n{result}", encoding="utf-8")
            report_path = str(reports_dir / fname)
        except Exception:
            pass

    return {"project_name": project_name, "report": result, "provider": provider, "saved_path": report_path}


# ─── Data / Dashboard Summary ─────────────────────────────────────────────────

class DashboardSummaryRequest(BaseModel):
    path: str

@router.post("/project/{project_name}/data/dashboard-summary")
def dashboard_summary(project_name: str, req: DashboardSummaryRequest):
    _get_project_or_404(project_name)
    root = get_project_root(project_name)
    try:
        target = (root / req.path).resolve() if not os.path.isabs(req.path) else Path(req.path).resolve()
        raw = target.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read file: {e}")

    preview = raw[:3000]
    system = (
        "You are a data analyst. The user has provided a data file (CSV, JSON, or plain text). "
        "Produce a concise dashboard summary including: row/column counts (if tabular), "
        "key statistics, notable patterns, data quality issues, and 3-5 actionable insights."
    )
    user = f"File: {req.path}\n\nContent preview:\n{preview}"
    result, provider = ask_ai(system, user)
    return {"project_name": project_name, "summary": result, "provider": provider, "path": req.path}


# ─── Media Transcription ──────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    path: str
    model_name: str = "base"
    task: str = "transcribe"
    language: str = "en"

@router.post("/project/{project_name}/media/transcribe-file")
def transcribe_file(project_name: str, req: TranscribeRequest):
    _get_project_or_404(project_name)
    try:
        import whisper  # type: ignore
        model = whisper.load_model(req.model_name)
        result = model.transcribe(req.path, task=req.task, language=req.language)
        transcript = result.get("text", "")
        return {"project_name": project_name, "transcript": transcript, "path": req.path, "engine": "whisper"}
    except ImportError:
        return {
            "project_name": project_name,
            "transcript": "",
            "path": req.path,
            "engine": "unavailable",
            "error": "Whisper is not installed. Run: pip install openai-whisper"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")


# ─── Voice Chat ───────────────────────────────────────────────────────────────

class VoiceChatRequest(BaseModel):
    path: str
    model_name: str = "base"
    task: str = "transcribe"
    language: str = "en"

@router.post("/project/{project_name}/voice/chat")
def voice_chat(project_name: str, req: VoiceChatRequest):
    _get_project_or_404(project_name)
    try:
        import whisper  # type: ignore
        model = whisper.load_model(req.model_name)
        result = model.transcribe(req.path, task=req.task, language=req.language)
        transcript = result.get("text", "")
    except ImportError:
        return {
            "project_name": project_name,
            "transcript": "",
            "response": "",
            "path": req.path,
            "error": "Whisper is not installed. Run: pip install openai-whisper"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    if not transcript.strip():
        return {"project_name": project_name, "transcript": transcript, "response": "", "path": req.path}

    system = "You are a helpful AI assistant responding to a voice message. Be concise and natural."
    response_text, provider = ask_ai(system, transcript)
    return {
        "project_name": project_name,
        "transcript": transcript,
        "response": response_text,
        "provider": provider,
        "path": req.path,
    }


# ─── Source Link ──────────────────────────────────────────────────────────────

class SourceLinkRequest(BaseModel):
    source_path: str
    mode: str = "link_readonly"

@router.post("/projects/{project_name}/source/link")
def source_link(project_name: str, req: SourceLinkRequest):
    project = _get_project_or_404(project_name)
    source = Path(req.source_path).resolve()
    if not source.exists():
        raise HTTPException(status_code=400, detail=f"Source path does not exist: {req.source_path}")

    updated = update_project(project_name, description=project.get("description", ""))
    from config import PROJECTS_REGISTRY_PATH
    import json as _json
    data = _json.loads(PROJECTS_REGISTRY_PATH.read_text(encoding="utf-8"))
    for item in data["projects"]:
        if item.get("project_name") == project_name:
            item["linked_source"] = str(source)
            item["source_mode"] = req.mode
            break
    PROJECTS_REGISTRY_PATH.write_text(_json.dumps(data, indent=2), encoding="utf-8")

    return {
        "project_name": project_name,
        "linked_source": str(source),
        "mode": req.mode,
        "linked": True,
    }


# ─── Scaffold App ─────────────────────────────────────────────────────────────

SCAFFOLD_TEMPLATES: dict[str, dict[str, str]] = {
    "fastapi_service": {
        "main.py": (
            "from fastapi import FastAPI\n\napp = FastAPI()\n\n"
            "@app.get('/')\ndef health():\n    return {'status': 'ok'}\n"
        ),
        "requirements.txt": "fastapi\nuvicorn[standard]\n",
        "README.md": "# FastAPI Service\n\nRun with: `uvicorn main:app --reload`\n",
    },
    "react_app": {
        "index.html": "<!DOCTYPE html>\n<html><head><title>App</title></head><body><div id='root'></div></body></html>\n",
        "src/App.tsx": "export default function App() {\n  return <div><h1>Hello World</h1></div>;\n}\n",
        "src/main.tsx": "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);\n",
        "package.json": '{\n  "name": "app",\n  "version": "1.0.0",\n  "scripts": {"dev": "vite"}\n}\n',
    },
    "python_cli": {
        "main.py": "import argparse\n\ndef main():\n    parser = argparse.ArgumentParser()\n    parser.add_argument('--name', default='World')\n    args = parser.parse_args()\n    print(f'Hello, {args.name}!')\n\nif __name__ == '__main__':\n    main()\n",
        "requirements.txt": "",
        "README.md": "# Python CLI\n\nRun with: `python main.py --name YourName`\n",
    },
    "node_service": {
        "index.js": "const http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, {'Content-Type': 'application/json'});\n  res.end(JSON.stringify({status: 'ok'}));\n});\nserver.listen(3000, () => console.log('Listening on :3000'));\n",
        "package.json": '{\n  "name": "service",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {"start": "node index.js"}\n}\n',
    },
}

class ScaffoldRequest(BaseModel):
    kind: str = "fastapi_service"
    target_dir: str = "generated_app"
    app_name: str = "generated_app"

@router.post("/project/{project_name}/scaffold/app")
def scaffold_app(project_name: str, req: ScaffoldRequest):
    _get_project_or_404(project_name)
    template = SCAFFOLD_TEMPLATES.get(req.kind)
    if not template:
        available = list(SCAFFOLD_TEMPLATES.keys())
        raise HTTPException(status_code=400, detail=f"Unknown scaffold kind '{req.kind}'. Available: {available}")

    root = get_project_root(project_name)
    target = (root / req.target_dir).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(status_code=400, detail="target_dir is outside the project workspace.")
    target.mkdir(parents=True, exist_ok=True)

    created_files: list[str] = []
    for rel_path, content in template.items():
        file_path = (target / rel_path).resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content.replace("generated_app", req.app_name), encoding="utf-8")
        created_files.append(str(file_path.relative_to(root)))

    return {
        "project_name": project_name,
        "kind": req.kind,
        "app_name": req.app_name,
        "target_dir": req.target_dir,
        "files_created": created_files,
        "scaffolded": True,
    }


# ─── Import Existing Project ──────────────────────────────────────────────────

class ImportProjectRequest(BaseModel):
    project_name: str
    display_name: str | None = None
    description: str = ""
    source_path: str
    access_mode: str = "import"

@router.post("/projects/import-linked")
def import_project(req: ImportProjectRequest):
    validate_project_name(req.project_name)
    source = Path(req.source_path).resolve()
    if not source.exists():
        raise HTTPException(status_code=400, detail=f"Source path does not exist: {req.source_path}")

    try:
        project = create_project(
            project_name=req.project_name,
            display_name=req.display_name,
            description=req.description,
        )
    except FileExistsError:
        raise HTTPException(status_code=409, detail="Project already exists.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from config import PROJECTS_REGISTRY_PATH
    import json as _json
    data = _json.loads(PROJECTS_REGISTRY_PATH.read_text(encoding="utf-8"))
    for item in data["projects"]:
        if item.get("project_name") == req.project_name:
            item["linked_source"] = str(source)
            item["source_mode"] = req.access_mode
            if req.access_mode in ("link_readonly", "link"):
                item["workspace_root"] = str(source)
                item["scope_root"] = str(source)
            break
    PROJECTS_REGISTRY_PATH.write_text(_json.dumps(data, indent=2), encoding="utf-8")

    return {"created": True, "project": project, "linked_source": str(source), "access_mode": req.access_mode}
