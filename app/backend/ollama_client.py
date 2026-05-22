import json
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from fastapi import HTTPException

from settings_store import get_active_model
from agent_tools import TOOL_SCHEMA_TEXT
from ai_client import ask_ai

CHAT_SYSTEM_PROMPT = """
You are a local AI coding assistant with full access to project files.
Be concise, practical, and accurate.
Focus on coding, project logic, and implementation.
When answering, prefer direct solutions over long explanations.
When file contents are provided in [Project File Contents] or [FILE CONTENT OF ...] sections, use them to answer questions about those files.
If a user asks about a file and its content is provided in the context, read and answer from that content directly.

When you need to CREATE or MODIFY a file, use this exact format (the system will auto-apply it):
<!-- WRITE_FILE: relative/path/to/file.ext -->
```
full file content here
```

You can include multiple WRITE_FILE blocks in one response. Always write the COMPLETE file content, not just the changed parts.
After each WRITE_FILE block, briefly explain what you changed.
"""

AGENT_SYSTEM_PROMPT = f"""
You are a local coding agent.

Your job is to choose exactly one next action.

You must output exactly one JSON object and nothing else.
Do not include explanations.
Do not include markdown.
Do not include code fences.
Do not include comments.
Do not include extra text before or after the JSON.

When in doubt, return a valid "respond" action.

{TOOL_SCHEMA_TEXT}
"""

_ANSI_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
_AI_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="cubos-ai")
DEFAULT_AI_TIMEOUT_SECONDS = 15.0


def _clean_text(text: str) -> str:
    if text is None:
        return ""
    text = text.replace("\ufeff", "")
    text = _ANSI_RE.sub("", text)
    text = _CONTROL_RE.sub("", text)
    return text.strip()


def _fallback_action_json(message: str) -> str:
    payload = {"action": "respond", "args": {"message": message}}
    return json.dumps(payload)


def ask_ollama(prompt: str, timeout: float | None = DEFAULT_AI_TIMEOUT_SECONDS) -> str:
    future = _AI_EXECUTOR.submit(ask_ai, CHAT_SYSTEM_PROMPT, prompt)
    try:
        result, _ = future.result(timeout=timeout)
    except FutureTimeout as exc:
        raise HTTPException(
            status_code=504,
            detail={
                "error": "ai_timeout",
                "message": f"AI backend did not respond within {timeout:g} seconds.",
            },
        ) from exc
    return result


def ask_ollama_for_action(prompt: str, timeout: float | None = DEFAULT_AI_TIMEOUT_SECONDS) -> str:
    future = _AI_EXECUTOR.submit(ask_ai, AGENT_SYSTEM_PROMPT, prompt)
    try:
        raw, _ = future.result(timeout=timeout)
    except FutureTimeout:
        return _fallback_action_json(f"AI backend did not respond within {timeout:g} seconds.")
    if not raw:
        return _fallback_action_json("I could not produce a valid tool action.")
    lowered = raw.lower()
    if "error:" in lowered and "{" not in raw:
        return _fallback_action_json("I hit a model/tool error while choosing an action.")
    if "{" not in raw:
        return _fallback_action_json("I could not format a valid action response.")
    return raw
