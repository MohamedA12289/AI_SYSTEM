
from datetime import datetime, timezone
import json

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

def ensure_projects_registry() -> None:
    CONFIGS_BASE_PATH.mkdir(parents=True, exist_ok=True)
    if not PROJECTS_REGISTRY_PATH.exists():
        data = {"projects": [_self_upgrade_entry()]}
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
    return read_projects_registry()

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
