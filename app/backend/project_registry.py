
from datetime import datetime, timezone
import json
import re
from pathlib import Path

from config import (
    CONFIGS_BASE_PATH,
    PROJECTS_REGISTRY_PATH,
    MEMORY_BASE_PATH,
    WORKSPACES_BASE_PATH,
    SELF_UPGRADE_PROJECT_NAME,
    SELF_UPGRADE_SCOPE_PATH,
)
from memory import ensure_project_memory, validate_project_name

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _self_upgrade_entry() -> dict:
    memory_path = str((MEMORY_BASE_PATH / SELF_UPGRADE_PROJECT_NAME).resolve())
    scope_path = str(SELF_UPGRADE_SCOPE_PATH.resolve())
    return {
        "project_name": SELF_UPGRADE_PROJECT_NAME,
        "display_name": "Self-Upgrade",
        "description": "Special workspace with access to the AI system scope.",
        "project_type": "self_upgrade",
        "workspace_root": scope_path,
        "memory_root": memory_path,
        "scope_root": scope_path,
        "archived": False,
        "created_at": _now_iso(),
    }

def _get_legacy_registry_paths() -> list[Path]:
    """Return candidate legacy registry paths from repo-root configs/."""
    candidates = []
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent
    legacy = repo_root / "configs" / "projects_registry.json"
    if legacy.exists() and legacy.resolve() != PROJECTS_REGISTRY_PATH.resolve():
        candidates.append(legacy)
    return candidates

def _import_legacy_projects(current_projects: list[dict]) -> list[dict]:
    """Import projects from legacy registry files that aren't already present."""
    existing_names = {p.get("project_name") for p in current_projects if isinstance(p, dict)}
    for legacy_path in _get_legacy_registry_paths():
        try:
            legacy_data = json.loads(legacy_path.read_text(encoding="utf-8"))
            legacy_projects = legacy_data.get("projects", []) if isinstance(legacy_data, dict) else []
            for entry in legacy_projects:
                if not isinstance(entry, dict):
                    continue
                name = entry.get("project_name")
                if not name or name == SELF_UPGRADE_PROJECT_NAME:
                    continue
                if name in existing_names:
                    continue
                workspace = entry.get("workspace_root", "")
                if workspace and not Path(workspace).exists():
                    continue
                current_projects.append(entry)
                existing_names.add(name)
        except Exception:
            pass
    return current_projects

def ensure_projects_registry() -> None:
    CONFIGS_BASE_PATH.mkdir(parents=True, exist_ok=True)
    if not PROJECTS_REGISTRY_PATH.exists():
        data: dict = {"projects": [_self_upgrade_entry()]}
        _import_legacy_projects(data["projects"])
        PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        ensure_project_memory(SELF_UPGRADE_PROJECT_NAME)
        return

    try:
        data = json.loads(PROJECTS_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        data = {"projects": []}

    if not isinstance(data, dict):
        data = {"projects": []}
    projects = data.get("projects", [])
    if not isinstance(projects, list):
        projects = []

    has_self_upgrade = any(isinstance(item, dict) and item.get("project_name") == SELF_UPGRADE_PROJECT_NAME for item in projects)
    if not has_self_upgrade:
        projects.append(_self_upgrade_entry())

    # One-time migration: import legacy projects if not already done
    migration_done_flag = CONFIGS_BASE_PATH / ".legacy_import_done"
    if not migration_done_flag.exists():
        projects = _import_legacy_projects(projects)
        migration_done_flag.write_text("1", encoding="utf-8")

    data["projects"] = projects
    PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    ensure_project_memory(SELF_UPGRADE_PROJECT_NAME)

def read_projects_registry() -> dict:
    ensure_projects_registry()
    try:
        data = json.loads(PROJECTS_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception:
        data = {"projects": []}
    if not isinstance(data, dict):
        data = {"projects": []}
    if not isinstance(data.get("projects"), list):
        data["projects"] = []
    return data

def list_registered_projects() -> dict:
    data = read_projects_registry()
    filtered_projects = [
        p for p in data.get("projects", [])
        if isinstance(p, dict) and p.get("project_name") != SELF_UPGRADE_PROJECT_NAME
    ]
    return {"projects": filtered_projects}

def get_registered_project(project_name: str) -> dict:
    validate_project_name(project_name)
    data = read_projects_registry()
    for project in data["projects"]:
        if isinstance(project, dict) and project.get("project_name") == project_name:
            return project
    raise FileNotFoundError("Project is not registered.")

def _project_exists(project_name: str) -> bool:
    data = read_projects_registry()
    return any(isinstance(project, dict) and project.get("project_name") == project_name for project in data["projects"])

def create_project(project_name: str, display_name: str | None = None, description: str = "") -> dict:
    validate_project_name(project_name)
    if project_name == SELF_UPGRADE_PROJECT_NAME:
        raise ValueError(f"'{SELF_UPGRADE_PROJECT_NAME}' is reserved.")
    if _project_exists(project_name):
        raise FileExistsError("Project already exists.")

    ensure_project_memory(project_name)
    workspace_root = (WORKSPACES_BASE_PATH / project_name).resolve()
    workspace_root.mkdir(parents=True, exist_ok=True)
    memory_root = (MEMORY_BASE_PATH / project_name).resolve()

    try:
        if not (workspace_root / ".git").exists():
            import subprocess as _sp
            _sp.run(["git", "init"], cwd=str(workspace_root), capture_output=True, text=True)
            gitignore = workspace_root / ".gitignore"
            if not gitignore.exists():
                gitignore.write_text(
                    "node_modules/\n__pycache__/\n.venv/\nvenv/\ndist/\nbuild/\n.next/\n.cache/\n*.pyc\n.DS_Store\n.env\n",
                    encoding="utf-8",
                )
            _sp.run(["git", "add", "-A"], cwd=str(workspace_root), capture_output=True, text=True)
            _sp.run(
                ["git", "commit", "-m", "Initial commit", "--allow-empty"],
                cwd=str(workspace_root), capture_output=True, text=True,
            )
    except Exception:
        pass

    entry = {
        "project_name": project_name,
        "display_name": (display_name or project_name).strip() or project_name,
        "description": str(description or "").strip(),
        "project_type": "standard",
        "workspace_root": str(workspace_root),
        "memory_root": str(memory_root),
        "scope_root": str(workspace_root),
        "archived": False,
        "created_at": _now_iso(),
    }

    data = read_projects_registry()
    data["projects"].append(entry)
    PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return entry

def import_project(path: str, display_name: str | None = None, description: str = "") -> dict:
    folder_path = Path(path).resolve()

    if not folder_path.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    if not folder_path.is_dir():
        raise ValueError(f"Path is not a directory: {path}")

    raw_name = folder_path.name.lower()
    project_name = re.sub(r'[^a-z0-9]+', '-', raw_name)
    project_name = project_name.strip('-') or 'project'

    if project_name == SELF_UPGRADE_PROJECT_NAME:
        raise ValueError(f"'{SELF_UPGRADE_PROJECT_NAME}' is reserved.")

    base_name = project_name
    counter = 1
    while _project_exists(project_name):
        project_name = f"{base_name}-{counter}"
        counter += 1
        if counter > 100:
            raise FileExistsError(base_name)

    ensure_project_memory(project_name)
    memory_root = (MEMORY_BASE_PATH / project_name).resolve()

    entry = {
        "project_name": project_name,
        "display_name": (display_name or folder_path.name).strip() or folder_path.name,
        "description": str(description or "").strip(),
        "project_type": "imported",
        "workspace_root": str(folder_path),
        "memory_root": str(memory_root),
        "scope_root": str(folder_path),
        "archived": False,
        "created_at": _now_iso(),
    }

    data = read_projects_registry()
    data["projects"].append(entry)
    PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return entry

def update_project(project_name: str, display_name: str | None = None, description: str | None = None, archived: bool | None = None) -> dict:
    validate_project_name(project_name)
    data = read_projects_registry()
    for item in data["projects"]:
        if item.get("project_name") == project_name:
            if display_name is not None:
                item["display_name"] = str(display_name).strip() or item["display_name"]
            if description is not None:
                item["description"] = str(description).strip()
            if archived is not None:
                item["archived"] = bool(archived)
            PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return item
    raise FileNotFoundError("Project is not registered.")

def delete_project(project_name: str) -> dict:
    if project_name == SELF_UPGRADE_PROJECT_NAME:
        raise ValueError("Cannot delete self-upgrade project.")
    data = read_projects_registry()
    before = len(data["projects"])
    data["projects"] = [x for x in data["projects"] if x.get("project_name") != project_name]
    if len(data["projects"]) == before:
        raise FileNotFoundError("Project is not registered.")
    PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return {"deleted": True, "project_name": project_name}
