from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import re as _re

from chat_store import (
    create_thread,
    list_threads,
    get_thread,
    update_thread_title,
    delete_thread,
    append_thread_message,
    read_thread_messages_page,
    read_thread_messages,
    count_thread_messages,
)
from ai_client import generate_thread_title, stream_ai, ask_ai
from activity import log_activity
from ollama_client import CHAT_SYSTEM_PROMPT
from file_tools import read_text_file
from agent_tools import TOOL_SCHEMA_TEXT, execute_agent_action, trim_large_text

router = APIRouter()

# In-memory cancellation flags keyed by thread_id. When set, the active
# stream generator stops yielding additional tokens at the next iteration.
_stream_cancel_flags: set[str] = set()

# Max iterations of the tool-calling loop before forcing a final answer.
_TOOL_LOOP_MAX_ITERS = 6


class ThreadCreateRequest(BaseModel):
    title: Optional[str] = None


class ThreadUpdateTitleRequest(BaseModel):
    title: str


class ThreadMessageRequest(BaseModel):
    role: str
    content: str
    message_type: Optional[str] = "chat"
    metadata: Optional[dict] = None


class ThreadStreamRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    enable_tools: Optional[bool] = False


@router.get("/api/projects/{project_name}/threads")
def api_list_threads(project_name: str):
    """List all threads for a project"""
    try:
        threads = list_threads(project_name)
        return {"threads": threads}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/projects/{project_name}/threads")
def api_create_thread(project_name: str, req: ThreadCreateRequest):
    """Create a new thread for a project"""
    try:
        title = req.title or "New Conversation"
        thread = create_thread(project_name, title)
        log_activity(
            action="create_thread",
            detail=f"Created thread: {thread['title']}",
            project_name=project_name,
            metadata={"thread_id": thread["thread_id"]},
        )
        return {"thread": thread}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/threads/{thread_id}")
def api_get_thread(thread_id: str):
    """Get a single thread by ID"""
    try:
        # Parse project_name from thread_id (format: {project_name}_{uuid})
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]
        thread = get_thread(project_name, thread_id)
        return {"thread": thread}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/threads/{thread_id}/title")
def api_update_thread_title(thread_id: str, req: ThreadUpdateTitleRequest):
    """Update a thread's title"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]
        thread = update_thread_title(project_name, thread_id, req.title)
        log_activity(
            action="update_thread_title",
            detail=f"Renamed thread to: {req.title}",
            project_name=project_name,
            metadata={"thread_id": thread_id},
        )
        return {"thread": thread}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/threads/{thread_id}")
def api_delete_thread(thread_id: str):
    """Delete a thread and its messages"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]
        deleted_thread = delete_thread(project_name, thread_id)
        log_activity(
            action="delete_thread",
            detail=f"Deleted thread: {deleted_thread['title']}",
            project_name=project_name,
            metadata={"thread_id": thread_id},
        )
        return {"deleted": True, "thread": deleted_thread}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/threads/{thread_id}/messages")
def api_get_thread_messages(
    thread_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Get messages from a thread (paginated)"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]
        result = read_thread_messages_page(project_name, thread_id, offset, limit)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/threads/{thread_id}/messages")
def api_send_thread_message(thread_id: str, req: ThreadMessageRequest):
    """Send a message to a thread"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]

        # Append message to thread
        message = append_thread_message(
            project_name=project_name,
            thread_id=thread_id,
            role=req.role,
            content=req.content,
            message_type=req.message_type or "chat",
            metadata=req.metadata or {},
        )

        auto_titled = False
        # Auto-generate title if this is the first user message
        thread = get_thread(project_name, thread_id)
        if thread.get("message_count") == 1 and req.role == "user":
            # Generate title from first message
            try:
                new_title = generate_thread_title(req.content)
                update_thread_title(project_name, thread_id, new_title)
                auto_titled = True
            except Exception:
                # Ignore title generation errors
                pass

        return {"message": message, "auto_titled": auto_titled}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/threads/{thread_id}/stream")
def api_stream_thread_chat(thread_id: str, request: ThreadStreamRequest):
    """Stream AI response to a thread"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]

        thread = get_thread(project_name, thread_id)

        sys_prompt = request.system_prompt or CHAT_SYSTEM_PROMPT

        history = read_thread_messages(project_name, thread_id)
        context_parts = []
        for msg in history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                clean_content = content
                if role == "user" and "[USER MESSAGE]:" in content:
                    m = _re.search(r'\[USER MESSAGE\]:\s*([\s\S]*?)(?:\n\n\[|$)', content)
                    if m:
                        clean_content = m.group(1).strip()
                context_parts.append(f"{role.upper()}: {clean_content[:500]}")

        context_str = "\n".join(context_parts) if context_parts else ""
        full_prompt = f"{context_str}\n\nUSER: {request.prompt}" if context_str else request.prompt

        file_ctx_parts: list[str] = []
        seen_paths: set[str] = set()

        user_msg_text = request.prompt
        user_msg_match = _re.search(r'\[USER MESSAGE\]:\s*([\s\S]*?)(?:\n\n\[|$)', request.prompt)
        if user_msg_match:
            user_msg_text = user_msg_match.group(1).strip()

        avail_files: list[str] = []
        avail_match = _re.search(r'\[AVAILABLE FILES IN PROJECT\]:\s*([^\n\[]+)', request.prompt)
        if avail_match:
            avail_files = [f.strip() for f in avail_match.group(1).split(',') if f.strip()]

        file_ext_pattern = r'[\w./\\-]+\.(?:py|ts|tsx|js|jsx|json|yaml|yml|md|txt|toml|sh|go|rs|java|cs|cpp|c|h|sql|css|html)'
        files_in_user_msg = set(_re.findall(file_ext_pattern, user_msg_text))

        open_file_match = _re.search(r'\[CONTEXT:.*?editing file "([^"]+)"', request.prompt)
        if open_file_match:
            open_file = open_file_match.group(1)
            if open_file not in seen_paths:
                seen_paths.add(open_file)
                try:
                    fc = read_text_file(project_name, open_file.replace("\\", "/"))
                    snippet = (fc.get("content") or "")[:3000]
                    file_ctx_parts.append(f"\n\nFile `{open_file}` (currently open):\n```\n{snippet}\n```")
                except Exception:
                    pass

        avail_set = set(avail_files)
        for fname in files_in_user_msg:
            if fname in seen_paths:
                continue
            basename = fname.split('/')[-1].split('\\')[-1]
            matched_path = None
            if fname in avail_set:
                matched_path = fname
            else:
                for a in avail_files:
                    if a == basename or a.endswith('/' + basename) or a.endswith('\\' + basename):
                        matched_path = a
                        break
            if matched_path:
                seen_paths.add(matched_path)
                try:
                    fc = read_text_file(project_name, matched_path.replace("\\", "/"))
                    snippet = (fc.get("content") or "")[:3000]
                    file_ctx_parts.append(f"\n\nFile `{matched_path}`:\n```\n{snippet}\n```")
                except Exception:
                    pass

        if file_ctx_parts:
            full_prompt += "\n\n[Project File Contents]" + "".join(file_ctx_parts)

        append_thread_message(project_name, thread_id, "user", request.prompt)

        collected: list[str] = []
        _stream_cancel_flags.discard(thread_id)
        enable_tools = bool(request.enable_tools)

        def event_generator():
            cancelled = False
            try:
                if enable_tools:
                    tool_sys = (
                        sys_prompt
                        + "\n\nYou are operating in TOOL MODE for project "
                        + f"`{project_name}`. You can use tools to inspect and modify the project.\n"
                        + TOOL_SCHEMA_TEXT
                        + "\nALWAYS reply with exactly one JSON object matching one of the action schemas above. "
                          "After gathering enough information via tools, use {\"action\":\"respond\", \"args\":{\"message\":\"...\"}} to give your final answer."
                    )
                    iter_prompt = full_prompt
                    transcript_addendum = ""
                    final_message: Optional[str] = None

                    for iter_idx in range(_TOOL_LOOP_MAX_ITERS):
                        if thread_id in _stream_cancel_flags:
                            cancelled = True
                            break
                        raw, _provider = ask_ai(tool_sys, iter_prompt + transcript_addendum)
                        match = _re.search(r"\{[\s\S]+\}", raw or "")
                        action_payload = None
                        if match:
                            try:
                                action_payload = json.loads(match.group(0))
                            except Exception:
                                action_payload = None
                        if not isinstance(action_payload, dict) or "action" not in action_payload:
                            final_message = (raw or "").strip() or "(no response)"
                            break

                        action_name = action_payload.get("action")
                        if action_name == "respond":
                            final_message = str(action_payload.get("args", {}).get("message", "")).strip() or "(no response)"
                            break

                        try:
                            tool_result = execute_agent_action(
                                project_name,
                                action_payload,
                                allow_writes=True,
                                allow_commands=False,
                            )
                        except Exception as tool_err:
                            tool_result = {"executed": False, "error": str(tool_err)}

                        try:
                            preview = json.dumps(trim_large_text(tool_result, 600))[:1200]
                        except Exception:
                            preview = str(tool_result)[:1200]
                        yield f"data: {json.dumps({'tool': {'name': action_name, 'args': action_payload.get('args', {}), 'result_preview': preview}})}\n\n"

                        transcript_addendum += (
                            f"\n\n[TOOL CALL {iter_idx+1}] {action_name} args={json.dumps(action_payload.get('args', {}))[:600]}"
                            f"\n[TOOL RESULT {iter_idx+1}] {preview}"
                        )
                    else:
                        final_message = (
                            "I reached the tool-call limit before producing a final answer. "
                            "Latest tool results are above; please refine the request."
                        )

                    if cancelled:
                        pass
                    elif final_message:
                        for i in range(0, len(final_message), 32):
                            if thread_id in _stream_cancel_flags:
                                cancelled = True
                                break
                            chunk = final_message[i:i+32]
                            collected.append(chunk)
                            yield f"data: {json.dumps({'token': chunk})}\n\n"
                else:
                    for token in stream_ai(sys_prompt, full_prompt):
                        if thread_id in _stream_cancel_flags:
                            cancelled = True
                            break
                        collected.append(token)
                        payload = json.dumps({"token": token})
                        yield f"data: {payload}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                _stream_cancel_flags.discard(thread_id)
                full_response = "".join(collected)
                if cancelled and full_response:
                    full_response += "\n\n_[Stopped by user]_"
                if full_response:
                    append_thread_message(project_name, thread_id, "assistant", full_response)

                    if count_thread_messages(project_name, thread_id) == 2:
                        try:
                            new_title = generate_thread_title(request.prompt)
                            update_thread_title(project_name, thread_id, new_title)
                        except Exception:
                            pass

                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/threads/{thread_id}/cancel")
def api_cancel_thread_stream(thread_id: str):
    """Signal the active stream for this thread to stop."""
    _stream_cancel_flags.add(thread_id)
    return {"ok": True, "thread_id": thread_id}


@router.get("/api/threads/{thread_id}/messages/count")
def api_count_thread_messages(thread_id: str):
    """Get message count for a thread"""
    try:
        if "_" not in thread_id:
            raise HTTPException(status_code=400, detail="Invalid thread ID format")

        project_name = thread_id.rsplit("_", 1)[0]
        count = count_thread_messages(project_name, thread_id)
        return {"count": count}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
