from __future__ import annotations

import subprocess
import sys
from typing import Any


def hidden_creationflags() -> int:
    if sys.platform != "win32":
        return 0
    return getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def with_hidden_subprocess(kwargs: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = dict(kwargs or {})
    if sys.platform == "win32" and "creationflags" not in merged:
        merged["creationflags"] = hidden_creationflags()
    return merged


def run_hidden(args, **kwargs):
    return subprocess.run(args, **with_hidden_subprocess(kwargs))
