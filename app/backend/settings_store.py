from __future__ import annotations

import json
import subprocess
from config import (
    SETTINGS_PATH, OLLAMA_MODEL,
    GROQ_API_KEY, GROQ_MODEL, GROQ_AVAILABLE_MODELS,
    OPENAI_MODEL, OPENAI_AVAILABLE_MODELS,
    ANTHROPIC_MODEL, ANTHROPIC_AVAILABLE_MODELS,
    OPENROUTER_MODEL, OPENROUTER_AVAILABLE_MODELS,
)
from process_utils import run_hidden

VALID_PROVIDERS = {"ollama", "groq", "openai", "anthropic", "openrouter"}

DEFAULT_SETTINGS = {
    "approval_mode": {
        "writes_require_approval": True,
        "commands_require_approval": True,
    },
    "models": {
        "active_model": OLLAMA_MODEL,
    },
    "ai_provider": {
        "active": "ollama",
        "groq_model": GROQ_MODEL,
        "openai_model": OPENAI_MODEL,
        "anthropic_model": ANTHROPIC_MODEL,
        "openrouter_model": OPENROUTER_MODEL,
        "fallback_to_ollama": True,
    },
}


def _deep_copy_defaults() -> dict:
    return json.loads(json.dumps(DEFAULT_SETTINGS))


def read_settings() -> dict:
    if not SETTINGS_PATH.exists():
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = _deep_copy_defaults()
        SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        data = _deep_copy_defaults()
    if not isinstance(data, dict):
        data = _deep_copy_defaults()
    if not isinstance(data.get("approval_mode"), dict):
        data["approval_mode"] = _deep_copy_defaults()["approval_mode"]
    if not isinstance(data.get("models"), dict):
        data["models"] = _deep_copy_defaults()["models"]
    if not isinstance(data.get("ai_provider"), dict):
        data["ai_provider"] = _deep_copy_defaults()["ai_provider"]
    data.pop("assistant", None)
    data["approval_mode"].setdefault("writes_require_approval", True)
    data["approval_mode"].setdefault("commands_require_approval", True)
    data["models"].setdefault("active_model", OLLAMA_MODEL)
    provider = str(data["ai_provider"].get("active", "ollama") or "ollama").strip().lower()
    if provider not in VALID_PROVIDERS:
        provider = "ollama"
    data["ai_provider"]["active"] = provider
    data["ai_provider"].setdefault("groq_model", GROQ_MODEL)
    data["ai_provider"].setdefault("openai_model", OPENAI_MODEL)
    data["ai_provider"].setdefault("anthropic_model", ANTHROPIC_MODEL)
    data["ai_provider"].setdefault("openrouter_model", OPENROUTER_MODEL)
    data["ai_provider"].setdefault("fallback_to_ollama", True)
    return data


def write_settings(data: dict) -> dict:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def update_settings(patch: dict) -> dict:
    data = read_settings()
    for key, value in (patch or {}).items():
        if key == "assistant":
            continue
        if isinstance(value, dict) and isinstance(data.get(key), dict):
            data[key].update(value)
        else:
            data[key] = value
    return write_settings(data)


def get_active_model() -> str:
    return str(read_settings().get("models", {}).get("active_model", OLLAMA_MODEL) or OLLAMA_MODEL).strip()


def get_assistant_mode() -> str:
    return "build"


def get_active_provider() -> str:
    provider = str(read_settings().get("ai_provider", {}).get("active", "ollama") or "ollama").strip().lower()
    return provider if provider in VALID_PROVIDERS else "ollama"


def get_active_groq_model() -> str:
    model = str(read_settings().get("ai_provider", {}).get("groq_model", GROQ_MODEL) or GROQ_MODEL).strip()
    return model if model in GROQ_AVAILABLE_MODELS else GROQ_MODEL


def get_active_openai_model() -> str:
    model = str(read_settings().get("ai_provider", {}).get("openai_model", OPENAI_MODEL) or OPENAI_MODEL).strip()
    return model or OPENAI_MODEL


def get_active_anthropic_model() -> str:
    model = str(read_settings().get("ai_provider", {}).get("anthropic_model", ANTHROPIC_MODEL) or ANTHROPIC_MODEL).strip()
    return model or ANTHROPIC_MODEL


def get_active_openrouter_model() -> str:
    model = str(read_settings().get("ai_provider", {}).get("openrouter_model", OPENROUTER_MODEL) or OPENROUTER_MODEL).strip()
    return model or OPENROUTER_MODEL


def list_groq_models() -> dict:
    active = get_active_groq_model()
    return {"active_groq_model": active, "groq_models": GROQ_AVAILABLE_MODELS}


def list_provider_models() -> dict:
    return {
        "providers": sorted(VALID_PROVIDERS),
        "groq": {"active": get_active_groq_model(), "models": GROQ_AVAILABLE_MODELS},
        "openai": {"active": get_active_openai_model(), "models": OPENAI_AVAILABLE_MODELS},
        "anthropic": {"active": get_active_anthropic_model(), "models": ANTHROPIC_AVAILABLE_MODELS},
        "openrouter": {"active": get_active_openrouter_model(), "models": OPENROUTER_AVAILABLE_MODELS},
    }


def list_models() -> dict:
    active = get_active_model()
    try:
        result = run_hidden(["ollama", "list"], capture_output=True, text=True, timeout=20)
        lines = result.stdout.splitlines()
        models = []
        for line in lines[1:]:
            parts = [p for p in line.split("  ") if p.strip()]
            if parts:
                models.append(parts[0].strip())
        if not models:
            models = [active]
        return {"active_model": active, "models": models}
    except Exception:
        return {"active_model": active, "models": [active]}
