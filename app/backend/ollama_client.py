import json
import re
import urllib.request
import urllib.error

from settings_store import get_active_model
from agent_tools import TOOL_SCHEMA_TEXT
from ai_client import ask_ai

CHAT_SYSTEM_PROMPT = """
You are a local AI coding assistant.
Be concise, practical, and accurate.
Focus on coding, project logic, and implementation.
When answering, prefer direct solutions over long explanations.
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


def ask_ollama(prompt: str) -> str:
    result, _ = ask_ai(CHAT_SYSTEM_PROMPT, prompt)
    return result


def ask_ollama_for_action(prompt: str) -> str:
    raw, _ = ask_ai(AGENT_SYSTEM_PROMPT, prompt)
    if not raw:
        return _fallback_action_json("I could not produce a valid tool action.")
    lowered = raw.lower()
    if "error:" in lowered and "{" not in raw:
        return _fallback_action_json("I hit a model/tool error while choosing an action.")
    if "{" not in raw:
        return _fallback_action_json("I could not format a valid action response.")
    return raw
