
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ingest_store import list_jobs, get_job, list_documents, get_document
from wave1_ingest import (
    ingest_source,
    import_existing_project,
    summarize_document,
    search_documents,
    summarize_tabular_path,
    supported_file_families,
)

router = APIRouter()


class IngestPathRequest(BaseModel):
    source_path: str
    access_mode: str = "import"


class ImportExistingProjectRequest(BaseModel):
    project_name: str
    display_name: str | None = None
    description: str = ""
    source_path: str
    access_mode: str = "link_readonly"


@router.get("/supported-file-types")
def get_supported_file_types():
    return supported_file_families()


@router.post("/projects/import-existing")
def import_existing_project_endpoint(request: ImportExistingProjectRequest):
    try:
        return import_existing_project(
            project_name=request.project_name,
            display_name=request.display_name,
            description=request.description,
            source_path=request.source_path,
            access_mode=request.access_mode,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/project/{project_name}/ingest/file")
def ingest_file(project_name: str, request: IngestPathRequest):
    try:
        return ingest_source(
            project_name=project_name,
            source_path=request.source_path,
            source_kind="file",
            access_mode=request.access_mode,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/project/{project_name}/ingest/folder")
def ingest_folder(project_name: str, request: IngestPathRequest):
    try:
        return ingest_source(
            project_name=project_name,
            source_path=request.source_path,
            source_kind="folder",
            access_mode=request.access_mode,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/project/{project_name}/ingest/zip")
def ingest_zip(project_name: str, request: IngestPathRequest):
    try:
        return ingest_source(
            project_name=project_name,
            source_path=request.source_path,
            source_kind="zip",
            access_mode=request.access_mode,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/project/{project_name}/ingest/jobs")
def get_ingest_jobs(project_name: str):
    return {"jobs": list_jobs(project_name)}


@router.get("/project/{project_name}/ingest/jobs/{job_id}")
def get_ingest_job(project_name: str, job_id: str):
    try:
        return get_job(project_name, job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/project/{project_name}/documents")
def get_documents(project_name: str):
    return {"documents": list_documents(project_name)}


@router.get("/project/{project_name}/documents/{document_id}")
def get_document_metadata(project_name: str, document_id: str):
    try:
        return get_document(project_name, document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/project/{project_name}/documents/{document_id}/content")
def get_document_content(project_name: str, document_id: str):
    try:
        document = get_document(project_name, document_id)
        text = document.get("text_excerpt", "")
        return {
            "document_id": document_id,
            "content": text,
            "text_excerpt": text,
            "text_artifact_path": document.get("text_artifact_path"),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/project/{project_name}/documents/{document_id}/summarize")
def summarize_document_endpoint(project_name: str, document_id: str):
    try:
        return summarize_document(project_name, document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/project/{project_name}/documents/{document_id}/tabular")
def get_tabular_analysis(project_name: str, document_id: str):
    try:
        document = get_document(project_name, document_id)
        path = document.get("absolute_path")
        if not path:
            raise ValueError("Document has no path.")
        return summarize_tabular_path(Path(path))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

