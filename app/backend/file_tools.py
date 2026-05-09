
from pathlib import Path
from config import WORKSPACES_BASE_PATH, SELF_UPGRADE_PROJECT_NAME, SELF_UPGRADE_SCOPE_PATH, PROTECTED_SELF_UPGRADE_PATH_PREFIXES
from memory import validate_project_name

def is_self_upgrade_project(project_name: str) -> bool:
    return str(project_name).strip() == SELF_UPGRADE_PROJECT_NAME

def get_project_root(project_name: str) -> Path:
    validate_project_name(project_name)
    if is_self_upgrade_project(project_name):
        return SELF_UPGRADE_SCOPE_PATH.resolve()
    try:
        from project_registry import get_registered_project
        entry = get_registered_project(project_name)
        workspace_root = entry.get("workspace_root")
        if workspace_root:
            p = Path(workspace_root).resolve()
            p.mkdir(parents=True, exist_ok=True)
            return p
    except Exception:
        pass
    project_root = (WORKSPACES_BASE_PATH / project_name).resolve()
    project_root.mkdir(parents=True, exist_ok=True)
    return project_root

def get_project_scope_info(project_name: str) -> dict:
    project_root = get_project_root(project_name)
    return {
        "project_name": project_name,
        "scope_mode": "self_upgrade" if is_self_upgrade_project(project_name) else "workspace_only",
        "root_path": str(project_root),
    }

def _validate_self_upgrade_target(target_path: Path):
    normalized = str(target_path).replace("\\", "/").lower()
    for blocked in PROTECTED_SELF_UPGRADE_PATH_PREFIXES:
        blocked_normalized = str(Path(blocked).resolve()).replace("\\", "/").lower()
        if normalized == blocked_normalized or normalized.startswith(blocked_normalized + "/"):
            raise ValueError("That path is protected during self-upgrade operations.")

def resolve_safe_path(project_name: str, relative_path: str) -> Path:
    if relative_path is None:
        raise ValueError("Path cannot be empty.")
    clean_relative_path = relative_path.strip()
    if not clean_relative_path:
        raise ValueError("Path cannot be empty.")

    project_root = get_project_root(project_name)
    target_path = (project_root / clean_relative_path).resolve()

    if target_path != project_root and project_root not in target_path.parents:
        raise ValueError("Path is outside the project workspace.")

    if is_self_upgrade_project(project_name):
        _validate_self_upgrade_target(target_path)

    return target_path

def list_directory(project_name: str, subpath: str = "") -> dict:
    project_root = get_project_root(project_name)
    target_dir = project_root if not subpath else resolve_safe_path(project_name, subpath)
    if not target_dir.exists():
        raise FileNotFoundError("Directory does not exist.")
    if not target_dir.is_dir():
        raise NotADirectoryError("Target path is not a directory.")
    items = []
    for item in sorted(target_dir.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        relative_path = item.relative_to(project_root)
        items.append({
            "name": item.name,
            "path": str(relative_path).replace("\\", "/"),
            "type": "directory" if item.is_dir() else "file",
            "size": item.stat().st_size if item.is_file() else None
        })
    current_path = ""
    if target_dir != project_root:
        current_path = str(target_dir.relative_to(project_root)).replace("\\", "/")
    scope_info = get_project_scope_info(project_name)
    return {
        "project_name": project_name,
        "current_path": current_path,
        "scope_mode": scope_info["scope_mode"],
        "root_path": scope_info["root_path"],
        "items": items
    }

def read_text_file(project_name: str, relative_path: str) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    if not target_file.exists():
        raise FileNotFoundError("File does not exist.")
    if target_file.is_dir():
        raise IsADirectoryError("Target path is a directory, not a file.")
    try:
        content = target_file.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise ValueError("This file is not a readable UTF-8 text file.")
    return {
        "project_name": project_name,
        "path": relative_path,
        "content": content
    }


def read_text_file_range(project_name: str, relative_path: str, start_line: int = 1, end_line: int | None = None) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    if not target_file.exists():
        raise FileNotFoundError("File does not exist.")
    if target_file.is_dir():
        raise IsADirectoryError("Target path is a directory, not a file.")
    try:
        lines = target_file.read_text(encoding="utf-8").splitlines(keepends=True)
    except UnicodeDecodeError:
        raise ValueError("This file is not a readable UTF-8 text file.")
    total_lines = len(lines)
    s = max(1, start_line) - 1
    e = min(total_lines, end_line) if end_line is not None else total_lines
    chunk = "".join(lines[s:e])
    return {
        "project_name": project_name,
        "path": relative_path,
        "start_line": s + 1,
        "end_line": min(e, total_lines),
        "total_lines": total_lines,
        "content": chunk,
    }


def write_new_file(project_name: str, relative_path: str, content: str) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    if target_file.exists():
        raise FileExistsError("File already exists. Use overwrite instead.")
    target_file.parent.mkdir(parents=True, exist_ok=True)
    target_file.write_text(content, encoding="utf-8")
    return {
        "status": "created",
        "project_name": project_name,
        "path": relative_path
    }

def overwrite_file(project_name: str, relative_path: str, content: str) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    if not target_file.exists():
        raise FileNotFoundError("File does not exist. Use write to create it first.")
    if target_file.is_dir():
        raise IsADirectoryError("Target path is a directory, not a file.")
    target_file.write_text(content, encoding="utf-8")
    return {
        "status": "overwritten",
        "project_name": project_name,
        "path": relative_path
    }


def delete_file(project_name: str, relative_path: str) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    if not target_file.exists():
        raise FileNotFoundError("File does not exist.")
    if target_file.is_dir():
        raise IsADirectoryError("Use a directory removal API for directories.")
    target_file.unlink()
    return {
        "status": "deleted",
        "project_name": project_name,
        "path": relative_path
    }
