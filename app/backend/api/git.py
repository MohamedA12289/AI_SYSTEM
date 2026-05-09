import os
import subprocess
from pathlib import Path
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter(prefix="/api/git", tags=["git"])


class GitStatusResponse(BaseModel):
    branch: str
    staged: List[Dict[str, str]]
    unstaged: List[Dict[str, str]]
    ahead: int
    behind: int


class StageFilesRequest(BaseModel):
    project_path: str
    files: List[str]


class CommitRequest(BaseModel):
    project_path: str
    message: str


class CloneRequest(BaseModel):
    url: str
    target_path: str


class InitRepoRequest(BaseModel):
    project_path: str
    initial_commit: Optional[bool] = True


class SetRemoteRequest(BaseModel):
    project_path: str
    remote_url: str
    name: Optional[str] = "origin"


class PushPullRequest(BaseModel):
    project_path: str


def run_git_command(project_path: str, args: List[str]) -> subprocess.CompletedProcess:
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )
        return result
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"Git error: {e.stderr}")


@router.get("/status")
async def get_git_status(project_path: str) -> GitStatusResponse:
    if not os.path.exists(os.path.join(project_path, ".git")):
        raise HTTPException(status_code=400, detail="Not a git repository")
    
    branch_result = run_git_command(project_path, ["branch", "--show-current"])
    branch = branch_result.stdout.strip() or "HEAD detached"
    
    status_result = run_git_command(project_path, ["status", "--porcelain"])
    staged = []
    unstaged = []
    
    for line in status_result.stdout.splitlines():
        if len(line) < 4:
            continue
        index_status = line[0]
        worktree_status = line[1]
        filename = line[3:]
        
        if index_status != " " and index_status != "?":
            status_char = index_status
            if status_char == "M":
                status_char = "M"
            elif status_char == "A":
                status_char = "A"
            elif status_char == "D":
                status_char = "D"
            staged.append({"file": filename, "status": status_char})
        
        if worktree_status != " " or index_status == "?":
            status_char = worktree_status if worktree_status != " " else "?"
            if status_char == "M":
                status_char = "M"
            elif status_char == "?":
                status_char = "U"
            elif status_char == "D":
                status_char = "D"
            unstaged.append({"file": filename, "status": status_char})
    
    ahead = 0
    behind = 0
    try:
        rev_list = run_git_command(project_path, ["rev-list", "--left-right", "--count", "HEAD...@{u}"])
        parts = rev_list.stdout.strip().split()
        if len(parts) == 2:
            ahead = int(parts[0])
            behind = int(parts[1])
    except:
        pass
    
    return GitStatusResponse(
        branch=branch,
        staged=staged,
        unstaged=unstaged,
        ahead=ahead,
        behind=behind
    )


@router.post("/stage")
async def stage_files(request: StageFilesRequest):
    for file in request.files:
        run_git_command(request.project_path, ["add", file])
    return {"success": True, "message": f"Staged {len(request.files)} file(s)"}


@router.post("/unstage")
async def unstage_files(request: StageFilesRequest):
    for file in request.files:
        run_git_command(request.project_path, ["restore", "--staged", file])
    return {"success": True, "message": f"Unstaged {len(request.files)} file(s)"}


@router.post("/commit")
async def commit_changes(request: CommitRequest):
    if not request.message:
        raise HTTPException(status_code=400, detail="Commit message cannot be empty")
    
    result = run_git_command(request.project_path, ["commit", "-m", request.message])
    return {"success": True, "message": "Commit created", "output": result.stdout}


@router.post("/push")
async def push_changes(request: PushPullRequest):
    result = run_git_command(request.project_path, ["push"])
    return {"success": True, "output": result.stdout + result.stderr}


@router.post("/pull")
async def pull_changes(request: PushPullRequest):
    result = run_git_command(request.project_path, ["pull"])
    return {"success": True, "output": result.stdout + result.stderr}


@router.get("/branches")
async def list_branches(project_path: str) -> List[str]:
    result = run_git_command(project_path, ["branch", "--list"])
    branches = []
    for line in result.stdout.splitlines():
        branch = line.strip().lstrip("* ")
        if branch:
            branches.append(branch)
    return branches


@router.post("/checkout")
async def checkout_branch(project_path: str, branch: str):
    result = run_git_command(project_path, ["checkout", branch])
    return {"success": True, "output": result.stdout}


async def stream_clone_progress(url: str, target_path: str):
    process = await asyncio.create_subprocess_exec(
        "git", "clone", "--progress", url, target_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    while True:
        line = await process.stderr.readline()
        if not line:
            break
        yield f"data: {line.decode()}\n\n"
    
    await process.wait()
    
    if process.returncode == 0:
        yield f"data: CLONE_COMPLETE\n\n"
    else:
        yield f"data: CLONE_FAILED: {process.returncode}\n\n"


@router.post("/clone")
async def clone_repository(request: CloneRequest):
    if os.path.exists(request.target_path):
        raise HTTPException(status_code=400, detail="Target path already exists")

    return StreamingResponse(
        stream_clone_progress(request.url, request.target_path),
        media_type="text/event-stream"
    )


@router.post("/init")
async def init_repository(request: InitRepoRequest):
    proj = Path(request.project_path)
    if not proj.exists() or not proj.is_dir():
        raise HTTPException(status_code=400, detail="project_path does not exist")
    if (proj / ".git").exists():
        return {"success": True, "already_initialized": True}
    try:
        subprocess.run(["git", "init"], cwd=str(proj), capture_output=True, text=True, check=True)
        if request.initial_commit:
            subprocess.run(["git", "add", "-A"], cwd=str(proj), capture_output=True, text=True)
            commit = subprocess.run(
                ["git", "commit", "-m", "Initial commit", "--allow-empty"],
                cwd=str(proj), capture_output=True, text=True,
            )
            return {
                "success": True,
                "already_initialized": False,
                "initial_commit": commit.returncode == 0,
                "output": (commit.stdout or "") + (commit.stderr or ""),
            }
        return {"success": True, "already_initialized": False}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"Git init failed: {e.stderr}")


@router.post("/set-remote")
async def set_remote(request: SetRemoteRequest):
    proj = Path(request.project_path)
    if not (proj / ".git").exists():
        raise HTTPException(status_code=400, detail="Not a git repository")
    name = request.name or "origin"
    subprocess.run(["git", "remote", "remove", name], cwd=str(proj), capture_output=True, text=True)
    add = subprocess.run(
        ["git", "remote", "add", name, request.remote_url],
        cwd=str(proj), capture_output=True, text=True,
    )
    if add.returncode != 0:
        raise HTTPException(status_code=400, detail=f"Failed to set remote: {add.stderr}")
    return {"success": True, "remote": name, "url": request.remote_url}
