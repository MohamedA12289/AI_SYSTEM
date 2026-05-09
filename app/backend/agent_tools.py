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
from file_extractor import extract_project_path
from edit_tools import edit_file, preview_edit_file

TOOL_SCHEMA_TEXT = """
Output exactly one JSON object. No markdown, no code fences, no explanation text.

Action schemas:

{"action": "respond", "args": {"message": "your reply text"}}
{"action": "list_files", "args": {"subpath": ""}}
{"action": "read_file", "args": {"path": "relative/path.py"}}
{"action": "extract_file", "args": {"path": "relative/path.pdf"}}
{"action": "extract_folder", "args": {"path": "subfolder"}}
{"action": "write_file", "args": {"path": "relative/path.py", "content": "file content here"}}
{"action": "overwrite_file", "args": {"path": "relative/path.py", "content": "new content here"}}
{"action": "edit_file", "args": {"path": "relative/path.py", "edits": [{"op": "replace", "anchor": "def foo():\\n    pass", "replacement": "def foo():\\n    return 1"}, {"op": "insert_after", "anchor": "import os", "content": "\\nimport sys"}, {"op": "delete", "anchor": "old_block_here"}]}}
{"action": "run_command", "args": {"command": ["python", "script.py"], "timeout_seconds": 30}}
{"action": "fetch_url", "args": {"url": "https://example.com", "timeout_seconds": 20}}
{"action": "web_search", "args": {"query": "search term", "max_results": 5}}
{"action": "add_task", "args": {"title": "task title", "status": "todo"}}
{"action": "add_note", "args": {"content": "note text"}}
{"action": "add_memory", "args": {"key": "key_name", "value": "value text", "pinned": false}}
{"action": "create_snapshot", "args": {"note": "snapshot description"}}
{"action": "git", "args": {"op": "status"}}
{"action": "git", "args": {"op": "commit", "message": "commit message", "paths": ["optional", "list"]}}
{"action": "git", "args": {"op": "branch", "name": "feature/x", "checkout": true}}
{"action": "git", "args": {"op": "diff", "staged": false, "path": "optional/path"}}
{"action": "git", "args": {"op": "stash", "message": "wip"}}
{"action": "git", "args": {"op": "log", "limit": 20}}
{"action": "plan", "args": {"op": "create", "title": "Plan title", "items": ["step 1", "step 2"]}}
{"action": "plan", "args": {"op": "list"}}
{"action": "plan", "args": {"op": "set_status", "item_id": "...", "status": "done"}}
{"action": "pr", "args": {"op": "describe", "staged": false}}
{"action": "pr", "args": {"op": "review", "diff": "<unified diff>"}}
{"action": "pr", "args": {"op": "improve", "staged": true}}
{"action": "pr", "args": {"op": "ask", "question": "why was X changed?", "diff": "..."}}
{"action": "lsp", "args": {"op": "definition", "path": "src/x.py", "line": 10, "character": 4}}
{"action": "lsp", "args": {"op": "references", "path": "src/x.ts", "line": 3, "character": 8}}
{"action": "lsp", "args": {"op": "diagnostics", "path": "src/x.py"}}
{"action": "lsp", "args": {"op": "format", "path": "src/x.py"}}
{"action": "subagent", "args": {"task": "summarise foo.py", "role": "developer"}}
{"action": "mcp", "args": {"op": "list_servers"}}
{"action": "mcp", "args": {"op": "list_tools", "server": "fs"}}
{"action": "mcp", "args": {"op": "call", "server": "fs", "tool": "read_file", "arguments": {"path": "..."}}}
{"action": "skill", "args": {"op": "list"}}
{"action": "skill", "args": {"op": "resolve", "name": "frontend"}}
{"action": "browser", "args": {"op": "browse", "url": "https://example.com"}}
{"action": "browser", "args": {"op": "screenshot", "url": "https://example.com"}}

Use extract_file for non-text files (PDF, DOCX, PPTX, XLSX, CSV, images, HTML, EPUB, archives, audio/video).
Use read_file for plain text/code files.
Prefer edit_file over overwrite_file for small targeted changes - it is safer because each anchor must match uniquely.
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

    if action == "extract_file":
        path = _coerce_path_from_args(args)
        max_chars = int(args.get("max_chars") or 60000)
        result = extract_project_path(project_name, path, max_chars=max_chars)
        log_activity(project_name, "Extracted file", path, type="file")
        return {"executed": True, "action": "extract_file", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action == "extract_folder":
        path = _coerce_path_from_args(args)
        max_files = int(args.get("max_files") or 200)
        result = extract_project_path(project_name, path, max_files=max_files)
        log_activity(project_name, "Extracted folder", path, type="file")
        return {"executed": True, "action": "extract_folder", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

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

    if action == "edit_file":
        path = _coerce_path_from_args(args)
        edits = args.get("edits") or []
        if not isinstance(edits, list) or not edits:
            raise ValueError("edit_file requires a non-empty 'edits' list.")
        if not allow_writes:
            try:
                preview = preview_edit_file(project_name, path, edits)
            except Exception as e:
                return {"executed": False, "action": "edit_file", "error": str(e)}
            return _approval_payload(project_name, action, {"path": path, "edits": edits, "diff": preview.get("diff", "")}, f"edit_file {path}")
        result = edit_file(project_name, path, edits)
        log_activity(project_name, "File edited", f"edit_file: {path}", type="file", metadata={"path": path, "ops": result.get("applied")})
        append_message(project_name, "system", f"edit_file applied to {path}", message_type="tool_result", mirror_legacy=False)
        return {"executed": True, "action": "edit_file", "scope": get_project_scope_info(project_name), "result": trim_large_text(result)}

    if action == "git":
        from git_tools import run_git_op
        op = str(args.get("op", "")).strip().lower()
        # Mutating ops require allow_writes; read-only ops do not.
        mutating = op in {"commit", "branch", "stash", "checkout", "reset"}
        if mutating and not allow_writes:
            return _approval_payload(project_name, action, args, f"git {op}")
        try:
            result = run_git_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "git", "error": str(e)}
        log_activity(project_name, "Git op", f"git {op}", type="git", metadata={"op": op})
        return {"executed": True, "action": "git", "result": trim_large_text(result)}

    if action == "plan":
        from plan_store import run_plan_op
        op = str(args.get("op", "")).strip().lower()
        try:
            result = run_plan_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "plan", "error": str(e)}
        log_activity(project_name, "Plan op", f"plan {op}", type="plan", metadata={"op": op})
        return {"executed": True, "action": "plan", "result": trim_large_text(result)}

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

    if action == "pr":
        from pr_tools import run_pr_op
        op = str(args.get("op", "")).strip().lower()
        try:
            result = run_pr_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "pr", "error": str(e)}
        log_activity(project_name, "PR op", f"pr {op}", type="pr", metadata={"op": op})
        return {"executed": True, "action": "pr", "result": trim_large_text(result)}

    if action == "lsp":
        from lsp_client import run_lsp_op
        op = str(args.get("op", "")).strip().lower()
        try:
            result = run_lsp_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "lsp", "error": str(e)}
        log_activity(project_name, "LSP op", f"lsp {op}", type="lsp", metadata={"op": op})
        return {"executed": True, "action": "lsp", "result": trim_large_text(result)}

    if action == "subagent":
        from subagent import run_subagent_op
        op = str(args.get("op", "run")).strip().lower()
        try:
            result = run_subagent_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "subagent", "error": str(e)}
        log_activity(project_name, "Subagent", f"subagent {op}", type="subagent", metadata={"op": op})
        return {"executed": True, "action": "subagent", "result": trim_large_text(result)}

    if action == "mcp":
        from mcp_client import run_mcp_op
        op = str(args.get("op", "")).strip().lower()
        # call ops are mutating from a security standpoint
        if op in {"call", "call_tool", "invoke"} and not allow_commands:
            return _approval_payload(project_name, action, args, f"mcp {op} {args.get('server','')}.{args.get('tool','')}")
        try:
            result = run_mcp_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "mcp", "error": str(e)}
        log_activity(project_name, "MCP op", f"mcp {op}", type="mcp", metadata={"op": op})
        return {"executed": True, "action": "mcp", "result": trim_large_text(result)}

    if action == "skill":
        from skills_loader import run_skill_op
        op = str(args.get("op", "list")).strip().lower()
        try:
            result = run_skill_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "skill", "error": str(e)}
        return {"executed": True, "action": "skill", "result": trim_large_text(result)}

    if action == "browser":
        from browser_tools import run_browser_op
        op = str(args.get("op", "")).strip().lower()
        try:
            result = run_browser_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "browser", "error": str(e)}
        log_activity(project_name, "Browser op", f"browser {op}", type="browser", metadata={"op": op, "url": args.get("url", "")})
        return {"executed": True, "action": "browser", "result": trim_large_text(result)}

    if action == "voice":
        from voice_tools import run_voice_op
        op = str(args.get("op", "")).strip().lower()
        try:
            result = run_voice_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "voice", "error": str(e)}
        log_activity(project_name, "Voice op", f"voice {op}", type="voice", metadata={"op": op})
        return {"executed": True, "action": "voice", "result": trim_large_text(result)}

    if action == "vision":
        from vision_tools import run_vision_op
        op = str(args.get("op", "ask")).strip().lower()
        try:
            result = run_vision_op(project_name, op, args)
        except Exception as e:
            return {"executed": False, "action": "vision", "error": str(e)}
        log_activity(project_name, "Vision op", f"vision {op}", type="vision", metadata={"op": op})
        return {"executed": True, "action": "vision", "result": trim_large_text(result)}

    if action == "slash":
        from slash_commands import run_slash_op
        op = str(args.get("op", "list")).strip().lower()
        if op == "run" and not allow_commands:
            return _approval_payload(project_name, action, args, f"slash run {args.get('name','')}")
        try:
            result = run_slash_op(op, **{k: v for k, v in args.items() if k != "op"})
        except Exception as e:
            return {"executed": False, "action": "slash", "error": str(e)}
        return {"executed": True, "action": "slash", "result": trim_large_text(result)}

    if action == "history":
        from prompt_history import run_history_op
        op = str(args.get("op", "list")).strip().lower()
        try:
            result = run_history_op(op, **{k: v for k, v in args.items() if k != "op"})
        except Exception as e:
            return {"executed": False, "action": "history", "error": str(e)}
        return {"executed": True, "action": "history", "result": trim_large_text(result)}

    if action == "theme":
        from theme_store import run_theme_op
        op = str(args.get("op", "list")).strip().lower()
        try:
            result = run_theme_op(op, **{k: v for k, v in args.items() if k != "op"})
        except Exception as e:
            return {"executed": False, "action": "theme", "error": str(e)}
        return {"executed": True, "action": "theme", "result": trim_large_text(result)}

    raise ValueError(f"Unknown action: {action}")
