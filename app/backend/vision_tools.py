"""Vision tools — multi-provider image input.

Wraps direct HTTP calls to OpenAI / Anthropic / OpenRouter chat APIs that
accept image content parts. Groq's vision-capable models also use the
OpenAI schema, so the OpenAI path covers them when the active model is a
Groq vision SKU.

Inputs:
  * ``images`` — list of either:
      - ``"data:image/png;base64,..."`` data URLs
      - ``"https://..."`` http(s) URLs
      - filesystem paths (auto-encoded to data URLs by `prepare_image`)
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
from typing import Any, Dict, List, Optional, Tuple

from ai_client import _post_json  # reuse the shared HTTP helper
from settings_store import (
    get_active_provider,
    get_active_openai_model,
    get_active_anthropic_model,
    get_active_openrouter_model,
    get_active_groq_model,
)
from config import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY,
    GROQ_API_KEY,
)


def prepare_image(item: str) -> str:
    """Normalise an image reference into something the providers accept.

    - data URLs returned as-is
    - http(s) URLs returned as-is
    - filesystem paths -> base64 data URL
    """
    if not item or not isinstance(item, str):
        raise ValueError("image item must be a non-empty string")
    s = item.strip()
    if s.startswith("data:") or s.startswith("http://") or s.startswith("https://"):
        return s
    if os.path.isfile(s):
        mime, _ = mimetypes.guess_type(s)
        if not mime or not mime.startswith("image/"):
            mime = "image/png"
        with open(s, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return f"data:{mime};base64,{b64}"
    raise ValueError(f"Unrecognized image reference: {item[:80]}...")


def _split_data_url(data_url: str) -> Tuple[str, str]:
    """Return (media_type, base64_data) from a data URL."""
    assert data_url.startswith("data:")
    head, _, b64 = data_url.partition(",")
    media_type = head[len("data:"):].split(";", 1)[0] or "image/png"
    return media_type, b64


# --- OpenAI / OpenRouter / Groq (OpenAI schema) ---------------------------------
def _openai_compat_vision(api_key: str, base_url: str, model: str,
                          system_prompt: str, user_text: str,
                          images: List[str], extra_headers: Optional[dict] = None,
                          max_tokens: int = 1024) -> str:
    if not api_key:
        raise ValueError(f"API key not configured for {base_url}")
    content: List[Dict[str, Any]] = []
    if user_text:
        content.append({"type": "text", "text": user_text})
    for img in images:
        url = prepare_image(img)
        content.append({"type": "image_url", "image_url": {"url": url}})
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    parsed = _post_json(base_url, body, headers, timeout=120)
    try:
        return parsed["choices"][0]["message"]["content"] or ""
    except Exception:
        return json.dumps(parsed)[:2000]


# --- Anthropic ------------------------------------------------------------------
def _anthropic_vision(model: str, system_prompt: str, user_text: str,
                      images: List[str], max_tokens: int = 1024) -> str:
    if not ANTHROPIC_API_KEY:
        raise ValueError("Anthropic API key not configured")
    content: List[Dict[str, Any]] = []
    for img in images:
        url = prepare_image(img)
        if url.startswith("data:"):
            media_type, b64 = _split_data_url(url)
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            })
        else:
            content.append({
                "type": "image",
                "source": {"type": "url", "url": url},
            })
    if user_text:
        content.append({"type": "text", "text": user_text})
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": content}],
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    parsed = _post_json("https://api.anthropic.com/v1/messages", body, headers, timeout=120)
    blocks = parsed.get("content", [])
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text") or ""


# --- Public API ------------------------------------------------------------------
def ask_with_images(system_prompt: str, user_text: str, images: List[str],
                    provider: Optional[str] = None, max_tokens: int = 1024) -> Dict[str, Any]:
    """Send a vision request via the active (or specified) provider.

    Returns ``{"text": str, "provider": str}``.
    """
    if not images:
        raise ValueError("ask_with_images requires at least one image")
    prov = (provider or get_active_provider() or "openai").lower()
    if prov == "openai":
        text = _openai_compat_vision(
            OPENAI_API_KEY,
            "https://api.openai.com/v1/chat/completions",
            get_active_openai_model(),
            system_prompt, user_text, images, max_tokens=max_tokens,
        )
    elif prov == "openrouter":
        text = _openai_compat_vision(
            OPENROUTER_API_KEY,
            "https://openrouter.ai/api/v1/chat/completions",
            get_active_openrouter_model(),
            system_prompt, user_text, images,
            extra_headers={"HTTP-Referer": "https://cubos.local", "X-Title": "CubOS"},
            max_tokens=max_tokens,
        )
    elif prov == "groq":
        text = _openai_compat_vision(
            GROQ_API_KEY,
            "https://api.groq.com/openai/v1/chat/completions",
            get_active_groq_model(),
            system_prompt, user_text, images, max_tokens=max_tokens,
        )
    elif prov == "anthropic":
        text = _anthropic_vision(get_active_anthropic_model(), system_prompt, user_text, images, max_tokens=max_tokens)
    else:
        raise ValueError(f"Provider {prov!r} does not support vision in CubOS yet")
    return {"text": text, "provider": prov}


def run_vision_op(project_name: str, op: str, args: dict) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if op in ("", "ask"):
        return ask_with_images(
            system_prompt=str(args.get("system", "You are a helpful vision assistant.")),
            user_text=str(args.get("prompt", "")),
            images=list(args.get("images") or []),
            provider=args.get("provider"),
            max_tokens=int(args.get("max_tokens", 1024)),
        )
    raise ValueError(f"Unknown vision op: {op!r}")
