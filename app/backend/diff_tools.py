
from __future__ import annotations

import difflib

def build_unified_diff(old_text: str, new_text: str, path_label: str = "file") -> str:
    old_lines = str(old_text or "").splitlines()
    new_lines = str(new_text or "").splitlines()
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"{path_label}:before",
        tofile=f"{path_label}:after",
        lineterm=""
    )
    return "\n".join(diff)
