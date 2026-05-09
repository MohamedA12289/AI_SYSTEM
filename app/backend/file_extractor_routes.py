from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from file_extractor import (
    extract_project_path,
    extract_absolute_path,
    DEFAULT_MAX_CHARS,
    DEFAULT_MAX_FILES,
)

router = APIRouter()


class ExtractRequest(BaseModel):
    path: Optional[str] = ""
    absolute_path: Optional[str] = None
    max_chars: Optional[int] = DEFAULT_MAX_CHARS
    max_files: Optional[int] = DEFAULT_MAX_FILES


@router.post("/project/{project_name}/files/extract")
def extract_in_project(project_name: str, request: ExtractRequest):
    try:
        if request.absolute_path:
            return extract_absolute_path(
                request.absolute_path,
                max_chars=request.max_chars or DEFAULT_MAX_CHARS,
                max_files=request.max_files or DEFAULT_MAX_FILES,
            )
        return extract_project_path(
            project_name,
            request.path or "",
            max_chars=request.max_chars or DEFAULT_MAX_CHARS,
            max_files=request.max_files or DEFAULT_MAX_FILES,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class ExtractAbsoluteRequest(BaseModel):
    absolute_path: str
    max_chars: Optional[int] = DEFAULT_MAX_CHARS
    max_files: Optional[int] = DEFAULT_MAX_FILES


@router.post("/files/extract-absolute")
def extract_absolute(request: ExtractAbsoluteRequest):
    try:
        return extract_absolute_path(
            request.absolute_path,
            max_chars=request.max_chars or DEFAULT_MAX_CHARS,
            max_files=request.max_files or DEFAULT_MAX_FILES,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
