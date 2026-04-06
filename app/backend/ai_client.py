from __future__ import annotations

import json
import re
import urllib.request
import urllib.error
from typing import Tuple, Generator

from config import GROQ_API_KEY, OLLAMA_BASE_URL
from settings_store import get_active_provider, get_active_model, get_active_groq_model

_ANSI_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")

def _clean(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\ufeff", "")
    text = _ANSI_RE.sub("", text)
    text = _CTRL_RE.sub("", text)
    return text.strip()


def _call_ollama(system_prompt: str, user_prompt: str, model_name: str | None = None) -> str:
    selected_model = (model_name or get_active_model()).strip() or get_active_model()
    url = f"{OLLAMA_BASE_URL}/api/chat"
    body = json.dumps({
        "model": selected_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        raw = resp.read().decode("utf-8")
    parsed = json.loads(raw)
    return parsed.get("message", {}).get("content", "") or parsed.get("response", "") or ""


def _stream_ollama(system_prompt: str, user_prompt: str, model_name: str | None = None) -> Generator[str, None, None]:
    selected_model = (model_name or get_active_model()).strip() or get_active_model()
    url = f"{OLLAMA_BASE_URL}/api/chat"
    body = json.dumps({
        "model": selected_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": True,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                token = obj.get("message", {}).get("content", "")
                if token:
                    yield token
                if obj.get("done"):
                    break
            except json.JSONDecodeError:
                continue


def _call_groq(system_prompt: str, user_prompt: str) -> str:
    if not GROQ_API_KEY:
        raise ValueError("No Groq API key configured")
    url = "https://api.groq.com/openai/v1/chat/completions"
    body = json.dumps({
        "model": get_active_groq_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
    parsed = json.loads(raw)
    return parsed["choices"][0]["message"]["content"] or ""


def _stream_groq(system_prompt: str, user_prompt: str) -> Generator[str, None, None]:
    if not GROQ_API_KEY:
        raise ValueError("No Groq API key configured")
    url = "https://api.groq.com/openai/v1/chat/completions"
    body = json.dumps({
        "model": get_active_groq_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "stream": True,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line or line == "data: [DONE]":
                continue
            if line.startswith("data: "):
                line = line[6:]
            try:
                obj = json.loads(line)
                token = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if token:
                    yield token
            except json.JSONDecodeError:
                continue


def ask_ai(system_prompt: str, user_prompt: str, model_name: str | None = None) -> Tuple[str, str]:
    """
    Returns (response_text, provider_used).
    provider_used is one of: "groq", "ollama", "ollama_fallback"
    """
    provider = get_active_provider()

    if provider == "groq":
        try:
            result = _call_groq(system_prompt, user_prompt)
            return _clean(result), "groq"
        except Exception:
            try:
                result = _call_ollama(system_prompt, user_prompt, model_name)
                return _clean(result), "ollama_fallback"
            except Exception as e2:
                return f"Error: {e2}", "ollama_fallback"
    else:
        try:
            result = _call_ollama(system_prompt, user_prompt, model_name)
            return _clean(result), "ollama"
        except Exception as e:
            return f"Error: {e}", "ollama"


def stream_ai(system_prompt: str, user_prompt: str, model_name: str | None = None) -> Generator[str, None, None]:
    """
    Yields raw token strings. Falls back to Ollama if Groq is selected but fails.
    """
    provider = get_active_provider()

    if provider == "groq":
        try:
            yield from _stream_groq(system_prompt, user_prompt)
        except Exception:
            try:
                yield from _stream_ollama(system_prompt, user_prompt, model_name)
            except Exception as e2:
                yield f"Error: {e2}"
    else:
        try:
            yield from _stream_ollama(system_prompt, user_prompt, model_name)
        except Exception as e:
            yield f"Error: {e}"
