
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import uuid

from config import AI_SYSTEM_BASE_PATH

INGEST_BASE_PATH = AI_SYSTEM_BASE_PATH / "ingest" / "projects"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    temp_path.replace(path)


def get_project_ingest_root(project_name: str) -> Path:
    return INGEST_BASE_PATH / project_name


def ensure_project_ingest_dirs(project_name: str) -> dict[str, Path]:
    root = get_project_ingest_root(project_name)
    paths = {
        "root": root,
        "sources": root / "sources",
        "text": root / "text",
        "manifests": root / "manifests",
        "jobs": root / "jobs",
    }
    for path in paths.values():
        path.mkdir(parents=True, exist_ok=True)
    docs_index = root / "documents_index.json"
    jobs_index = root / "jobs_index.json"
    if not docs_index.exists():
        _write_json(docs_index, {"documents": []})
    if not jobs_index.exists():
        _write_json(jobs_index, {"jobs": []})
    return paths


def _documents_index_path(project_name: str) -> Path:
    ensure_project_ingest_dirs(project_name)
    return get_project_ingest_root(project_name) / "documents_index.json"


def _jobs_index_path(project_name: str) -> Path:
    ensure_project_ingest_dirs(project_name)
    return get_project_ingest_root(project_name) / "jobs_index.json"


def list_documents(project_name: str) -> list[dict]:
    data = _read_json(_documents_index_path(project_name), {"documents": []})
    documents = data.get("documents", [])
    return documents if isinstance(documents, list) else []


def save_documents(project_name: str, documents: list[dict]) -> None:
    _write_json(_documents_index_path(project_name), {"documents": documents})


def upsert_document(project_name: str, document: dict) -> dict:
    documents = list_documents(project_name)
    replaced = False
    for idx, existing in enumerate(documents):
        if isinstance(existing, dict) and existing.get("document_id") == document.get("document_id"):
            documents[idx] = document
            replaced = True
            break
    if not replaced:
        documents.append(document)
    save_documents(project_name, documents)
    return document


def get_document(project_name: str, document_id: str) -> dict:
    for document in list_documents(project_name):
        if isinstance(document, dict) and document.get("document_id") == document_id:
            return document
    raise FileNotFoundError("Document not found.")


def list_jobs(project_name: str) -> list[dict]:
    data = _read_json(_jobs_index_path(project_name), {"jobs": []})
    jobs = data.get("jobs", [])
    return jobs if isinstance(jobs, list) else []


def save_jobs(project_name: str, jobs: list[dict]) -> None:
    _write_json(_jobs_index_path(project_name), {"jobs": jobs})


def create_job(project_name: str, job_type: str, source_path: str, source_kind: str, access_mode: str) -> dict:
    jobs = list_jobs(project_name)
    job = {
        "job_id": uuid.uuid4().hex[:12],
        "project_name": project_name,
        "job_type": job_type,
        "source_path": source_path,
        "source_kind": source_kind,
        "access_mode": access_mode,
        "status": "queued",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "documents_indexed": 0,
        "managed_root": None,
        "error": None,
    }
    jobs.insert(0, job)
    save_jobs(project_name, jobs)
    return job


def update_job(project_name: str, job_id: str, **updates) -> dict:
    jobs = list_jobs(project_name)
    for idx, job in enumerate(jobs):
        if isinstance(job, dict) and job.get("job_id") == job_id:
            job = dict(job)
            job.update(updates)
            job["updated_at"] = _now_iso()
            jobs[idx] = job
            save_jobs(project_name, jobs)
            return job
    raise FileNotFoundError("Job not found.")


def get_job(project_name: str, job_id: str) -> dict:
    for job in list_jobs(project_name):
        if isinstance(job, dict) and job.get("job_id") == job_id:
            return job
    raise FileNotFoundError("Job not found.")


def write_text_artifact(project_name: str, document_id: str, text: str) -> str | None:
    ensure_project_ingest_dirs(project_name)
    cleaned = (text or "").strip()
    if not cleaned:
        return None
    rel_path = f"text/{document_id}.txt"
    full_path = get_project_ingest_root(project_name) / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(cleaned, encoding="utf-8")
    return rel_path.replace("\\", "/")

