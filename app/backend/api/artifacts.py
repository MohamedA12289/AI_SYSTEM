import os
from pathlib import Path
from typing import List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


class ArtifactItem(BaseModel):
    id: str
    filename: str
    language: str
    content: str
    thread_id: str


class ApplyArtifactRequest(BaseModel):
    project_path: str
    relative_path: str


@router.get("")
async def get_artifacts(thread_id: str) -> List[Dict]:
    return []


@router.post("/{artifact_id}/apply")
async def apply_artifact(artifact_id: str, request: ApplyArtifactRequest):
    target_path = Path(request.project_path) / request.relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    return {"success": True, "message": f"Artifact applied to {request.relative_path}"}
