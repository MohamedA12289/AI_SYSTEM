from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import CONFIGS_BASE_PATH
from file_tools import get_project_root, read_text_file, resolve_safe_path
from memory import ensure_project_memory
from ollama_client import ask_ollama

router = APIRouter(tags=["wave2"])

GITHUB_LINKS_PATH = CONFIGS_BASE_PATH / "github_links.json"
MAX_ANALYSIS_FILES = 12
MAX_TREE_ITEMS = 250


class WorkspaceAnalyzeRequest(BaseModel):
    focus: str | None = None
    prompt: str | None = None
    paths: list[str] | None = None
    file_paths: list[str] | None = None
    include_files: list[str] | None = None
    max_files: int = 8
    max_chars_per_file: int = 12000


class PairReviewRequest(BaseModel):
    prompt: str = "Review this code and tell me the most important issues and improvements."
    paths: list[str] | None = None
    file_paths: list[str] | None = None
    include_files: list[str] | None = None
    max_chars_per_file: int = 12000


class PairPlanRequest(BaseModel):
    prompt: str = "Create a practical implementation plan for this change."
    paths: list[str] | None = None
    file_paths: list[str] | None = None
    include_files: list[str] | None = None
    max_chars_per_file: int = 12000


class RefactorPreviewRequest(BaseModel):
    prompt: str = "Refactor this file and explain the safest next change."
    path: str | None = None
    file_path: str | None = None
    max_chars: int = 20000


class CoWorkInstructionRequest(BaseModel):
    instruction: str | None = None
    prompt: str | None = None
    paths: list[str] | None = None
    file_paths: list[str] | None = None
    include_files: list[str] | None = None
    mode: str = "review"
    max_chars_per_file: int = 12000


class CliExplainCommandRequest(BaseModel):
    command: list[str]


class CliGenerateCommandRequest(BaseModel):
    objective: str
    preferred_executable: str | None = None


class GitHubRepoLinkRequest(BaseModel):
    owner: str | None = None
    repo: str | None = None
    repo_url: str | None = None
    url: str | None = None
    default_branch: str = "main"


class GitCommitRequest(BaseModel):
    message: str = "CubOS commit"
    paths: list[str] | None = None


class PullRequestDraftRequest(BaseModel):
    title: str
    body: str = ""
    head_branch: str | None = None
    base_branch: str = "main"
    draft: bool = True


def _ensure_json_file(path: Path, default_value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(default_value, indent=2), encoding="utf-8")


def _read_json_file(path: Path, default_value: dict) -> dict:
    _ensure_json_file(path, default_value)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            return value
    except Exception:
        pass
    return default_value.copy()


def _write_json_file(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def _normalize_limit(value: int, default_value: int, max_value: int) -> int:
    try:
        number = int(value)
    except Exception:
        number = default_value
    if number <= 0:
        number = default_value
    if number > max_value:
        number = max_value
    return number


def _trim_text(text: str, limit: int) -> str:
    if len(text) > limit:
        return text[:limit] + "\n\n[truncated]"
    return text


def _coalesce_text(*values, default: str = "") -> str:
    for value in values:
        if value not in (None, ""):
            return str(value)
    return default


def _normalize_paths(*candidate_lists) -> list[str]:
    seen = set()
    out = []
    for candidate in candidate_lists:
        if not candidate:
            continue
        for item in candidate:
            text = str(item or "").strip()
            if text and text not in seen:
                seen.add(text)
                out.append(text)
    return out


def _is_likely_text_file(path: Path) -> bool:
    text_suffixes = {
        ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
        ".toml", ".ini", ".cfg", ".env", ".html", ".css", ".scss", ".sql", ".xml",
        ".java", ".go", ".rs", ".cpp", ".c", ".cs", ".php", ".rb", ".swift", ".kt",
        ".sh", ".bat", ".ps1", ".log"
    }
    return path.suffix.lower() in text_suffixes


def _workspace_tree(project_name: str, max_items: int = MAX_TREE_ITEMS) -> list[dict]:
    project_root = get_project_root(project_name)
    items: list[dict] = []

    for current_root, dirnames, filenames in os.walk(project_root):
        current_root_path = Path(current_root)
        dirnames.sort()
        filenames.sort()

        for dirname in dirnames:
            if len(items) >= max_items:
                return items
            path = current_root_path / dirname
            rel = str(path.relative_to(project_root)).replace("\\", "/")
            items.append({"path": rel, "type": "directory"})

        for filename in filenames:
            if len(items) >= max_items:
                return items
            path = current_root_path / filename
            rel = str(path.relative_to(project_root)).replace("\\", "/")
            items.append({"path": rel, "type": "file", "size": path.stat().st_size})

    return items


def _auto_text_files(project_name: str, max_files: int) -> list[str]:
    project_root = get_project_root(project_name)
    chosen: list[str] = []

    for current_root, _, filenames in os.walk(project_root):
        current_root_path = Path(current_root)
        for filename in sorted(filenames):
            if len(chosen) >= max_files:
                return chosen
            path = current_root_path / filename
            if _is_likely_text_file(path):
                rel = str(path.relative_to(project_root)).replace("\\", "/")
                chosen.append(rel)

    return chosen


def _read_bundle(project_name: str, paths: list[str], max_chars_per_file: int, max_files: int) -> list[dict]:
    bundle: list[dict] = []
    unique_paths = []
    seen = set()

    for path in paths:
        cleaned = str(path or "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique_paths.append(cleaned)

    for path in unique_paths[:max_files]:
        try:
            result = read_text_file(project_name, path)
            content = str(result.get("content", ""))
            bundle.append({"path": path, "content": _trim_text(content, max_chars_per_file)})
        except Exception as exc:
            bundle.append({"path": path, "error": str(exc)})

    return bundle


def _github_links() -> dict:
    return _read_json_file(GITHUB_LINKS_PATH, {"projects": {}})


def _save_github_links(data: dict) -> None:
    _write_json_file(GITHUB_LINKS_PATH, data)


def _get_linked_repo(project_name: str) -> dict | None:
    data = _github_links()
    projects = data.get("projects", {})
    if isinstance(projects, dict):
        value = projects.get(project_name)
        if isinstance(value, dict):
            return value
    return None


def _parse_repo_url(url: str) -> tuple[str, str] | None:
    clean = str(url or "").strip().rstrip("/")
    if not clean:
        return None
    if clean.endswith(".git"):
        clean = clean[:-4]
    parts = clean.split("/")
    if len(parts) < 2:
        return None
    owner = parts[-2].strip()
    repo = parts[-1].strip()
    if owner and repo:
        return owner, repo
    return None


def _set_linked_repo(project_name: str, owner: str, repo: str, default_branch: str) -> dict:
    data = _github_links()
    projects = data.get("projects")
    if not isinstance(projects, dict):
        projects = {}
        data["projects"] = projects

    linked = {"owner": owner.strip(), "repo": repo.strip(), "default_branch": default_branch.strip() or "main"}
    projects[project_name] = linked
    _save_github_links(data)
    return linked


def _git_run(project_name: str, command: list[str]) -> dict:
    project_root = get_project_root(project_name)
    try:
        result = subprocess.run(command, cwd=str(project_root), capture_output=True, text=True, shell=False)
        return {
            "command": command,
            "cwd": str(project_root),
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except Exception as exc:
        raise ValueError(str(exc))


def _git_is_repo(project_name: str) -> bool:
    result = _git_run(project_name, ["git", "rev-parse", "--is-inside-work-tree"])
    return result.get("exit_code") == 0 and "true" in str(result.get("stdout", "")).lower()


def _ensure_git_repository(project_name: str) -> bool:
    initialized = False
    if not _git_is_repo(project_name):
        init_result = _git_run(project_name, ["git", "init", "-b", "main"])
        if init_result.get("exit_code") != 0:
            init_result = _git_run(project_name, ["git", "init"])
            if init_result.get("exit_code") != 0:
                raise HTTPException(status_code=400, detail=init_result)
            _git_run(project_name, ["git", "checkout", "-B", "main"])
        initialized = True

    name_result = _git_run(project_name, ["git", "config", "user.name"])
    if not str(name_result.get("stdout", "")).strip():
        _git_run(project_name, ["git", "config", "user.name", "CubOS"])

    email_result = _git_run(project_name, ["git", "config", "user.email"])
    if not str(email_result.get("stdout", "")).strip():
        _git_run(project_name, ["git", "config", "user.email", "cubos@example.com"])

    return initialized


def _require_github_token() -> str:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        raise ValueError("GITHUB_TOKEN is missing. Add it to your secrets .env file before using GitHub PR creation.")
    return token


def _github_api_request(method: str, url: str, payload: dict | None = None) -> dict:
    token = _require_github_token()
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "CubOS-Wave2",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw.strip() else {}
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8", errors="replace")
        except Exception:
            detail = ""
        raise ValueError(f"GitHub API error {exc.code}: {detail[:500]}")
    except URLError as exc:
        raise ValueError(f"Could not reach GitHub API: {exc.reason}")


def _current_git_branch(project_name: str) -> str:
    result = _git_run(project_name, ["git", "branch", "--show-current"])
    branch = result.get("stdout", "").strip()
    return branch or "main"


@router.post("/project/{project_name}/workspace/analyze")
def analyze_workspace(project_name: str, request: WorkspaceAnalyzeRequest):
    ensure_project_memory(project_name)
    max_files = _normalize_limit(request.max_files, 8, MAX_ANALYSIS_FILES)
    max_chars = _normalize_limit(request.max_chars_per_file, 12000, 30000)

    selected_paths = _normalize_paths(request.paths, request.file_paths, request.include_files)
    if not selected_paths:
        selected_paths = _auto_text_files(project_name, max_files)
    tree = _workspace_tree(project_name)
    bundle = _read_bundle(project_name, selected_paths, max_chars, max_files)
    focus = _coalesce_text(request.focus, request.prompt, default="Give a broad high-level analysis.")

    prompt = f"""
You are helping analyze a local coding workspace.

Project name: {project_name}
Focus request: {focus}

Workspace tree snapshot:
{json.dumps(tree, indent=2)}

Selected file bundle:
{json.dumps(bundle, indent=2)}

Please produce:
1. A short high-level summary
2. The likely architecture/components
3. The most important risks/issues
4. The best next coding steps

Be practical and concise.
"""

    analysis = ask_ollama(prompt)
    return {"project_name": project_name, "selected_paths": selected_paths, "tree_items": len(tree), "analysis": analysis}


@router.post("/project/{project_name}/pair/review")
def pair_review(project_name: str, request: PairReviewRequest):
    ensure_project_memory(project_name)
    max_chars = _normalize_limit(request.max_chars_per_file, 12000, 30000)
    reviewed_paths = _normalize_paths(request.paths, request.file_paths, request.include_files)
    if not reviewed_paths:
        reviewed_paths = _auto_text_files(project_name, 6)
    bundle = _read_bundle(project_name, reviewed_paths, max_chars, MAX_ANALYSIS_FILES)

    prompt = f"""
You are an AI pair programmer reviewing local project files.

User review request:
{request.prompt}

Project name:
{project_name}

Files:
{json.dumps(bundle, indent=2)}

Please provide:
- the biggest correctness issues
- the biggest maintainability issues
- likely bugs
- suggested next fixes
- keep it concise and practical
"""

    review = ask_ollama(prompt)
    return {"project_name": project_name, "review": review, "reviewed_paths": reviewed_paths}


@router.post("/project/{project_name}/pair/plan")
def pair_plan(project_name: str, request: PairPlanRequest):
    ensure_project_memory(project_name)
    max_chars = _normalize_limit(request.max_chars_per_file, 12000, 30000)
    selected_paths = _normalize_paths(request.paths, request.file_paths, request.include_files)
    if not selected_paths:
        selected_paths = _auto_text_files(project_name, 6)
    bundle = _read_bundle(project_name, selected_paths, max_chars, 6)

    prompt = f"""
You are an AI pair programmer planning a change in a local project.

Project name:
{project_name}

Requested change:
{request.prompt}

Relevant files:
{json.dumps(bundle, indent=2)}

Please produce:
1. files likely to change
2. implementation plan
3. risks
4. test ideas
5. a concise final recommendation
"""

    plan = ask_ollama(prompt)
    return {"project_name": project_name, "selected_paths": selected_paths, "plan": plan}


@router.post("/project/{project_name}/pair/refactor-preview")
def refactor_preview(project_name: str, request: RefactorPreviewRequest):
    ensure_project_memory(project_name)
    max_chars = _normalize_limit(request.max_chars, 20000, 50000)
    target_path = _coalesce_text(request.path, request.file_path, default="")
    if not target_path:
        raise HTTPException(status_code=400, detail="A target file path is required.")
    try:
        file_data = read_text_file(project_name, target_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    content = _trim_text(str(file_data.get("content", "")), max_chars)

    prompt = f"""
You are an AI pair programmer preparing a refactor preview.

Project name:
{project_name}

Refactor request:
{request.prompt}

Target file:
{target_path}

Current file content:
{content}

Please provide:
1. what should change
2. why
3. a refactor preview in plain language
4. testing recommendations

Do not claim the file is already changed.
"""

    preview = ask_ollama(prompt)
    return {"project_name": project_name, "path": target_path, "preview": preview}


@router.post("/project/{project_name}/cowork/instruction")
def cowork_instruction(project_name: str, request: CoWorkInstructionRequest):
    ensure_project_memory(project_name)
    max_chars = _normalize_limit(request.max_chars_per_file, 12000, 30000)
    selected_paths = _normalize_paths(request.paths, request.file_paths, request.include_files)
    if not selected_paths:
        selected_paths = _auto_text_files(project_name, 6)
    bundle = _read_bundle(project_name, selected_paths, max_chars, 6)
    tree = _workspace_tree(project_name, max_items=120)
    instruction = _coalesce_text(request.instruction, request.prompt, default="Help me think through this workspace change.")

    prompt = f"""
You are in cowork mode for a local workspace.

Project name:
{project_name}

Mode:
{request.mode}

User instruction:
{instruction}

Workspace tree:
{json.dumps(tree, indent=2)}

Relevant files:
{json.dumps(bundle, indent=2)}

Respond with:
1. Your understanding of the instruction
2. The exact file/work areas involved
3. A step-by-step cowork plan
4. Risks or blockers
5. The best immediate next action
"""

    response = ask_ollama(prompt)
    return {"project_name": project_name, "mode": request.mode, "selected_paths": selected_paths, "response": response}


@router.post("/project/{project_name}/cli/explain-command")
def cli_explain_command(project_name: str, request: CliExplainCommandRequest):
    ensure_project_memory(project_name)
    command_text = " ".join([str(x) for x in request.command])

    prompt = f"""
You are helping a developer understand a CLI command.

Project name:
{project_name}

Command:
{command_text}

Explain:
1. what it does
2. what each important flag/argument means
3. likely risks
4. when to use it
5. what to verify after running it

Be concise and practical.
"""

    explanation = ask_ollama(prompt)
    return {"project_name": project_name, "command": request.command, "explanation": explanation}


@router.post("/project/{project_name}/cli/generate-command")
def cli_generate_command(project_name: str, request: CliGenerateCommandRequest):
    ensure_project_memory(project_name)

    prompt = f"""
You are generating a CLI command for a developer.

Project name:
{project_name}

Objective:
{request.objective}

Preferred executable:
{request.preferred_executable or 'none'}

Please return:
1. the recommended command as a JSON array of strings
2. a one-paragraph explanation
3. any risks or checks

Important:
- prefer python, py, node, npm, npx, pytest, git
- do not use shell operators like && or |
- keep it safe and direct
"""

    generated = ask_ollama(prompt)
    return {"project_name": project_name, "objective": request.objective, "generated": generated}


@router.get("/project/{project_name}/github/repo")
def get_linked_repo(project_name: str):
    linked = _get_linked_repo(project_name)
    return {"project_name": project_name, "linked_repo": linked}


@router.post("/project/{project_name}/github/repo")
def link_repo(project_name: str, request: GitHubRepoLinkRequest):
    ensure_project_memory(project_name)
    owner = request.owner
    repo = request.repo
    parsed = _parse_repo_url(_coalesce_text(request.repo_url, request.url, default=""))
    if parsed and (not owner or not repo):
        owner, repo = parsed
    if not owner or not repo:
        raise HTTPException(status_code=400, detail="owner/repo or repo_url is required.")
    linked = _set_linked_repo(project_name=project_name, owner=owner, repo=repo, default_branch=request.default_branch)
    return {"project_name": project_name, "linked_repo": linked}


@router.get("/project/{project_name}/github/status")
def github_status(project_name: str):
    ensure_project_memory(project_name)
    status_result = _git_run(project_name, ["git", "status", "--short", "--branch"])
    return {"project_name": project_name, "git_status": status_result, "linked_repo": _get_linked_repo(project_name)}


@router.get("/project/{project_name}/github/branches")
def github_branches(project_name: str):
    ensure_project_memory(project_name)
    result = _git_run(project_name, ["git", "branch", "--list"])
    branches = [line.strip() for line in result.get("stdout", "").splitlines() if line.strip()]
    return {"project_name": project_name, "branches": branches, "raw": result}


@router.post("/project/{project_name}/github/commit")
def github_commit(project_name: str, request: GitCommitRequest):
    ensure_project_memory(project_name)
    initialized = _ensure_git_repository(project_name)

    if request.paths:
        normalized_paths = []
        for path in request.paths:
            resolve_safe_path(project_name, path)
            normalized_paths.append(path)
        add_result = _git_run(project_name, ["git", "add", "--"] + normalized_paths)
    else:
        add_result = _git_run(project_name, ["git", "add", "-A"])

    if add_result.get("exit_code") != 0:
        raise HTTPException(status_code=400, detail=add_result)

    staged_check = _git_run(project_name, ["git", "diff", "--cached", "--quiet"])
    if staged_check.get("exit_code") == 0:
        return {
            "project_name": project_name,
            "initialized": initialized,
            "add_result": add_result,
            "commit_result": None,
            "message": "No staged changes to commit.",
        }

    commit_result = _git_run(project_name, ["git", "commit", "-m", request.message or "CubOS commit"])

    if commit_result.get("exit_code") != 0:
        raise HTTPException(status_code=400, detail=commit_result)

    return {"project_name": project_name, "initialized": initialized, "add_result": add_result, "commit_result": commit_result}


@router.post("/project/{project_name}/github/pull-request-draft")
def github_pull_request_draft(project_name: str, request: PullRequestDraftRequest):
    ensure_project_memory(project_name)
    linked = _get_linked_repo(project_name)
    if not linked:
        raise HTTPException(status_code=400, detail="No linked GitHub repo for this project.")

    head_branch = (request.head_branch or "").strip() or _current_git_branch(project_name)
    base_branch = request.base_branch.strip() or linked.get("default_branch", "main")

    payload = {
        "title": request.title,
        "body": request.body,
        "head": head_branch,
        "base": base_branch,
        "draft": bool(request.draft),
    }

    url = f"https://api.github.com/repos/{linked['owner']}/{linked['repo']}/pulls"

    try:
        created = _github_api_request("POST", url, payload)
        return {"project_name": project_name, "linked_repo": linked, "pull_request": created}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

