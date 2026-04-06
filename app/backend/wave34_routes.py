from pathlib import Path
from datetime import datetime
import json

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from media_tools import transcribe_project_media, transcribe_media_any_path
from project_registry import get_registered_project
from file_tools import get_project_root, resolve_safe_path, list_directory
from memory import append_chat
from ollama_client import ask_ollama
from web_tools import search_web

router = APIRouter()


class MediaTranscriptionRequest(BaseModel):
    path: str | None = None
    source_path: str | None = None
    file_path: str | None = None
    model_name: str = "base"
    task: str = "transcribe"
    language: str | None = None


class VoiceChatRequest(BaseModel):
    path: str | None = None
    source_path: str | None = None
    file_path: str | None = None
    model_name: str = "base"
    task: str = "transcribe"
    language: str | None = None
    prompt: str | None = None


class DeepResearchRequest(BaseModel):
    prompt: str | None = None
    query: str | None = None
    query_hints: list[str] | None = None
    topic: str = "general"
    max_results_per_query: int = 5
    save_report: bool = True


class DashboardSummaryRequest(BaseModel):
    path: str | None = None
    source_path: str | None = None
    file_path: str | None = None
    sheet_name: str | None = None
    preview_rows: int = 10


class ScaffoldRequest(BaseModel):
    kind: str = "fastapi_service"
    target_dir: str = "generated_app"
    app_name: str = "generated_app"


class ImportProjectLinkRequest(BaseModel):
    source_path: str
    mode: str | None = None
    access_mode: str | None = None


def _now_stamp() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def _safe_preview_records(df: pd.DataFrame, limit: int = 10) -> list[dict]:
    preview = df.head(limit).copy()
    preview = preview.fillna("")
    return preview.to_dict(orient="records")


def _coalesce(*values):
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _resolve_project_or_absolute_path(project_name: str, raw_path: str | None) -> Path:
    path_value = str(raw_path or "").strip()
    if not path_value:
        raise ValueError("Path cannot be empty.")
    candidate = Path(path_value)
    if candidate.is_absolute():
        if not candidate.exists():
            raise FileNotFoundError("Source path does not exist.")
        return candidate
    return resolve_safe_path(project_name, path_value)


@router.post("/projects/{project_name}/source/link")
@router.post("/project/{project_name}/source/link")
def link_project_source(project_name: str, request: ImportProjectLinkRequest):
    try:
        project = get_registered_project(project_name)
        project_root = get_project_root(project_name)
        link_dir = project_root / ".links"
        link_dir.mkdir(parents=True, exist_ok=True)

        payload = {
            "project_name": project_name,
            "source_path": request.source_path,
            "mode": str(_coalesce(request.mode, request.access_mode, "read_only")),
            "linked_at": datetime.utcnow().isoformat() + "Z",
        }

        target_file = link_dir / "linked_source.json"
        target_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        return {
            "linked": True,
            "project": project,
            "link": payload,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/project/{project_name}/media/transcribe-file")
def transcribe_file(project_name: str, request: MediaTranscriptionRequest):
    try:
        relative_or_absolute = _coalesce(request.path, request.source_path, request.file_path)
        return transcribe_media_any_path(
            project_name=project_name,
            source_path=str(relative_or_absolute or ""),
            model_name=request.model_name,
            task=request.task,
            language=request.language,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/project/{project_name}/voice/chat")
def voice_chat(project_name: str, request: VoiceChatRequest):
    try:
        relative_or_absolute = _coalesce(request.path, request.source_path, request.file_path)
        transcription = transcribe_media_any_path(
            project_name=project_name,
            source_path=str(relative_or_absolute or ""),
            model_name=request.model_name,
            task=request.task,
            language=request.language,
        )
        prompt = transcription.get("text", "").strip() or str(request.prompt or "").strip()
        if not prompt:
            prompt = "The media file was processed, but no clear speech was detected. Briefly tell the user that no clear speech was detected and suggest retrying with a clearer sample."

        append_chat(project_name, "user", f"[Voice Input] {prompt}")
        response = ask_ollama(prompt)
        append_chat(project_name, "assistant", response)

        return {
            "transcription": transcription,
            "assistant_response": response,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/project/{project_name}/research/deep-report")
def deep_research_report(project_name: str, request: DeepResearchRequest):
    try:
        primary_prompt = str(_coalesce(request.prompt, request.query, "") or "").strip()
        query_hints = request.query_hints or []

        query_candidates = [primary_prompt] if primary_prompt else []
        for hint in query_hints:
            clean = str(hint).strip()
            if clean and clean not in query_candidates:
                query_candidates.append(clean)

        query_candidates = [q for q in query_candidates if q][:3]
        if not query_candidates:
            raise ValueError("Research prompt cannot be empty.")

        aggregated_results = []
        citation_index = 1

        for query in query_candidates:
            search_result = search_web(
                query=query,
                topic=request.topic,
                max_results=request.max_results_per_query,
                search_depth="basic",
                time_range=None,
                timeout_seconds=20,
            )

            for item in search_result.get("results", []):
                aggregated_results.append({
                    "citation_id": citation_index,
                    "query": query,
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                })
                citation_index += 1

        if not aggregated_results:
            raise ValueError("No search results were found for the research request.")

        sources_block = "\n".join(
            f"[{item['citation_id']}] {item['title']} | {item['url']}\nSummary: {item['content']}"
            for item in aggregated_results
        )

        report_prompt = f"""
Create a structured research report.

User request:
{primary_prompt}

Sources:
{sources_block}

Requirements:
- Use clear sections
- Include concise findings
- Use inline citations like [1], [2]
- End with a Sources section listing all citations
"""

        report_text = ask_ollama(report_prompt)

        saved_to = None
        if request.save_report:
            reports_dir = get_project_root(project_name) / "reports"
            reports_dir.mkdir(parents=True, exist_ok=True)
            saved_to = reports_dir / f"deep_research_{_now_stamp()}.md"
            saved_to.write_text(report_text, encoding="utf-8")

        return {
            "project_name": project_name,
            "report": report_text,
            "saved_path": str(saved_to) if saved_to else None,
            "sources": aggregated_results,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/project/{project_name}/data/dashboard-summary")
def dashboard_summary(project_name: str, request: DashboardSummaryRequest):
    try:
        raw_path = _coalesce(request.path, request.source_path, request.file_path)
        target_file = _resolve_project_or_absolute_path(project_name, raw_path)
        suffix = target_file.suffix.lower()

        if suffix == ".csv":
            df = pd.read_csv(target_file)
        elif suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(target_file, sheet_name=request.sheet_name)
        else:
            raise ValueError("Only CSV, XLS, and XLSX files are supported here.")

        if not isinstance(df, pd.DataFrame):
            raise ValueError("Selected sheet did not produce a table.")

        numeric_summary = {}
        if not df.select_dtypes(include="number").empty:
            numeric_summary = df.describe(include="number").fillna("").to_dict()

        summary = {
            "project_name": project_name,
            "path": str(raw_path or ""),
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
            "column_names": [str(c) for c in df.columns.tolist()],
            "dtypes": {str(k): str(v) for k, v in df.dtypes.astype(str).to_dict().items()},
            "preview_rows": _safe_preview_records(df, request.preview_rows),
            "numeric_summary": numeric_summary,
            "directory_snapshot": list_directory(project_name).get("items", []),
        }

        return summary
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/project/{project_name}/scaffold/app")
def scaffold_app(project_name: str, request: ScaffoldRequest):
    try:
        project_root = get_project_root(project_name)
        target_dir = (project_root / request.target_dir).resolve()

        if project_root not in target_dir.parents and target_dir != project_root:
            raise ValueError("Target scaffold directory is outside the project root.")

        if target_dir.exists():
            existing_files = []
            for path in sorted(target_dir.rglob("*")):
                if path.is_file():
                    existing_files.append(str(path.relative_to(project_root)).replace("\\", "/"))
            return {
                "project_name": project_name,
                "kind": request.kind,
                "target_dir": str(target_dir.relative_to(project_root)).replace("\\", "/"),
                "created_files": existing_files,
                "reused": True,
            }

        target_dir.mkdir(parents=True, exist_ok=False)

        created_files = []

        if request.kind == "fastapi_service":
            files = {
                "main.py": f"""from fastapi import FastAPI

app = FastAPI()

@app.get(\"/\")
def home():
    return {{\"app\": \"{request.app_name}\", \"status\": \"ok\"}}
""",
                "requirements.txt": "fastapi\nuvicorn\n",
                "README.md": f"# {request.app_name}\n\nGenerated by CubOS.\n",
            }
        elif request.kind == "static_site":
            files = {
                "index.html": f"""<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{request.app_name}</title>
  <link rel=\"stylesheet\" href=\"styles.css\" />
</head>
<body>
  <main>
    <h1>{request.app_name}</h1>
    <p>Generated by CubOS.</p>
  </main>
  <script src=\"app.js\"></script>
</body>
</html>
""",
                "styles.css": "body { font-family: Arial, sans-serif; padding: 2rem; }\n",
                "app.js": "console.log('CubOS generated app loaded');\n",
                "README.md": f"# {request.app_name}\n\nGenerated by CubOS.\n",
            }
        else:
            raise ValueError("Unsupported scaffold kind.")

        for relative_name, content in files.items():
            target = target_dir / relative_name
            target.write_text(content, encoding="utf-8")
            created_files.append(str(target.relative_to(project_root)).replace("\\", "/"))

        return {
            "project_name": project_name,
            "kind": request.kind,
            "target_dir": str(target_dir.relative_to(project_root)).replace("\\", "/"),
            "created_files": created_files,
            "reused": False,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

