
import os
from pathlib import Path


def _resolve_base_path() -> Path:
    # 1. Explicit override (dev or advanced user)
    env_override = os.environ.get("CUBOS_BASE_PATH", "").strip()
    if env_override:
        return Path(env_override)

    # 2. Always use per-user data directory (consistent across dev and packaged)
    appdata = os.environ.get("APPDATA", "").strip()
    if appdata:
        return Path(appdata) / "CubOS"

    # 3. Linux/macOS fallback
    home = os.environ.get("HOME", "").strip()
    if home:
        return Path(home) / ".cubos"

    # 4. Last-resort dev fallback (repo root)
    return Path(__file__).resolve().parent.parent.parent


AI_SYSTEM_BASE_PATH = _resolve_base_path()
SECRETS_BASE_PATH = AI_SYSTEM_BASE_PATH / "secrets"
ENV_FILE_PATH = SECRETS_BASE_PATH / ".env"

def _load_simple_env_file(path: Path) -> None:
    if not path.exists():
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if ((value.startswith('"') and value.endswith('"')) or
            (value.startswith("'") and value.endswith("'"))):
            value = value[1:-1]
        os.environ[key] = value

_load_simple_env_file(ENV_FILE_PATH)

OLLAMA_MODEL = os.getenv("CUBOS_ACTIVE_MODEL", "qwen2.5-coder:14b").strip() or "qwen2.5-coder:14b"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip() or "http://127.0.0.1:11434"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3-32b").strip() or "qwen/qwen3-32b"
GROQ_AVAILABLE_MODELS = [
    "qwen/qwen3-32b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "moonshotai/kimi-k2-instruct",
]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
OPENAI_AVAILABLE_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4.1",
    "gpt-4.1-mini",
    "o1-mini",
    "o3-mini",
]

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest").strip() or "claude-3-5-sonnet-latest"
ANTHROPIC_AVAILABLE_MODELS = [
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
]

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet").strip() or "anthropic/claude-3.5-sonnet"
OPENROUTER_AVAILABLE_MODELS = [
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-opus",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-exp",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat",
    "qwen/qwen-2.5-coder-32b-instruct",
]

MEMORY_BASE_PATH = AI_SYSTEM_BASE_PATH / "memory" / "projects"
WORKSPACES_BASE_PATH = AI_SYSTEM_BASE_PATH / "workspaces"
CONFIGS_BASE_PATH = AI_SYSTEM_BASE_PATH / "configs"
PROJECTS_REGISTRY_PATH = CONFIGS_BASE_PATH / "projects_registry.json"

SELF_UPGRADE_PROJECT_NAME = "self_upgrade"
SELF_UPGRADE_SCOPE_PATH = AI_SYSTEM_BASE_PATH.resolve()

MAX_TOOL_RESULT_CHARS = 12000

DEFAULT_COMMAND_TIMEOUT_SECONDS = 30
MAX_COMMAND_TIMEOUT_SECONDS = 60

ALLOWED_EXECUTABLES = {
    "python",
    "py",
    "node",
    "npm",
    "npx",
    "pytest",
    "git",
}

DEFAULT_WEB_TIMEOUT_SECONDS = 20
MAX_WEB_TIMEOUT_SECONDS = 30
MAX_WEB_FETCH_BYTES = 1500000
MAX_WEB_TEXT_CHARS = 20000

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
TAVILY_SEARCH_URL = "https://api.tavily.com/search"

DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS = 20
MAX_WEB_SEARCH_TIMEOUT_SECONDS = 30
DEFAULT_WEB_SEARCH_MAX_RESULTS = 5
MAX_WEB_SEARCH_MAX_RESULTS = 10
DEFAULT_WEB_SEARCH_TOPIC = "general"
DEFAULT_WEB_SEARCH_DEPTH = "basic"

ALLOWED_WEB_SEARCH_TOPICS = {"general", "news", "finance"}
ALLOWED_WEB_SEARCH_DEPTHS = {"basic", "advanced", "fast", "ultra-fast"}
ALLOWED_WEB_SEARCH_TIME_RANGES = {"day", "week", "month", "year", "d", "w", "m", "y"}

DEFAULT_AGENT_LOOP_MAX_STEPS = 5
MAX_AGENT_LOOP_MAX_STEPS = 8
MAX_AGENT_HISTORY_CHARS = 18000
AGENT_ACTION_PARSE_RETRIES = 3

MESSAGES_FILENAME = "messages.jsonl"
LEGACY_CHAT_FILENAME = "chat.txt"
SUMMARY_FILENAME = "summary.json"
TASKS_FILENAME = "tasks.json"
NOTES_FILENAME = "notes.json"
MEMORY_FILENAME = "memory_entries.json"
APPROVALS_FILENAME = "approvals.json"
ACTIVITY_FILENAME = "activity.jsonl"
TESTS_FILENAME = "tests.json"
RUNS_FILENAME = "runs.jsonl"

SNAPSHOTS_DIRNAME = "snapshots"

SETTINGS_PATH = CONFIGS_BASE_PATH / "settings.json"
GLOBAL_ACTIVITY_PATH = CONFIGS_BASE_PATH / "global_activity.jsonl"

PROTECTED_SELF_UPGRADE_PATH_PREFIXES = [
    str((AI_SYSTEM_BASE_PATH / "secrets").resolve()),
]

