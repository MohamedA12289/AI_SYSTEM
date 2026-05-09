from __future__ import annotations

import json
import re
import urllib.request
import urllib.error
from typing import Tuple, Generator

from config import (
    GROQ_API_KEY, OLLAMA_BASE_URL,
    OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY,
)
from settings_store import (
    get_active_provider, get_active_model, get_active_groq_model,
    get_active_openai_model, get_active_anthropic_model, get_active_openrouter_model,
)

_ANSI_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")

def _clean(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\ufeff", "")
    text = _ANSI_RE.sub("", text)
    text = _CTRL_RE.sub("", text)
    return text.strip()


def _post_json(url: str, body: dict, headers: dict, timeout: int = 120) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _stream_sse(url: str, body: dict, headers: dict, timeout: int = 120) -> Generator[str, None, None]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line or line == "data: [DONE]":
                continue
            if line.startswith("data: "):
                line = line[6:]
            if line.startswith(":"):
                continue
            yield line


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


def _openai_compat_call(api_key: str, base_url: str, model: str, system_prompt: str, user_prompt: str, extra_headers: dict | None = None) -> str:
    if not api_key:
        raise ValueError("API key not configured")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if extra_headers:
        headers.update(extra_headers)
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }
    parsed = _post_json(base_url, body, headers, timeout=120)
    return parsed["choices"][0]["message"]["content"] or ""


def _openai_compat_stream(api_key: str, base_url: str, model: str, system_prompt: str, user_prompt: str, extra_headers: dict | None = None) -> Generator[str, None, None]:
    if not api_key:
        raise ValueError("API key not configured")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if extra_headers:
        headers.update(extra_headers)
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "stream": True,
    }
    for line in _stream_sse(base_url, body, headers, timeout=120):
        try:
            obj = json.loads(line)
            token = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
            if token:
                yield token
        except json.JSONDecodeError:
            continue


def _call_groq(system_prompt: str, user_prompt: str) -> str:
    return _openai_compat_call(GROQ_API_KEY, "https://api.groq.com/openai/v1/chat/completions", get_active_groq_model(), system_prompt, user_prompt)


def _stream_groq(system_prompt: str, user_prompt: str) -> Generator[str, None, None]:
    yield from _openai_compat_stream(GROQ_API_KEY, "https://api.groq.com/openai/v1/chat/completions", get_active_groq_model(), system_prompt, user_prompt)


def _call_openai(system_prompt: str, user_prompt: str) -> str:
    return _openai_compat_call(OPENAI_API_KEY, "https://api.openai.com/v1/chat/completions", get_active_openai_model(), system_prompt, user_prompt)


def _stream_openai(system_prompt: str, user_prompt: str) -> Generator[str, None, None]:
    yield from _openai_compat_stream(OPENAI_API_KEY, "https://api.openai.com/v1/chat/completions", get_active_openai_model(), system_prompt, user_prompt)


def _call_openrouter(system_prompt: str, user_prompt: str) -> str:
    extra = {"HTTP-Referer": "https://cubos.local", "X-Title": "CubOS"}
    return _openai_compat_call(OPENROUTER_API_KEY, "https://openrouter.ai/api/v1/chat/completions", get_active_openrouter_model(), system_prompt, user_prompt, extra_headers=extra)


def _stream_openrouter(system_prompt: str, user_prompt: str) -> Generator[str, None, None]:
    extra = {"HTTP-Referer": "https://cubos.local", "X-Title": "CubOS"}
    yield from _openai_compat_stream(OPENROUTER_API_KEY, "https://openrouter.ai/api/v1/chat/completions", get_active_openrouter_model(), system_prompt, user_prompt, extra_headers=extra)


def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise ValueError("Anthropic API key not configured")
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": get_active_anthropic_model(),
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    parsed = _post_json(url, body, headers, timeout=120)
    blocks = parsed.get("content", [])
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text") or ""


def _stream_anthropic(system_prompt: str, user_prompt: str) -> Generator[str, None, None]:
    if not ANTHROPIC_API_KEY:
        raise ValueError("Anthropic API key not configured")
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": get_active_anthropic_model(),
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
        "stream": True,
    }
    for line in _stream_sse(url, body, headers, timeout=120):
        try:
            obj = json.loads(line)
            if obj.get("type") == "content_block_delta":
                delta = obj.get("delta", {})
                token = delta.get("text", "")
                if token:
                    yield token
        except json.JSONDecodeError:
            continue


_PROVIDER_HANDLERS = {
    "ollama": (lambda sp, up, mn: _call_ollama(sp, up, mn), lambda sp, up, mn: _stream_ollama(sp, up, mn)),
    "groq": (lambda sp, up, mn: _call_groq(sp, up), lambda sp, up, mn: _stream_groq(sp, up)),
    "openai": (lambda sp, up, mn: _call_openai(sp, up), lambda sp, up, mn: _stream_openai(sp, up)),
    "anthropic": (lambda sp, up, mn: _call_anthropic(sp, up), lambda sp, up, mn: _stream_anthropic(sp, up)),
    "openrouter": (lambda sp, up, mn: _call_openrouter(sp, up), lambda sp, up, mn: _stream_openrouter(sp, up)),
}


def ask_ai(system_prompt: str, user_prompt: str, model_name: str | None = None) -> Tuple[str, str]:
    """Returns (response_text, provider_used). Falls back to Ollama on any cloud provider failure."""
    provider = get_active_provider()
    call_fn = _PROVIDER_HANDLERS.get(provider, _PROVIDER_HANDLERS["ollama"])[0]
    try:
        result = call_fn(system_prompt, user_prompt, model_name)
        return _clean(result), provider
    except Exception:
        if provider == "ollama":
            return f"Error: Ollama call failed", "ollama"
        try:
            result = _call_ollama(system_prompt, user_prompt, model_name)
            return _clean(result), "ollama_fallback"
        except Exception as e2:
            return f"Error: {e2}", "ollama_fallback"


def stream_ai(system_prompt: str, user_prompt: str, model_name: str | None = None) -> Generator[str, None, None]:
    """Yields raw token strings. Falls back to Ollama on any cloud failure."""
    provider = get_active_provider()
    stream_fn = _PROVIDER_HANDLERS.get(provider, _PROVIDER_HANDLERS["ollama"])[1]
    try:
        yield from stream_fn(system_prompt, user_prompt, model_name)
    except Exception:
        if provider == "ollama":
            yield f"Error: Ollama call failed"
            return
        try:
            yield from _stream_ollama(system_prompt, user_prompt, model_name)
        except Exception as e2:
            yield f"Error: {e2}"


def generate_thread_title(first_message_content: str, timeout_seconds: int = 5) -> str:
    if not first_message_content or not first_message_content.strip():
        return "New Conversation"

    first_message_content = first_message_content.strip()
    fallback_title = first_message_content[:50].strip()
    if len(first_message_content) > 50:
        fallback_title += "..."

    system_prompt = "You are a helpful assistant that generates concise conversation titles."
    user_prompt = f"""Generate a short, descriptive title (5-8 words maximum) for a conversation that starts with this message:

"{first_message_content}"

Respond with ONLY the title, nothing else. Make it concise and descriptive."""

    try:
        import socket
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(timeout_seconds)
        title, _ = ask_ai(system_prompt, user_prompt)
        socket.setdefaulttimeout(original_timeout)

        title = title.strip().strip('"').strip("'").strip()
        if 3 <= len(title) <= 100 and title:
            return title
        return fallback_title
    except Exception:
        return fallback_title
