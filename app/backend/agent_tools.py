from file_tools import (
    list_directory,
    read_text_file,
    write_new_file,
    overwrite_file,
    get_project_scope_info,
)
from command_tools import run_safe_command
from web_tools import fetch_url_content, search_web
from project_registry import create_project
from config import MAX_TOOL_RESULT_CHARS
from approvals import create_approval
from activity import log_activity
from secrets_manager import set_secret
from tests_manager import create_test, run_test
from snapshots import create_snapshot
from memory import read_tasks, read_notes, read_memory_entries, write_tasks, write_notes, write_memory_entries
from chat_store import append_message
from diff_tools import build_unified_diff

TOOL_SCHEMA_TEXT = """
Output exactly one JSON object. No markdown, no code fences, no explanation text.

Action schemas:

{"action": "respond", "args": {"message": "your reply text"}}
{"action": "list_files", "args": {"subpath": ""}}
{"action": "read_file", "args": {"path": "relative/path.py"}}
{"action": "write_file", "args": {"path": "relative/path.py", "content": "file content here"}}
{"action": "overwrite_file", "args": {"path": "relative/path.py", "content": "new content here"}}
{"action": "run_command", "args": {"command": ["python", "script.py"], "timeout_seconds": 30}}
{"action": "fetch_url", "args": {"url": "https://example.com", "timeout_seconds": 20}}
{"action": "web_search", "args": {"query": "search term", "max_results": 5}}
{"action": "add_task", "args": {"title": "task title", "status": "todo"}}
{"action": "add_note", "args": {"content": "note text"}}
{"action": "add_memory", "args": {"key": "key_name", "value": "value text", "pinned": false}}
{"action": "create_snapshot", "args": {"note": "snapshot description"}}

Choose the most appropriate action for the user request.
If unsure, use respond.
"""

def trim_large_text(value, limit=MAX_TOOL_RESULT_CHARS):
    if isinstance(value, str):
        if len(value) > limit:
            return value[:limit] + "\n\n[truncated]"
        return value
    if isinstance(value, dict):
        return {k: trim_large_text(v, limit) for k, v in value.items()}
    if isinstance(value, list):
        return [trim_large_text(v, limit) for v in value]
    return value

def _normalize_file_content(args: dict) -> str:
    if "content_lines" in args:
        content_lines = args.get("content_lines", [])
        if not isinstance(content_lines, list):
            raise ValueError("content_lines must be a JSON array.")
        normalized_lines = []
        for line in content_lines:
            if line is None:
                normalized_lines.append("")
            elif isinstance(line, str):
                normalized_lines.append(line)
            else:
                normalized_lines.append(str(line))
        return "\n".join(normalized_lines)
    content = args.get("content", "")
    if content is None:
        return ""
    if not isinstance(content, str):
        content = str(content)
    return content.replace("\r\n", "\n").replace("\r", "\n")

def _coerce_path_from_args(args: dict) -> str:
    raw = args.get("path") or args.get("file_path") or args.get("relative_path") or ""
    return str(raw or "").strip()



def _approval_payload(project_name: str, action: str, args: dict, summary: str) -> dict:
    approval = create_approval(project_name, approval_type=action, payload=args, summary=summary)
    log_activity(project_name, f"Approval created for {action}", summary, type="approval", metadata={"approval_id": approval["id"]})
    return {
        "executed": False,
        "requires_approval": True,
        "approval": approval,
    }

def execute_agent_action(project_name: str, action_payload: dict, allow_writes: bool = False, allow_commands: bool = False) -> dict:
    action = action_payload.get("action")
    args = action_payload.get("args", {})
    if not isinstance(args, dict):
        raise ValueError("Action args must be a JSON object.")

    if action == "respond":
        message = args.get("message", "")
        return {"executed": True, "action": "respond", "message": message}

    if action == "list_files":
        result = list_directory(project_name, args.get("subpath", ""))
        log_activity(project_name, "Listed files", args.get("subpath", ""), type="file")
        return {"executed": True, "action": "list_files", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action == "read_file":
        path = _coerce_path_from_args(args)
        result = read_text_file(project_name, path)
        log_activity(project_name, "Read file", path, type="file")
        return {"executed": True, "action": "read_file", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action in {"write_file", "overwrite_file"}:
        path = _coerce_path_from_args(args)
        content = _normalize_file_content(args)

        if not allow_writes:
            current_content = ""
            try:
                current_content = read_text_file(project_name, path).get("content", "")
            except Exception:
                current_content = ""
            diff = build_unified_diff(current_content, content, path_label=path)
            return _approval_payload(project_name, action, {"path": path, "content": content, "diff": diff}, f"{action} {path}")

        result = write_new_file(project_name, path, content) if action == "write_file" else overwrite_file(project_name, path, content)
        log_activity(project_name, "File changed", f"{action}: {path}", type="file", metadata={"path": path})
        append_message(project_name, "system", f"{action} applied to {path}", message_type="tool_result", mirror_legacy=False)
        return {"executed": True, "action": action, "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action == "run_command":
        command = args.get("command", [])
        timeout_seconds = args.get("timeout_seconds", 30)
        if not allow_commands:
            return _approval_payload(project_name, action, {"command": command, "timeout_seconds": timeout_seconds}, f"run_command {' '.join(command)}")
        result = run_safe_command(project_name, command, timeout_seconds)
        log_activity(project_name, "Command run", " ".join(command), type="command", metadata={"exit_code": result.get("exit_code")})
        return {"executed": result.get("executed", True), "action": "run_command", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action == "fetch_url":
        url = args.get("url", "")
        timeout_seconds = args.get("timeout_seconds", 20)
        result = fetch_url_content(url, timeout_seconds)
        log_activity(project_name, "Fetched URL", url, type="web")
        return {"executed": True, "action": "fetch_url", "result": trim_large_text(result)}

    if action == "web_search":
        result = search_web(
            query=args.get("query", ""),
            topic=args.get("topic", "general"),
            max_results=args.get("max_results", 5),
            search_depth=args.get("search_depth", "basic"),
            time_range=args.get("time_range"),
            timeout_seconds=args.get("timeout_seconds", 20),
        )
        log_activity(project_name, "Web search", args.get("query", ""), type="web")
        return {"executed": True, "action": "web_search", "result": trim_large_text(result)}

    if action == "create_project":
        if not allow_writes:
            return _approval_payload(project_name, action, args, f"create_project {args.get('project_name', '')}")
        result = create_project(
            project_name=args.get("project_name", ""),
            display_name=args.get("display_name"),
            description=args.get("description", ""),
        )
        log_activity(project_name, "Project created", result.get("project_name", ""), type="project")
        return {"executed": True, "action": "create_project", "result": trim_large_text(result)}

    if action == "add_task":
        data = read_tasks(project_name)
        tasks = data.get("tasks", [])
        task = {
            "id": args.get("id") or f"task_{len(tasks)+1}",
            "title": str(args.get("title", "")).strip(),
            "status": str(args.get("status", "todo")).strip() or "todo",
        }
        tasks.append(task)
        data["tasks"] = tasks
        write_tasks(project_name, data)
        log_activity(project_name, "Task added", task["title"], type="task")
        return {"executed": True, "action": "add_task", "result": task}

    if action == "add_note":
        data = read_notes(project_name)
        notes = data.get("notes", [])
        note = {
            "id": args.get("id") or f"note_{len(notes)+1}",
            "content": str(args.get("content", "")).strip(),
            "created_at": args.get("created_at"),
        }
        notes.append(note)
        data["notes"] = notes
        write_notes(project_name, data)
        log_activity(project_name, "Note added", note["content"], type="note")
        return {"executed": True, "action": "add_note", "result": note}

    if action == "add_memory":
        data = read_memory_entries(project_name)
        entries = data.get("entries", [])
        entry = {
            "id": args.get("id") or f"mem_{len(entries)+1}",
            "key": str(args.get("key", "")).strip(),
            "value": str(args.get("value", "")).strip(),
            "pinned": bool(args.get("pinned", False)),
        }
        entries.append(entry)
        data["entries"] = entries
        write_memory_entries(project_name, data)
        log_activity(project_name, "Memory added", entry["key"], type="memory")
        return {"executed": True, "action": "add_memory", "result": entry}

    if action == "set_secret":
        if not allow_writes:
            return _approval_payload(project_name, action, args, f"set_secret {args.get('key', '')}")
        result = set_secret(args.get("key", ""), args.get("value", ""))
        log_activity(project_name, "Secret updated", args.get("key", ""), type="secret")
        return {"executed": True, "action": "set_secret", "result": result}

    if action == "create_snapshot":
        if not allow_writes:
            return _approval_payload(project_name, action, args, "create_snapshot")
        result = create_snapshot(project_name, note=args.get("note", ""))
        log_activity(project_name, "Snapshot created", result.get("id", ""), type="snapshot")
        return {"executed": True, "action": "create_snapshot", "result": result}

    if action == "create_test":
        result = create_test(project_name, title=args.get("title", ""), command=args.get("command", []), timeout_seconds=args.get("timeout_seconds", 30))
        log_activity(project_name, "Test created", result.get("title", ""), type="test")
        return {"executed": True, "action": "create_test", "result": result}

    if action == "run_test":
        if not allow_commands:
            return _approval_payload(project_name, action, args, f"run_test {args.get('test_id', '')}")
        result = run_test(project_name, args.get("test_id", ""))
        log_activity(project_name, "Test run", args.get("test_id", ""), type="test")
        return {"executed": True, "action": "run_test", "result": result}

    raise ValueError(f"Unknown action: {action}")

