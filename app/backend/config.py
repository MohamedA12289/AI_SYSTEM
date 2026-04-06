
import os
from pathlib import Path

AI_SYSTEM_BASE_PATH = Path(r"D:\AI_SYSTEM")
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

