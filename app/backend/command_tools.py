import subprocess
from typing import Any

from config import (
    ALLOWED_EXECUTABLES,
    DEFAULT_COMMAND_TIMEOUT_SECONDS,
    MAX_COMMAND_TIMEOUT_SECONDS,
    MAX_TOOL_RESULT_CHARS,
)
from file_tools import get_project_root

def trim_command_output(value: str, limit: int = MAX_TOOL_RESULT_CHARS) -> str:
    if value is None:
        return ""
    if len(value) > limit:
        return value[:limit] + "\n\n[truncated]"
    return value

def normalize_command_list(command: Any) -> list[str]:
    if not isinstance(command, list):
        raise ValueError("Command must be a JSON array of strings.")

    if not command:
        raise ValueError("Command cannot be empty.")

    normalized: list[str] = []
    for part in command:
        if part is None:
            raise ValueError("Command contains an empty value.")

        text = str(part).strip()
        if not text:
            raise ValueError("Command contains an empty string.")

        normalized.append(text)

    return normalized

def validate_command(command: list[str]) -> None:
    executable = command[0].lower()

    if executable not in ALLOWED_EXECUTABLES:
        raise ValueError(
            f"Executable '{command[0]}' is not allowed. Allowed executables: {sorted(ALLOWED_EXECUTABLES)}"
        )

    forbidden_shell_tokens = {"&&", "||", "|", ">", ">>", "<"}
    for token in command:
        if token in forbidden_shell_tokens:
            raise ValueError(f"Shell operator '{token}' is not allowed.")

def normalize_timeout(timeout_seconds: Any) -> int:
    if timeout_seconds is None:
        return DEFAULT_COMMAND_TIMEOUT_SECONDS

    try:
        timeout_value = int(timeout_seconds)
    except (TypeError, ValueError):
        raise ValueError("timeout_seconds must be a valid integer.")

    if timeout_value <= 0:
        raise ValueError("timeout_seconds must be greater than 0.")

    if timeout_value > MAX_COMMAND_TIMEOUT_SECONDS:
        raise ValueError(
            f"timeout_seconds cannot be greater than {MAX_COMMAND_TIMEOUT_SECONDS}."
        )

    return timeout_value

def run_safe_command(
    project_name: str,
    command: Any,
    timeout_seconds: Any = DEFAULT_COMMAND_TIMEOUT_SECONDS,
) -> dict:
    normalized_command = normalize_command_list(command)
    validate_command(normalized_command)
    timeout_value = normalize_timeout(timeout_seconds)

    project_root = get_project_root(project_name)

    try:
        result = subprocess.run(
            normalized_command,
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=timeout_value,
            shell=False,
        )

        return {
            "executed": True,
            "timed_out": False,
            "command": normalized_command,
            "cwd": str(project_root),
            "exit_code": result.returncode,
            "stdout": trim_command_output(result.stdout),
            "stderr": trim_command_output(result.stderr),
        }

    except subprocess.TimeoutExpired as e:
        stdout = e.stdout if isinstance(e.stdout, str) else ""
        stderr = e.stderr if isinstance(e.stderr, str) else ""

        return {
            "executed": False,
            "timed_out": True,
            "command": normalized_command,
            "cwd": str(project_root),
            "exit_code": None,
            "stdout": trim_command_output(stdout),
            "stderr": trim_command_output(stderr),
            "detail": f"Command timed out after {timeout_value} seconds.",
        }

    except FileNotFoundError:
        raise ValueError(
            f"Executable '{normalized_command[0]}' is allowed by config but is not available on this PC."
        )