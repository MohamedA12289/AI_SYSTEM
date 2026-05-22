import os
import secrets
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/github/auth", tags=["github-auth"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

auth_sessions = {}


class GitHubAuthStatus(BaseModel):
    authenticated: bool
    username: Optional[str] = None
    auth_method: Optional[str] = None


class PATAuthRequest(BaseModel):
    token: str


def _oauth_config_status() -> dict:
    client_id_present = bool(GITHUB_CLIENT_ID)
    client_secret_present = bool(GITHUB_CLIENT_SECRET)
    return {
        "configured": client_id_present and client_secret_present,
        "client_id_present": client_id_present,
        "client_secret_present": client_secret_present,
    }


def _oauth_not_configured_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": "GitHub OAuth not configured",
            "configured": False,
            "client_id_present": bool(GITHUB_CLIENT_ID),
            "client_secret_present": bool(GITHUB_CLIENT_SECRET),
        },
    )


@router.get("/config")
async def get_oauth_config():
    return _oauth_config_status()


@router.get("/initiate")
async def initiate_oauth():
    if not _oauth_config_status()["configured"]:
        return _oauth_not_configured_response()
    
    state = secrets.token_urlsafe(32)
    auth_sessions[state] = {"authenticated": False}
    
    auth_url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=repo,user&state={state}"
    
    return {"auth_url": auth_url, "state": state}


@router.get("/callback")
async def oauth_callback(code: str = Query(...), state: str = Query(...)):
    if state not in auth_sessions:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    if not _oauth_config_status()["configured"]:
        return _oauth_not_configured_response()
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "state": state
            },
            headers={"Accept": "application/json"}
        )
        
        token_data = token_response.json()
        if "access_token" not in token_data:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        access_token = token_data["access_token"]
        
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        user_data = user_response.json()
        username = user_data.get("login", "unknown")
        
        auth_sessions[state] = {
            "authenticated": True,
            "username": username,
            "token": access_token,
            "auth_method": "oauth"
        }
    
    return {
        "success": True,
        "message": "Authentication successful! You can close this window.",
        "username": username
    }


@router.get("/status")
async def get_auth_status(state: str = Query(...)) -> GitHubAuthStatus:
    session = auth_sessions.get(state, {})
    return GitHubAuthStatus(
        authenticated=session.get("authenticated", False),
        username=session.get("username"),
        auth_method=session.get("auth_method")
    )


@router.post("/pat")
async def authenticate_with_pat(request: PATAuthRequest):
    async with httpx.AsyncClient() as client:
        try:
            user_response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {request.token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            user_data = user_response.json()
            username = user_data.get("login", "unknown")
            
            state = secrets.token_urlsafe(32)
            auth_sessions[state] = {
                "authenticated": True,
                "username": username,
                "token": request.token,
                "auth_method": "pat"
            }
            
            return {
                "success": True,
                "username": username,
                "state": state
            }
        except httpx.HTTPError as e:
            raise HTTPException(status_code=400, detail=f"GitHub API error: {str(e)}")


@router.get("/token")
async def get_token(state: str = Query(...)) -> Optional[str]:
    session = auth_sessions.get(state, {})
    return session.get("token")


class CreateRepoRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    private: Optional[bool] = True
    project_path: Optional[str] = None
    state: str
    push: Optional[bool] = True


@router.post("/repos/create")
async def create_github_repo(request: CreateRepoRequest):
    session = auth_sessions.get(request.state, {})
    token = session.get("token")
    username = session.get("username")
    if not token or not username:
        raise HTTPException(status_code=401, detail="Not authenticated. Please sign in to GitHub first.")

    repo_name = (request.name or "").strip()
    if not repo_name:
        raise HTTPException(status_code=400, detail="Repository name is required")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
            json={
                "name": repo_name,
                "description": request.description or "",
                "private": bool(request.private),
                "auto_init": False,
            },
        )
        if resp.status_code not in (200, 201):
            try:
                detail = resp.json().get("message", resp.text)
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=f"GitHub API error: {detail}")
        repo_data = resp.json()

    clone_url = repo_data.get("clone_url", "")
    html_url = repo_data.get("html_url", "")
    push_output = ""

    if request.push and request.project_path:
        import subprocess as _sp
        from pathlib import Path as _Path
        proj = _Path(request.project_path)
        if not proj.exists() or not proj.is_dir():
            raise HTTPException(status_code=400, detail="project_path does not exist")
        if not (proj / ".git").exists():
            _sp.run(["git", "init"], cwd=str(proj), capture_output=True, text=True)
            _sp.run(["git", "add", "-A"], cwd=str(proj), capture_output=True, text=True)
            _sp.run(["git", "commit", "-m", "Initial commit"], cwd=str(proj), capture_output=True, text=True)

        authed_url = clone_url.replace("https://", f"https://{username}:{token}@")
        rm = _sp.run(["git", "remote", "remove", "origin"], cwd=str(proj), capture_output=True, text=True)
        add = _sp.run(["git", "remote", "add", "origin", authed_url], cwd=str(proj), capture_output=True, text=True)

        branch_proc = _sp.run(["git", "branch", "--show-current"], cwd=str(proj), capture_output=True, text=True)
        branch = (branch_proc.stdout or "").strip() or "main"
        _sp.run(["git", "branch", "-M", branch], cwd=str(proj), capture_output=True, text=True)

        push = _sp.run(["git", "push", "-u", "origin", branch], cwd=str(proj), capture_output=True, text=True)
        push_output = (push.stdout or "") + (push.stderr or "")

        _sp.run(["git", "remote", "set-url", "origin", clone_url], cwd=str(proj), capture_output=True, text=True)

    return {
        "success": True,
        "repo": {
            "name": repo_data.get("name"),
            "full_name": repo_data.get("full_name"),
            "html_url": html_url,
            "clone_url": clone_url,
            "private": repo_data.get("private"),
        },
        "push_output": push_output,
    }
