from __future__ import annotations
from wave2_routes import router as wave2_router
from wave1_router import router as wave1_router
from thread_routes import router as thread_router


from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, UploadFile, File as FileField, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import ast
import os
import json
import re
import shutil
import subprocess
import tempfile
from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone

from config import (
    DEFAULT_WEB_TIMEOUT_SECONDS,
    DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS,
    DEFAULT_WEB_SEARCH_TOPIC,
    DEFAULT_WEB_SEARCH_MAX_RESULTS,
    DEFAULT_WEB_SEARCH_DEPTH,
    DEFAULT_AGENT_LOOP_MAX_STEPS,
    MAX_AGENT_LOOP_MAX_STEPS,
    MAX_AGENT_HISTORY_CHARS,
    AGENT_ACTION_PARSE_RETRIES,
    SELF_UPGRADE_PROJECT_NAME,
)
from ollama_client import ask_ollama, ask_ollama_for_action
from ai_client import stream_ai
from memory import (
    ensure_project_memory,
    read_tasks, write_tasks,
    read_notes, write_notes,
    read_memory_entries, write_memory_entries,
    read_summary, write_summary,
)
from chat_store import append_message, read_messages_page, read_messages, count_messages
from file_tools import (
    get_project_root,
    list_directory,
    read_text_file,
    write_new_file,
    overwrite_file,
    get_project_scope_info,
)
from command_tools import run_safe_command
from web_tools import fetch_url_content, search_web
from agent_tools import execute_agent_action
from wave34_routes import router as wave34_router
from hotfix_routes import router as hotfix_router
from code_agent_routes import router as code_agent_router
from api.git import router as git_router
from api.github_auth import router as github_auth_router
from api.customization import router as customization_router
from api.tasks import router as tasks_router
from api.artifacts import router as artifacts_router
from advanced_routes import router as advanced_router
from file_extractor_routes import router as file_extractor_router
from project_registry import (
    ensure_projects_registry,
    list_registered_projects,
    create_project,
    import_project,
    get_registered_project,
    assert_project_registered,
    update_project,
    delete_project,
)
from migration_threads import run_migration_on_startup
from approvals import list_approvals, get_approval, resolve_approval
from activity import read_project_activity, read_global_activity, log_activity
from snapshots import list_snapshots, create_snapshot, restore_snapshot
from secrets_manager import list_secrets, set_secret, delete_secret, get_secret
from tests_manager import list_tests, create_test, update_test, delete_test, run_test
from settings_store import read_settings, update_settings, list_models, get_assistant_mode, get_active_provider, list_groq_models
from project_search import search_project
from diff_tools import build_unified_diff
from process_utils import run_hidden, with_hidden_subprocess

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hotfix_router)
app.include_router(wave34_router)
app.include_router(wave2_router)
app.include_router(wave1_router)
app.include_router(code_agent_router)
app.include_router(advanced_router)
app.include_router(thread_router)
app.include_router(git_router)
app.include_router(github_auth_router)
app.include_router(customization_router)
app.include_router(tasks_router)
app.include_router(artifacts_router)
app.include_router(file_extractor_router)

RUN_STORE: dict[str, dict] = {}
INDEX_STATUS: dict[str, dict] = {}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

class ChatRequest(BaseModel):
    project_name: str
    prompt: str

class FileWriteRequest(BaseModel):
    path: str
    content: str

class CommandRunRequest(BaseModel):
    command: list[str]
    timeout_seconds: int = 30

class WebFetchRequest(BaseModel):
    url: str
    timeout_seconds: int = DEFAULT_WEB_TIMEOUT_SECONDS

class WebSearchRequest(BaseModel):
    query: str
    topic: str = DEFAULT_WEB_SEARCH_TOPIC
    max_results: int = DEFAULT_WEB_SEARCH_MAX_RESULTS
    search_depth: str = DEFAULT_WEB_SEARCH_DEPTH
    time_range: str | None = None
    timeout_seconds: int = DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS

class CreateProjectRequest(BaseModel):
    project_name: str
    display_name: str | None = None
    description: str = ""

class ImportProjectRequest(BaseModel):
    path: str | None = None
    source_path: str | None = None
    project_name: str | None = None
    display_name: str | None = None
    description: str = ""
    access_mode: str = "import"

class UpdateProjectRequest(BaseModel):
    display_name: str | None = None
    description: str | None = None
    archived: bool | None = None



class AgentChatRequest(BaseModel):
    project_name: str
    prompt: str
    allow_writes: bool = False
    allow_commands: bool = False

class AgentLoopRequest(BaseModel):
    project_name: str
    prompt: str
    allow_writes: bool = False
    allow_commands: bool = False
    max_steps: int = DEFAULT_AGENT_LOOP_MAX_STEPS

class TaskCreateRequest(BaseModel):
    title: str
    status: str = "todo"
    description: str | None = None

class TaskUpdateRequest(BaseModel):
    title: str | None = None
    status: str | None = None
    description: str | None = None

class NoteCreateRequest(BaseModel):
    content: str

class NoteUpdateRequest(BaseModel):
    content: str | None = None

class MemoryEntryCreateRequest(BaseModel):
    key: str
    value: str
    pinned: bool = False

class MemoryEntryUpdateRequest(BaseModel):
    key: str | None = None
    value: str | None = None
    pinned: bool | None = None

class SecretSetRequest(BaseModel):
    value: str

class ApprovalResolveRequest(BaseModel):
    note: str = ""

class SnapshotCreateRequest(BaseModel):
    note: str = ""

class TestCreateRequest(BaseModel):
    title: str
    command: list[str]
    timeout_seconds: int = 30

class TestUpdateRequest(BaseModel):
    title: str | None = None
    command: list[str] | None = None
    timeout_seconds: int | None = None

class SettingsPatchRequest(BaseModel):
    patch: dict

class ModelActivateRequest(BaseModel):
    active_model: str

def normalize_action_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Model output must be a JSON object.")
    action = payload.get("action")
    args = payload.get("args")
    if not isinstance(args, dict):
        args = {}
        payload["args"] = args
    return payload

def extract_brace_block(text: str) -> str | None:
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    quote_char = ""
    escape = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote_char:
                in_string = False
            continue
        if char in {'"', "'"}:
            in_string = True
            quote_char = char
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
    return None

def try_literal_eval_dict(candidate: str):
    try:
        value = ast.literal_eval(candidate)
        if isinstance(value, dict):
            return value
    except Exception:
        return None
    return None

def parse_agent_json(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    try:
        return normalize_action_payload(json.loads(cleaned))
    except json.JSONDecodeError:
        pass

    candidate = extract_brace_block(cleaned)
    if candidate:
        try:
            return normalize_action_payload(json.loads(candidate))
        except json.JSONDecodeError:
            pass
        literal_value = try_literal_eval_dict(candidate)
        if literal_value is not None:
            return normalize_action_payload(literal_value)

    literal_value = try_literal_eval_dict(cleaned)
    if literal_value is not None:
        return normalize_action_payload(literal_value)
    raise ValueError("Could not parse model JSON.")

def normalize_loop_max_steps(max_steps: int) -> int:
    try:
        value = int(max_steps)
    except (TypeError, ValueError):
        value = DEFAULT_AGENT_LOOP_MAX_STEPS
    if value <= 0:
        value = DEFAULT_AGENT_LOOP_MAX_STEPS
    if value > MAX_AGENT_LOOP_MAX_STEPS:
        value = MAX_AGENT_LOOP_MAX_STEPS
    return value

def trim_text_for_history(text: str, limit: int = MAX_AGENT_HISTORY_CHARS) -> str:
    if len(text) > limit:
        return text[:limit] + "\n\n[truncated]"
    return text

def serialize_for_history(value) -> str:
    try:
        serialized = json.dumps(value, indent=2)
    except TypeError:
        serialized = str(value)
    return trim_text_for_history(serialized)

def format_step_history(step_history: list[dict]) -> str:
    if not step_history:
        return "No prior loop steps yet."
    parts = []
    for step in step_history:
        parts.append(f"Step {step['step_number']}:")
        parts.append("Chosen action payload:")
        parts.append(serialize_for_history(step["action_payload"]))
        parts.append("Tool execution result:")
        parts.append(serialize_for_history(step["tool_execution"]))
        parts.append("")
    return trim_text_for_history("\n".join(parts))

def build_chat_context(project_name: str, prompt: str) -> str:
    ensure_projects_registry()
    assert_project_registered(project_name)
    ensure_project_memory(project_name)
    get_project_root(project_name)
    messages = read_messages_page(project_name, offset=0, limit=20)["items"]
    summary = read_summary(project_name)
    task_memory = read_tasks(project_name)
    notes_memory = read_notes(project_name)
    memory_entries = read_memory_entries(project_name)
    scope_info = get_project_scope_info(project_name)
    registry = list_registered_projects()
    full_prompt = f"""
Project Name: {project_name}

Project Scope:
{json.dumps(scope_info, indent=2)}

Registered Projects:
{json.dumps(registry, indent=2)}

Project Summary:
{json.dumps(summary, indent=2)}

Recent Messages:
{json.dumps(messages, indent=2)}

Task Memory:
{json.dumps(task_memory, indent=2)}

Project Notes:
{json.dumps(notes_memory, indent=2)}

Pinned Memory Entries:
{json.dumps(memory_entries, indent=2)}

Current User Request:
{prompt}
"""
    return full_prompt

def build_agent_context(project_name: str, prompt: str) -> str:
    ensure_projects_registry()
    assert_project_registered(project_name)
    ensure_project_memory(project_name)
    get_project_root(project_name)
    messages = read_messages_page(project_name, offset=0, limit=20)["items"]
    summary = read_summary(project_name)
    task_memory = read_tasks(project_name)
    notes_memory = read_notes(project_name)
    memory_entries = read_memory_entries(project_name)
    workspace_snapshot = list_directory(project_name)
    scope_info = get_project_scope_info(project_name)
    registry = list_registered_projects()
    full_prompt = f"""
Project Name: {project_name}

Project Scope:
{json.dumps(scope_info, indent=2)}

Registered Projects:
{json.dumps(registry, indent=2)}

Project Summary:
{json.dumps(summary, indent=2)}

Recent Messages:
{json.dumps(messages, indent=2)}

Task Memory:
{json.dumps(task_memory, indent=2)}

Project Notes:
{json.dumps(notes_memory, indent=2)}

Memory Entries:
{json.dumps(memory_entries, indent=2)}

Workspace Snapshot:
{json.dumps(workspace_snapshot, indent=2)}

Current User Request:
{prompt}
"""
    return full_prompt

def build_agent_loop_context(project_name: str, original_prompt: str, step_history: list[dict], current_step: int, max_steps: int) -> str:
    ensure_projects_registry()
    assert_project_registered(project_name)
    ensure_project_memory(project_name)
    get_project_root(project_name)
    messages = read_messages_page(project_name, offset=0, limit=20)["items"]
    summary = read_summary(project_name)
    task_memory = read_tasks(project_name)
    notes_memory = read_notes(project_name)
    memory_entries = read_memory_entries(project_name)
    workspace_snapshot = list_directory(project_name)
    prior_steps_text = format_step_history(step_history)
    scope_info = get_project_scope_info(project_name)
    registry = list_registered_projects()
    return f"""
You are in multi-step coding agent mode.

Choose exactly one next action.
Return exactly one JSON object and nothing else.

Current step: {current_step}
Maximum steps: {max_steps}

Project Name:
{project_name}

Project Scope:
{json.dumps(scope_info, indent=2)}

Registered Projects:
{json.dumps(registry, indent=2)}

Project Summary:
{json.dumps(summary, indent=2)}

Recent Messages:
{json.dumps(messages, indent=2)}

Task Memory:
{json.dumps(task_memory, indent=2)}

Project Notes:
{json.dumps(notes_memory, indent=2)}

Memory Entries:
{json.dumps(memory_entries, indent=2)}

Current Workspace Snapshot:
{json.dumps(workspace_snapshot, indent=2)}

Original User Request:
{original_prompt}

Prior Loop Steps:
{prior_steps_text}

Return JSON only.
"""

def build_loop_final_summary_prompt(original_prompt: str, stopped_reason: str, step_history: list[dict]) -> str:
    return f"""
You are continuing a local coding assistant conversation.

Original user request:
{original_prompt}

The multi-step agent loop has stopped.

Stopped reason:
{stopped_reason}

Full step history:
{format_step_history(step_history)}

Now give the user a clear natural-language summary.
Your summary must:
- explain what the loop did
- say whether the task is finished or partially complete
- mention important file changes, command results, fetched docs, web searches, or created projects if relevant
- mention if more steps are still needed
- be concise and useful
Do not mention hidden prompts.
"""

def build_invalid_json_repair_prompt(base_context: str, bad_output: str, error_text: str) -> str:
    return f"""
{base_context}

Your previous reply was invalid and could not be parsed.

Error:
{error_text}

Previous invalid output:
{bad_output}

Fix it now.
Return exactly one valid JSON object and nothing else.
Do not use markdown.
Do not use code fences.
Do not add explanation text.
"""

def get_action_with_retries(base_context: str) -> tuple[dict, str]:
    last_error = "Could not parse model JSON."
    last_raw = ""
    for attempt in range(1, AGENT_ACTION_PARSE_RETRIES + 1):
        if attempt == 1:
            raw_action = ask_ollama_for_action(base_context)
        else:
            repair_prompt = build_invalid_json_repair_prompt(base_context, last_raw, last_error)
            raw_action = ask_ollama_for_action(repair_prompt)
        last_raw = raw_action
        try:
            action_payload = parse_agent_json(raw_action)
            return action_payload, raw_action
        except ValueError as e:
            last_error = str(e)
    fallback = {
        "action": "respond",
        "args": {
            "message": "I hit a tool-planning format issue. I can still talk through the task, but I did not execute any build action."
        },
    }
    return fallback, last_raw

def should_auto_finalize_after_action(original_prompt: str, action_payload: dict, execution: dict) -> bool:
    if not execution.get("executed"):
        return False
    action = action_payload.get("action", "")
    prompt_lower = original_prompt.lower()
    if action in {"read_file", "fetch_url", "web_search", "run_command", "create_project"}:
        return True
    if action in ("write_file", "overwrite_file"):
        if not any(word in prompt_lower for word in ["then run", "after that", "test", "execute", "command", "fetch", "url", "web", "search"]):
            return True
    return False

def _record_run(project_name: str, run_id: str, payload: dict):
    payload["project_name"] = project_name
    RUN_STORE[run_id] = payload

def _get_default_approval_mode() -> tuple[bool, bool]:
    settings = read_settings()
    approval_mode = settings.get("approval_mode", {})
    if get_assistant_mode() == "plan":
        return False, False
    allow_writes = not bool(approval_mode.get("writes_require_approval", True))
    allow_commands = not bool(approval_mode.get("commands_require_approval", True))
    return allow_writes, allow_commands


def _is_non_build_action(action: str) -> bool:
    return action in {"respond", "list_files", "read_file", "fetch_url", "web_search"}


def _enforce_assistant_mode(action_payload: dict) -> dict:
    mode = get_assistant_mode()
    action = str(action_payload.get("action", "") or "")
    if mode != "plan" or _is_non_build_action(action):
        return action_payload
    return {
        "action": "respond",
        "args": {
            "message": f"Plan mode is active. I can discuss and plan this change, but I won't execute build actions until you switch to Build mode. Proposed blocked action: {action}."
        },
    }


def _run_auto_index(project_name: str) -> None:
    import threading
    def _do():
        try:
            from code_agent_routes import _build_workspace_map
            result = _build_workspace_map(project_name, "")
            INDEX_STATUS[project_name] = {"last_indexed": now_iso(), "file_count": result.get("total_files", 0), "status": "ok"}
        except Exception as e:
            INDEX_STATUS[project_name] = {"last_indexed": now_iso(), "status": "error", "error": str(e)}
    threading.Thread(target=_do, daemon=True).start()


def _auto_index_loop():
    import threading, time
    while True:
        time.sleep(300)
        try:
            projects = list_registered_projects().get("projects", [])
            for p in projects:
                name = p.get("project_name")
                if name:
                    _run_auto_index(name)
        except Exception:
            pass


@app.on_event("startup")
def startup_event():
    import threading
    ensure_projects_registry()

    # Run migration in background thread to avoid blocking startup
    def run_migration_async():
        try:
            run_migration_on_startup()
        except Exception as e:
            print(f"Migration error: {e}")

    threading.Thread(target=run_migration_async, daemon=True).start()
    threading.Thread(target=_auto_index_loop, daemon=True).start()

@app.get("/")
def home():
    return {"status": "AI backend running", "phase": "3-backend-expanded"}

@app.get("/projects")
def get_projects():
    return list_registered_projects()

@app.post("/projects/create")
def create_project_endpoint(request: CreateProjectRequest):
    try:
        project = create_project(project_name=request.project_name, display_name=request.display_name, description=request.description)
        log_activity(request.project_name, "Project created", request.project_name, type="project")
        return {"created": True, "project": project}
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/projects/import")
def import_project_endpoint(request: ImportProjectRequest):
    raw_path = (request.path or request.source_path or "").strip()
    if not raw_path:
        raise HTTPException(status_code=422, detail="Either 'path' or 'source_path' is required.")
    try:
        project = import_project(
            path=raw_path,
            display_name=request.display_name or request.project_name,
            description=request.description,
            project_name=request.project_name,
        )
        access_mode = (request.access_mode or "import").strip().lower()
        if access_mode in {"link", "link_readonly"}:
            from config import PROJECTS_REGISTRY_PATH
            source = os.path.abspath(raw_path)
            data = json.loads(PROJECTS_REGISTRY_PATH.read_text(encoding="utf-8"))
            for item in data.get("projects", []):
                if item.get("project_name") == project["project_name"]:
                    item["linked_source"] = source
                    item["source_mode"] = access_mode
                    item["workspace_root"] = source
                    item["scope_root"] = source
                    project = item
                    break
            PROJECTS_REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        log_activity(project["project_name"], "Project imported", raw_path, type="project")
        return {
            "imported": True,
            "created": True,
            "project": project,
            "linked_source": project.get("linked_source"),
            "access_mode": request.access_mode,
        }
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail={"project_name": str(e), "message": "Project already exists."})
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/projects/{project_name}")
def get_project_metadata(project_name: str):
    try:
        return get_registered_project(project_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/projects/{project_name}")
def patch_project(project_name: str, request: UpdateProjectRequest):
    try:
        updated = update_project(project_name, display_name=request.display_name, description=request.description, archived=request.archived)
        log_activity(project_name, "Project updated", project_name, type="project")
        return updated
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/projects/{project_name}")
def remove_project(project_name: str):
    try:
        result = delete_project(project_name)
        log_activity(project_name, "Project deleted", project_name, type="project")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/projects/{project_name}/archive")
def archive_project(project_name: str):
    try:
        updated = update_project(project_name, archived=True)
        log_activity(project_name, "Project archived", project_name, type="project")
        return updated
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/project/{project_name}/scope")
def get_project_scope(project_name: str):
    try:
        return get_project_scope_info(project_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/chat")
def chat(request: ChatRequest):
    full_prompt = build_chat_context(request.project_name, request.prompt)
    append_message(request.project_name, "user", request.prompt)
    response = ask_ollama(full_prompt)
    append_message(request.project_name, "assistant", response)
    log_activity(request.project_name, "Chat response", "Standard chat", type="chat")
    return {"response": response}


class StreamChatRequest(BaseModel):
    project_name: str
    prompt: str
    system_prompt: str | None = None


@app.post("/chat/stream")
def chat_stream(request: StreamChatRequest):
    from ollama_client import CHAT_SYSTEM_PROMPT
    import re as _re
    sys_prompt = request.system_prompt or CHAT_SYSTEM_PROMPT
    full_prompt = build_chat_context(request.project_name, request.prompt)
    append_message(request.project_name, "user", request.prompt)

    file_ctx_parts: list[str] = []
    mentioned = _re.findall(r'[\w./\\-]+\.(?:py|ts|tsx|js|jsx|json|yaml|yml|md|txt|toml|sh|go|rs|java|cs|cpp|c|h|sql|css|html)', request.prompt)
    for rel_path in mentioned[:4]:
        try:
            fc = read_text_file(request.project_name, rel_path.replace("\\", "/"))
            snippet = (fc.get("content") or "")[:2000]
            file_ctx_parts.append(f"\n\nAuto-loaded file `{rel_path}`:\n```\n{snippet}\n```")
        except Exception:
            pass
    if file_ctx_parts:
        full_prompt += "\n\n[Auto file context]" + "".join(file_ctx_parts)

    collected: list[str] = []

    def event_generator():
        try:
            for token in stream_ai(sys_prompt, full_prompt):
                collected.append(token)
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            full_response = "".join(collected)
            if full_response:
                append_message(request.project_name, "assistant", full_response)
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/project/{project_name}/chat")
def get_chat(project_name: str):
    # backward-compatible plain text chat
    items = read_messages(project_name)
    text = "\n\n".join([f"{m.get('role', '').upper()}: {m.get('content', '')}" for m in items])
    return {"chat": text}

@app.get("/project/{project_name}/messages")
def get_messages(project_name: str, offset: int = Query(default=0), limit: int = Query(default=50)):
    return read_messages_page(project_name, offset=offset, limit=limit)

@app.post("/project/{project_name}/messages")
def add_message(project_name: str, request: ChatRequest):
    msg = append_message(project_name, "user", request.prompt)
    return {"message": msg}

@app.get("/project/{project_name}/chat/summary")
def get_chat_summary(project_name: str):
    return read_summary(project_name)

@app.post("/project/{project_name}/chat/summary/refresh")
def refresh_chat_summary(project_name: str):
    assert_project_registered(project_name)
    messages = read_messages(project_name)
    recent = messages[-30:]
    prompt = "Summarize this project conversation for long-term coding memory:\n\n" + json.dumps(recent, indent=2)
    summary_text = ask_ollama(prompt)
    summary = write_summary(project_name, summary_text, count_messages(project_name))
    log_activity(project_name, "Summary refreshed", "", type="memory")
    return summary

@app.get("/project/{project_name}/tasks")
def get_tasks(project_name: str):
    return read_tasks(project_name)

@app.post("/project/{project_name}/tasks")
def create_task_endpoint(project_name: str, request: TaskCreateRequest):
    data = read_tasks(project_name)
    task = {"id": str(uuid4()), "title": request.title, "status": request.status, "description": request.description or "", "created_at": now_iso()}
    data.setdefault("tasks", []).append(task)
    write_tasks(project_name, data)
    log_activity(project_name, "Task added", request.title, type="task")
    return task

@app.patch("/project/{project_name}/tasks/{task_id}")
def update_task_endpoint(project_name: str, task_id: str, request: TaskUpdateRequest):
    data = read_tasks(project_name)
    for task in data.get("tasks", []):
        if task.get("id") == task_id:
            if request.title is not None:
                task["title"] = request.title
            if request.status is not None:
                task["status"] = request.status
            if request.description is not None:
                task["description"] = request.description
            write_tasks(project_name, data)
            log_activity(project_name, "Task updated", task.get("title", ""), type="task")
            return task
    raise HTTPException(status_code=404, detail="Task not found.")

@app.delete("/project/{project_name}/tasks/{task_id}")
def delete_task_endpoint(project_name: str, task_id: str):
    data = read_tasks(project_name)
    before = len(data.get("tasks", []))
    data["tasks"] = [x for x in data.get("tasks", []) if x.get("id") != task_id]
    if len(data["tasks"]) == before:
        raise HTTPException(status_code=404, detail="Task not found.")
    write_tasks(project_name, data)
    log_activity(project_name, "Task deleted", task_id, type="task")
    return {"deleted": True, "task_id": task_id}

@app.get("/project/{project_name}/notes")
def get_notes(project_name: str):
    return read_notes(project_name)

@app.post("/project/{project_name}/notes")
def create_note_endpoint(project_name: str, request: NoteCreateRequest):
    data = read_notes(project_name)
    note = {"id": str(uuid4()), "content": request.content, "created_at": now_iso()}
    data.setdefault("notes", []).append(note)
    write_notes(project_name, data)
    log_activity(project_name, "Note added", request.content, type="note")
    return note

@app.patch("/project/{project_name}/notes/{note_id}")
def update_note_endpoint(project_name: str, note_id: str, request: NoteUpdateRequest):
    data = read_notes(project_name)
    for note in data.get("notes", []):
        if note.get("id") == note_id:
            if request.content is not None:
                note["content"] = request.content
            write_notes(project_name, data)
            log_activity(project_name, "Note updated", note.get("content", ""), type="note")
            return note
    raise HTTPException(status_code=404, detail="Note not found.")

@app.delete("/project/{project_name}/notes/{note_id}")
def delete_note_endpoint(project_name: str, note_id: str):
    data = read_notes(project_name)
    before = len(data.get("notes", []))
    data["notes"] = [x for x in data.get("notes", []) if x.get("id") != note_id]
    if len(data["notes"]) == before:
        raise HTTPException(status_code=404, detail="Note not found.")
    write_notes(project_name, data)
    log_activity(project_name, "Note deleted", note_id, type="note")
    return {"deleted": True, "note_id": note_id}

@app.get("/project/{project_name}/memory")
def get_memory(project_name: str):
    return read_memory_entries(project_name)

@app.post("/project/{project_name}/memory")
def create_memory_endpoint(project_name: str, request: MemoryEntryCreateRequest):
    data = read_memory_entries(project_name)
    item = {"id": str(uuid4()), "key": request.key, "value": request.value, "pinned": request.pinned, "created_at": now_iso()}
    data.setdefault("entries", []).append(item)
    write_memory_entries(project_name, data)
    log_activity(project_name, "Memory added", request.key, type="memory")
    return item

@app.patch("/project/{project_name}/memory/{memory_id}")
def update_memory_endpoint(project_name: str, memory_id: str, request: MemoryEntryUpdateRequest):
    data = read_memory_entries(project_name)
    for entry in data.get("entries", []):
        if entry.get("id") == memory_id:
            if request.key is not None:
                entry["key"] = request.key
            if request.value is not None:
                entry["value"] = request.value
            if request.pinned is not None:
                entry["pinned"] = request.pinned
            write_memory_entries(project_name, data)
            log_activity(project_name, "Memory updated", entry.get("key", ""), type="memory")
            return entry
    raise HTTPException(status_code=404, detail="Memory entry not found.")

@app.delete("/project/{project_name}/memory/{memory_id}")
def delete_memory_endpoint(project_name: str, memory_id: str):
    data = read_memory_entries(project_name)
    before = len(data.get("entries", []))
    data["entries"] = [x for x in data.get("entries", []) if x.get("id") != memory_id]
    if len(data["entries"]) == before:
        raise HTTPException(status_code=404, detail="Memory entry not found.")
    write_memory_entries(project_name, data)
    log_activity(project_name, "Memory deleted", memory_id, type="memory")
    return {"deleted": True, "memory_id": memory_id}

@app.get("/project/{project_name}/files")
def get_files(project_name: str, subpath: str = Query(default="")):
    try:
        return list_directory(project_name, subpath)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NotADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/project/{project_name}/file")
def get_file(project_name: str, path: str = Query(...)):
    try:
        return read_text_file(project_name, path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/project/{project_name}/file/range")
def get_file_range(project_name: str, path: str = Query(...), start_line: int = Query(default=1), end_line: int = Query(default=None)):
    from file_tools import read_text_file_range
    try:
        return read_text_file_range(project_name, path, start_line, end_line)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/project/{project_name}/files/search")
def search_files_endpoint(project_name: str, q: str = Query(..., description="Search query")):
    try:
        return search_project(project_name, q)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/project/{project_name}/git/branch")
def get_git_branch_endpoint(project_name: str):
    try:
        from file_tools import get_project_root
        project_root = str(get_project_root(project_name))
        result = run_hidden(
            ["git", "branch", "--show-current"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            branch = result.stdout.strip() or "main"
            return {"branch": branch}
        return {"branch": "main"}
    except Exception as e:
        return {"branch": "main"}

@app.post("/project/{project_name}/file/diff")
def get_file_diff(project_name: str, request: FileWriteRequest):
    try:
        current = read_text_file(project_name, request.path).get("content", "")
    except Exception:
        current = ""
    return {"path": request.path, "diff": build_unified_diff(current, request.content, path_label=request.path)}

@app.post("/project/{project_name}/file/write")
def create_file(project_name: str, request: FileWriteRequest):
    try:
        result = write_new_file(project_name, request.path, request.content)
        log_activity(project_name, "File created", request.path, type="file")
        return result
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/{project_name}/file/overwrite")
def replace_file(project_name: str, request: FileWriteRequest):
    try:
        result = overwrite_file(project_name, request.path, request.content)
        log_activity(project_name, "File overwritten", request.path, type="file")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/project/{project_name}/file")
def delete_file_endpoint(project_name: str, path: str = Query(...)):
    try:
        from file_tools import delete_file
        result = delete_file(project_name, path)
        log_activity(project_name, "File deleted", path, type="file")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IsADirectoryError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/{project_name}/directory")
def create_directory(project_name: str, request: dict):
    try:
        from file_tools import resolve_safe_path
        dir_path = (request.get("path") or "").strip()
        if not dir_path:
            raise HTTPException(status_code=400, detail="Path cannot be empty.")
        target = resolve_safe_path(project_name, dir_path)
        target.mkdir(parents=True, exist_ok=True)
        log_activity(project_name, "Directory created", dir_path, type="file")
        return {"status": "created", "project_name": project_name, "path": dir_path}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/project/{project_name}/file/move")
def move_file(project_name: str, request: dict):
    try:
        from file_tools import resolve_safe_path
        from_path = (request.get("from") or request.get("from_path") or "").strip()
        to_path = (request.get("to") or request.get("to_path") or "").strip()
        if not from_path or not to_path:
            raise HTTPException(status_code=400, detail="Both 'from' and 'to' paths are required.")
        src = resolve_safe_path(project_name, from_path)
        dst = resolve_safe_path(project_name, to_path)
        if not src.exists():
            raise HTTPException(status_code=404, detail="Source path does not exist.")
        dst.parent.mkdir(parents=True, exist_ok=True)
        src.rename(dst)
        log_activity(project_name, "File moved", f"{from_path} -> {to_path}", type="file")
        return {"status": "moved", "project_name": project_name, "from": from_path, "to": to_path}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/project/{project_name}/command/run")
def run_command_endpoint(project_name: str, request: CommandRunRequest):
    try:
        result = run_safe_command(project_name=project_name, command=request.command, timeout_seconds=request.timeout_seconds)
        log_activity(project_name, "Command run", " ".join(request.command), type="command", metadata={"exit_code": result.get("exit_code")})
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/{project_name}/command/stream")
def stream_command_endpoint(project_name: str, request: CommandRunRequest):
    import subprocess, threading
    try:
        from file_tools import get_project_root
        cwd = str(get_project_root(project_name))
    except Exception:
        cwd = None

    def event_generator():
        try:
            proc = subprocess.Popen(
                request.command,
                **with_hidden_subprocess({
                    "cwd": cwd,
                    "stdout": subprocess.PIPE,
                    "stderr": subprocess.STDOUT,
                    "text": True,
                    "bufsize": 1,
                }),
            )
            for line in iter(proc.stdout.readline, ""):
                yield f"data: {json.dumps({'line': line.rstrip()})}\n\n"
            proc.wait()
            yield f"data: {json.dumps({'exit_code': proc.returncode})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    log_activity(project_name, "Command stream", " ".join(request.command), type="command")
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/project/{project_name}/diagnostics")
def get_diagnostics(project_name: str):
    import subprocess, re
    try:
        from file_tools import get_project_root
        cwd = str(get_project_root(project_name))
    except Exception:
        return {"problems": []}

    problems = []
    tsconfig = os.path.join(cwd, "tsconfig.json")
    if os.path.exists(tsconfig):
        try:
            result = run_hidden(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=60,
            )
            output = result.stdout + result.stderr
            pattern = re.compile(r"^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.+)$", re.MULTILINE)
            for m in pattern.finditer(output):
                file_path, line, col, severity, code, message = m.groups()
                problems.append({
                    "id": f"ts-{len(problems)}",
                    "severity": severity if severity in ("error", "warning", "info") else "error",
                    "message": message.strip(),
                    "source": "TypeScript",
                    "file": file_path.replace("\\", "/").replace(cwd.replace("\\", "/") + "/", ""),
                    "line": int(line),
                    "column": int(col),
                    "code": code,
                })
        except Exception:
            pass

    return {"problems": problems}

@app.post("/project/{project_name}/web/fetch")
def fetch_web_endpoint(project_name: str, request: WebFetchRequest):
    try:
        result = fetch_url_content(url=request.url, timeout_seconds=request.timeout_seconds)
        log_activity(project_name, "Fetched URL", request.url, type="web")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/{project_name}/web/search")
def search_web_endpoint(project_name: str, request: WebSearchRequest):
    try:
        result = search_web(query=request.query, topic=request.topic, max_results=request.max_results, search_depth=request.search_depth, time_range=request.time_range, timeout_seconds=request.timeout_seconds)
        log_activity(project_name, "Web search", request.query, type="web")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/secrets")
def get_secrets(masked: bool = Query(default=True)):
    return list_secrets(masked=masked)

@app.post("/secrets/{key}")
def set_secret_endpoint(key: str, request: SecretSetRequest):
    try:
        return set_secret(key, request.value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/secrets/{key}")
def delete_secret_endpoint(key: str):
    try:
        return delete_secret(key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/secrets/{key}/reveal")
def reveal_secret_endpoint(key: str):
    try:
        return get_secret(key, reveal=True)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/project/{project_name}/approvals")
def get_approvals(project_name: str, status: str | None = Query(default=None)):
    return list_approvals(project_name, status=status)

@app.post("/project/{project_name}/approvals/{approval_id}/approve")
def approve_approval(project_name: str, approval_id: str, request: ApprovalResolveRequest):
    try:
        approval = resolve_approval(project_name, approval_id, "approved", request.note)
        payload = approval.get("payload", {})
        action_type = approval.get("approval_type")
        if action_type == "write_file":
            overwrite = False
            try:
                write_new_file(project_name, payload.get("path", ""), payload.get("content", ""))
            except FileExistsError:
                overwrite = True
            if overwrite:
                overwrite_file(project_name, payload.get("path", ""), payload.get("content", ""))
        elif action_type == "overwrite_file":
            overwrite_file(project_name, payload.get("path", ""), payload.get("content", ""))
        elif action_type == "run_command":
            run_safe_command(project_name, payload.get("command", []), payload.get("timeout_seconds", 30))
        elif action_type == "create_project":
            create_project(payload.get("project_name", ""), payload.get("display_name"), payload.get("description", ""))
        elif action_type == "set_secret":
            set_secret(payload.get("key", ""), payload.get("value", ""))
        elif action_type == "create_snapshot":
            create_snapshot(project_name, note=payload.get("note", ""))
        elif action_type == "run_test":
            run_test(project_name, payload.get("test_id", ""))
        log_activity(project_name, "Approval approved", approval_id, type="approval")
        return approval
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400 if isinstance(e, ValueError) else 404, detail=str(e))

@app.post("/project/{project_name}/approvals/{approval_id}/reject")
def reject_approval(project_name: str, approval_id: str, request: ApprovalResolveRequest):
    try:
        result = resolve_approval(project_name, approval_id, "rejected", request.note)
        log_activity(project_name, "Approval rejected", approval_id, type="approval")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/project/{project_name}/snapshots")
def get_project_snapshots(project_name: str):
    return list_snapshots(project_name)

@app.post("/project/{project_name}/snapshots")
def create_project_snapshot(project_name: str, request: SnapshotCreateRequest):
    try:
        snap = create_snapshot(project_name, note=request.note)
        log_activity(project_name, "Snapshot created", snap.get("id", ""), type="snapshot")
        return snap
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/project/{project_name}/snapshots/{snapshot_id}/restore")
def restore_project_snapshot(project_name: str, snapshot_id: str):
    try:
        result = restore_snapshot(project_name, snapshot_id)
        log_activity(project_name, "Snapshot restored", snapshot_id, type="snapshot")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/project/{project_name}/activity")
def get_project_activity(project_name: str, limit: int = Query(default=100)):
    return read_project_activity(project_name, limit=limit)

@app.get("/activity")
def get_activity(limit: int = Query(default=200)):
    return read_global_activity(limit=limit)

@app.get("/project/{project_name}/audit")
def get_project_audit(project_name: str, limit: int = Query(default=200)):
    return read_project_activity(project_name, limit=limit)

@app.get("/project/{project_name}/tests")
def get_project_tests(project_name: str):
    return list_tests(project_name)

@app.post("/project/{project_name}/tests")
def create_project_test(project_name: str, request: TestCreateRequest):
    try:
        test = create_test(project_name, request.title, request.command, request.timeout_seconds)
        log_activity(project_name, "Test created", request.title, type="test")
        return test
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/project/{project_name}/tests/{test_id}")
def patch_project_test(project_name: str, test_id: str, request: TestUpdateRequest):
    try:
        test = update_test(project_name, test_id, request.title, request.command, request.timeout_seconds)
        log_activity(project_name, "Test updated", test_id, type="test")
        return test
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400 if isinstance(e, ValueError) else 404, detail=str(e))

@app.delete("/project/{project_name}/tests/{test_id}")
def remove_project_test(project_name: str, test_id: str):
    try:
        result = delete_test(project_name, test_id)
        log_activity(project_name, "Test deleted", test_id, type="test")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/project/{project_name}/tests/{test_id}/run")
def run_project_test(project_name: str, test_id: str):
    try:
        result = run_test(project_name, test_id)
        log_activity(project_name, "Test run", test_id, type="test")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/project/{project_name}/search")
def search_project_endpoint(project_name: str, query: str = Query(...), max_results: int = Query(default=50)):
    try:
        return search_project(project_name, query, max_results=max_results)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/settings")
def get_settings():
    return read_settings()

@app.post("/settings")
def patch_settings(request: SettingsPatchRequest):
    return update_settings(request.patch)

@app.get("/models")
def get_models():
    return list_models()

@app.post("/models/active")
def activate_model(request: ModelActivateRequest):
    settings = update_settings({"models": {"active_model": request.active_model}})
    return {"updated": True, "settings": settings}

@app.get("/ollama/models")
def get_ollama_models():
    import requests as _req
    from config import OLLAMA_BASE_URL
    try:
        r = _req.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        r.raise_for_status()
        data = r.json()
        models = [m.get("name", "") for m in data.get("models", [])]
        return {"models": models}
    except Exception as e:
        return {"models": [], "error": str(e)}

@app.post("/project/{project_name}/index/trigger")
def trigger_index(project_name: str):
    _run_auto_index(project_name)
    return {"triggered": True, "project_name": project_name}

@app.get("/project/{project_name}/index/status")
def get_index_status(project_name: str):
    return INDEX_STATUS.get(project_name, {"status": "never_indexed"})

@app.get("/settings/provider")
def get_provider():
    return {"active": get_active_provider()}

class ProviderSetRequest(BaseModel):
    active: str

@app.post("/settings/provider")
def set_provider(request: ProviderSetRequest):
    from settings_store import VALID_PROVIDERS
    provider = request.active.strip().lower()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"active must be one of {sorted(VALID_PROVIDERS)}")
    settings = update_settings({"ai_provider": {"active": provider}})
    return {"active": provider, "settings": settings}

@app.get("/settings/providers")
def get_providers():
    """Return all providers, their active model, and the available model list for each."""
    from settings_store import list_provider_models
    return list_provider_models()

@app.get("/groq/models")
def get_groq_models():
    return list_groq_models()

class GroqModelActivateRequest(BaseModel):
    active_groq_model: str

@app.post("/groq/models/active")
def activate_groq_model(request: GroqModelActivateRequest):
    from config import GROQ_AVAILABLE_MODELS
    model = request.active_groq_model.strip()
    if model not in GROQ_AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown Groq model: {model}")
    settings = update_settings({"ai_provider": {"groq_model": model}})
    return {"active_groq_model": model, "settings": settings}

class ProviderModelActivateRequest(BaseModel):
    provider: str
    model: str

@app.post("/settings/provider/model")
def activate_provider_model(request: ProviderModelActivateRequest):
    """Set the active model for any cloud provider (openai, anthropic, openrouter, groq)."""
    from settings_store import VALID_PROVIDERS
    from config import (
        GROQ_AVAILABLE_MODELS,
        OPENAI_AVAILABLE_MODELS,
        ANTHROPIC_AVAILABLE_MODELS,
        OPENROUTER_AVAILABLE_MODELS,
    )
    provider = request.provider.strip().lower()
    model = request.model.strip()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    allowed = {
        "groq": GROQ_AVAILABLE_MODELS,
        "openai": OPENAI_AVAILABLE_MODELS,
        "anthropic": ANTHROPIC_AVAILABLE_MODELS,
        "openrouter": OPENROUTER_AVAILABLE_MODELS,
    }.get(provider)
    if allowed is not None and model not in allowed:
        # Allow custom models but warn via response; still accept to be flexible.
        pass
    field = {
        "groq": "groq_model",
        "openai": "openai_model",
        "anthropic": "anthropic_model",
        "openrouter": "openrouter_model",
        "ollama": "active_model",
    }[provider]
    if provider == "ollama":
        settings = update_settings({"models": {"active_model": model}})
    else:
        settings = update_settings({"ai_provider": {field: model}})
    return {"provider": provider, "model": model, "settings": settings}

@app.get("/roles")
def get_roles():
    """List available agent role prompts (architect, developer, tech-lead, ...)."""
    from role_prompts import list_roles
    return {"roles": list_roles()}

@app.get("/roles/{role}")
def get_role(role: str):
    from role_prompts import get_role_prompt
    text = get_role_prompt(role)
    if text is None:
        raise HTTPException(status_code=404, detail=f"Unknown role: {role}")
    return {"role": role, "prompt": text}

# ---- Themes ----
@app.get("/themes")
def list_themes_endpoint():
    from theme_store import list_themes, get_active
    return {"themes": list_themes(), "active": get_active().get("name")}

@app.get("/themes/active")
def get_active_theme_endpoint():
    from theme_store import get_active
    return get_active()

@app.post("/themes/active")
def set_active_theme_endpoint(payload: dict):
    from theme_store import set_active
    return set_active(payload.get("name", ""))

@app.post("/themes")
def save_theme_endpoint(payload: dict):
    from theme_store import save_theme
    return save_theme(payload.get("name", ""), payload.get("data", payload))

# ---- Slash commands ----
@app.get("/slash/commands")
def list_slash_commands_endpoint():
    from slash_commands import list_commands
    return {"commands": list_commands()}

@app.post("/slash/run")
def run_slash_endpoint(payload: dict):
    from slash_commands import run_command
    return run_command(payload.get("name", ""), payload.get("args", ""), payload.get("ctx") or {})

# ---- Prompt history ----
@app.get("/history")
def list_history_endpoint(limit: int = 100, session_id: str | None = None):
    from prompt_history import list_entries
    return {"entries": list_entries(limit, session_id)}

@app.get("/history/search")
def search_history_endpoint(q: str = "", limit: int = 50):
    from prompt_history import search as ph_search
    return {"entries": ph_search(q, limit)}

@app.post("/history")
def add_history_endpoint(payload: dict):
    from prompt_history import add_entry
    eid = add_entry(
        payload.get("content", ""),
        session_id=payload.get("session_id"),
        role=payload.get("role", "user"),
        tags=payload.get("tags", ""),
    )
    return {"ok": eid > 0, "id": eid}

# ---- Voice ----
@app.get("/voice/voices")
def list_voices_endpoint():
    from voice_tools import list_installed_voices
    return {"voices": list_installed_voices()}

@app.get("/voice/available")
async def list_available_voices_endpoint(refresh: bool = False):
    from voice_tools import list_available_voices
    return {"voices": await asyncio.to_thread(list_available_voices, refresh=refresh)}

@app.post("/voice/download")
def download_voice_endpoint(payload: dict):
    from voice_tools import download_voice
    return download_voice(payload.get("name", ""))

@app.post("/voice/transcribe")
async def transcribe_endpoint(file: UploadFile = FileField(...)):
    from voice_tools import is_stt_available, transcribe_bytes
    if not is_stt_available():
        raise HTTPException(status_code=503, detail="Speech-to-text is not available because faster-whisper is not installed.")
    data = await file.read()
    try:
        return await asyncio.to_thread(transcribe_bytes, data, filename=file.filename or "audio.wav")
    except RuntimeError as exc:
        message = str(exc)
        lower = message.lower()
        if "faster-whisper" in lower:
            raise HTTPException(status_code=503, detail=message) from exc
        raise HTTPException(status_code=422, detail=message) from exc

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """Streaming voice: client sends audio bytes; server returns transcript JSON on close/flush."""
    from voice_tools import is_stt_available, transcribe_bytes
    await websocket.accept()
    await websocket.send_json({"type": "ready", "stt_available": is_stt_available()})
    buf = bytearray()
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"]:
                buf.extend(msg["bytes"])
            elif "text" in msg and msg["text"]:
                txt = msg["text"]
                if txt == "__flush__":
                    result = await asyncio.to_thread(transcribe_bytes, bytes(buf), filename="stream.wav")
                    await websocket.send_json(result)
                    buf.clear()
                elif txt == "__end__":
                    break
    except Exception as e:
        try:
            await websocket.send_json({"ok": False, "error": str(e)})
        except Exception:
            pass
    finally:
        if buf:
            try:
                result = await asyncio.to_thread(transcribe_bytes, bytes(buf), filename="stream.wav")
                await websocket.send_json(result)
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass

@app.get("/project/{project_name}/runs")
def get_runs(project_name: str):
    items = [v for v in RUN_STORE.values() if v.get("project_name") == project_name]
    return {"items": items}

@app.get("/project/{project_name}/runs/{run_id}")
def get_run(project_name: str, run_id: str):
    item = RUN_STORE.get(run_id)
    if not item or item.get("project_name") != project_name:
        raise HTTPException(status_code=404, detail="Run not found.")
    return item

@app.post("/agent/chat")
def agent_chat(request: AgentChatRequest):
    project_name = request.project_name
    prompt = request.prompt
    assert_project_registered(project_name)
    default_allow_writes, default_allow_commands = _get_default_approval_mode()
    allow_writes = request.allow_writes or default_allow_writes
    allow_commands = request.allow_commands or default_allow_commands
    run_id = str(uuid4())
    try:
        append_message(project_name, "user", prompt)
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "thinking", "created_at": now_iso()})

        agent_context = build_agent_context(project_name, prompt)
        action_payload, raw_action = get_action_with_retries(agent_context)
        action_payload = _enforce_assistant_mode(action_payload)

        _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "executing_action", "action_payload": action_payload, "created_at": now_iso()})

        execution = execute_agent_action(
            project_name=project_name,
            action_payload=action_payload,
            allow_writes=allow_writes,
            allow_commands=allow_commands,
        )

        if action_payload.get("action") == "respond":
            assistant_message = execution.get("message", "")
            append_message(project_name, "assistant", assistant_message)
            _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "done", "assistant_message": assistant_message, "tool_execution": execution, "created_at": now_iso()})
            return {"run_id": run_id, "assistant_message": assistant_message, "raw_model_output": raw_action, "action_payload": action_payload, "tool_execution": execution}

        if execution.get("requires_approval"):
            approval = execution.get("approval", {})
            assistant_message = f"Approval required for {approval.get('approval_type', 'action')}."
            append_message(project_name, "assistant", assistant_message, message_type="approval", metadata={
                "approval_id": approval.get("id"),
                "approval_type": approval.get("approval_type"),
                "payload": approval.get("payload"),
                "summary": approval.get("summary"),
            })
            _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "awaiting_approval", "assistant_message": assistant_message, "tool_execution": execution, "created_at": now_iso()})
            return {"run_id": run_id, "assistant_message": assistant_message, "raw_model_output": raw_action, "action_payload": action_payload, "tool_execution": execution}

        follow_up_prompt = f"""
Original user request:
{prompt}

Chosen tool action:
{json.dumps(action_payload, indent=2)}

Tool execution result:
{json.dumps(execution, indent=2)}

Give the user a concise natural-language response.
"""
        assistant_message = ask_ollama(follow_up_prompt)
        append_message(project_name, "assistant", assistant_message)
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "done", "assistant_message": assistant_message, "tool_execution": execution, "created_at": now_iso()})
        return {"run_id": run_id, "assistant_message": assistant_message, "raw_model_output": raw_action, "action_payload": action_payload, "tool_execution": execution}

    except HTTPException:
        raise
    except Exception as e:
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_chat", "status": "error", "error": str(e), "created_at": now_iso()})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/loop")
def agent_loop(request: AgentLoopRequest):
    project_name = request.project_name
    prompt = request.prompt
    assert_project_registered(project_name)
    default_allow_writes, default_allow_commands = _get_default_approval_mode()
    allow_writes = request.allow_writes or default_allow_writes
    allow_commands = request.allow_commands or default_allow_commands
    max_steps = normalize_loop_max_steps(request.max_steps)
    run_id = str(uuid4())

    step_history = []
    stopped_reason = "unknown"
    assistant_message = ""

    try:
        append_message(project_name, "user", prompt)
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_loop", "status": "thinking", "created_at": now_iso(), "steps_completed": 0})

        for step_number in range(1, max_steps + 1):
            loop_context = build_agent_loop_context(
                project_name=project_name,
                original_prompt=prompt,
                step_history=step_history,
                current_step=step_number,
                max_steps=max_steps,
            )

            action_payload, raw_action = get_action_with_retries(loop_context)
            action_payload = _enforce_assistant_mode(action_payload)

            execution = execute_agent_action(
                project_name=project_name,
                action_payload=action_payload,
                allow_writes=allow_writes,
                allow_commands=allow_commands,
            )

            step_record = {
                "step_number": step_number,
                "raw_model_output": raw_action,
                "action_payload": action_payload,
                "tool_execution": execution,
            }
            step_history.append(step_record)
            _record_run(project_name, run_id, {"id": run_id, "type": "agent_loop", "status": "step_complete", "steps_completed": len(step_history), "step_history": step_history, "created_at": now_iso()})

            if action_payload.get("action") == "respond":
                assistant_message = execution.get("message", "")
                stopped_reason = "model_responded"
                break

            if execution.get("requires_approval"):
                _loop_approval = execution.get("approval", {})
                assistant_message = f"Approval required for {_loop_approval.get('approval_type', 'action')}."
                append_message(project_name, "assistant", assistant_message, message_type="approval", metadata={
                    "approval_id": _loop_approval.get("id"),
                    "approval_type": _loop_approval.get("approval_type"),
                    "payload": _loop_approval.get("payload"),
                    "summary": _loop_approval.get("summary"),
                })
                stopped_reason = "approval_required"
                break

            if should_auto_finalize_after_action(prompt, action_payload, execution):
                stopped_reason = "auto_finalized_after_successful_action"
                summary_prompt = build_loop_final_summary_prompt(
                    original_prompt=prompt,
                    stopped_reason=stopped_reason,
                    step_history=step_history,
                )
                assistant_message = ask_ollama(summary_prompt)
                break

        if not assistant_message:
            stopped_reason = "max_steps_reached"
            summary_prompt = build_loop_final_summary_prompt(
                original_prompt=prompt,
                stopped_reason=stopped_reason,
                step_history=step_history,
            )
            assistant_message = ask_ollama(summary_prompt)

        if stopped_reason != "approval_required":
            append_message(project_name, "assistant", assistant_message)
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_loop", "status": "done", "assistant_message": assistant_message, "steps_completed": len(step_history), "step_history": step_history, "created_at": now_iso()})

        return {
            "run_id": run_id,
            "assistant_message": assistant_message,
            "stopped_reason": stopped_reason,
            "steps_completed": len(step_history),
            "max_steps": max_steps,
            "step_history": step_history,
        }

    except HTTPException:
        raise
    except Exception as e:
        _record_run(project_name, run_id, {"id": run_id, "type": "agent_loop", "status": "error", "error": str(e), "created_at": now_iso()})
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/terminal/health")
async def terminal_health_websocket(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "ready", "service": "terminal"})
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "text" in msg:
                await websocket.send_json({"type": "pong", "data": msg.get("text")})
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.websocket("/ws/terminal/{project_name}")
async def terminal_websocket(websocket: WebSocket, project_name: str):
    """WebSocket endpoint for terminal sessions in Code Mode"""
    from terminal_pty import handle_terminal_session
    await handle_terminal_session(websocket, project_name)


class CloneGitRequest(BaseModel):
    repo_url: str
    project_name: Optional[str] = None


@app.post("/projects/clone-git")
def clone_git_project(request: CloneGitRequest):
    from config import WORKSPACES_BASE_PATH
    raw_name = (request.project_name or request.repo_url.rstrip('/').split('/')[-1].replace('.git', '')).strip()
    project_name = re.sub(r'[^a-z0-9_]', '', raw_name.lower().replace('-', '_').replace(' ', '_')) or 'cloned_project'
    target_path = WORKSPACES_BASE_PATH / project_name
    if target_path.exists():
        raise HTTPException(status_code=400, detail=f"Project directory already exists: {project_name}")
    try:
        result = run_hidden(
            ["git", "clone", request.repo_url, str(target_path)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Git clone failed: {result.stderr.strip()}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Git clone timed out (120s)")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="git is not installed or not in PATH")
    try:
        display_name = request.project_name or target_path.name
        project = import_project(str(target_path), display_name=display_name, description=f"Cloned from {request.repo_url}")
    except Exception as e:
        shutil.rmtree(str(target_path), ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to register project: {str(e)}")
    return {"project": project}


@app.post("/project/{project_name}/media/transcribe-upload")
async def transcribe_media_upload(
    project_name: str,
    file: UploadFile = FileField(...),
    model_name: str = Form("base"),
    task: str = Form("transcribe"),
    language: Optional[str] = Form(None),
):
    from media_tools import _transcribe_from_path
    from pathlib import Path as _Path
    filename = file.filename or "upload"
    suffix = _Path(filename).suffix or ".tmp"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = _Path(tmp.name)
        result = _transcribe_from_path(tmp_path, project_name, filename, model_name=model_name, task=task, language=language or None)
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
    return result


