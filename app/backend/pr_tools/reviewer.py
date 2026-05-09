"""PR review/describe/improve/ask functions.

Each takes a unified diff (string) and returns a string analysis from the
active AI provider. Caller is responsible for producing the diff (e.g. via
`git_tools.run_git_op('diff')`).
"""
from __future__ import annotations

from typing import Optional

# ai_client lives at backend root; this file is in pr_tools/, so:
import sys, os
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from ai_client import ask_ai  # noqa: E402


_DESCRIBE_SYSTEM = (
    "You are a senior code reviewer. Given a unified diff, produce a concise "
    "PR description with these sections in markdown: ## Title (one line, "
    "conventional-commit style), ## Summary (2-4 bullets), ## Type (feat/fix/"
    "refactor/docs/test/chore), ## Files Changed (bullet list path: short "
    "purpose). Be terse and accurate. Do not invent changes that aren't in the diff."
)

_REVIEW_SYSTEM = (
    "You are a senior code reviewer. Given a unified diff, return a markdown "
    "review with: ## Score (1-10), ## Strengths (bullets), ## Issues "
    "(bullets, each tagged [bug]/[security]/[perf]/[style]/[test]), "
    "## Suggested Tests (bullets). Cite file paths and line ranges from the "
    "diff. If the diff is empty or trivial, say so plainly."
)

_IMPROVE_SYSTEM = (
    "You are a senior code reviewer. Given a unified diff, propose concrete "
    "code improvements. For each suggestion output a markdown block: file "
    "path on line one, then a minimal replacement snippet inside a fenced "
    "code block, then a one-line rationale. Limit to the 5 most impactful "
    "suggestions. If no improvements are warranted, say so."
)

_ASK_SYSTEM = (
    "You are a senior code reviewer answering questions about a unified diff. "
    "Be concrete, cite file paths and line numbers, do not speculate beyond "
    "what the diff shows."
)


def _truncate(diff: str, limit: int = 60000) -> str:
    if len(diff) <= limit:
        return diff
    return diff[:limit] + "\n\n[diff truncated]"


def pr_describe(diff: str, extra_context: Optional[str] = None) -> dict:
    if not diff or not diff.strip():
        return {"text": "No changes to describe (diff is empty).", "provider": "n/a"}
    user = _truncate(diff)
    if extra_context:
        user = f"Context:\n{extra_context}\n\nDiff:\n{user}"
    text, provider = ask_ai(_DESCRIBE_SYSTEM, user)
    return {"text": text, "provider": provider}


def pr_review(diff: str, extra_context: Optional[str] = None) -> dict:
    if not diff or not diff.strip():
        return {"text": "No changes to review (diff is empty).", "provider": "n/a"}
    user = _truncate(diff)
    if extra_context:
        user = f"Context:\n{extra_context}\n\nDiff:\n{user}"
    text, provider = ask_ai(_REVIEW_SYSTEM, user)
    return {"text": text, "provider": provider}


def pr_improve(diff: str, extra_context: Optional[str] = None) -> dict:
    if not diff or not diff.strip():
        return {"text": "No changes to improve (diff is empty).", "provider": "n/a"}
    user = _truncate(diff)
    if extra_context:
        user = f"Context:\n{extra_context}\n\nDiff:\n{user}"
    text, provider = ask_ai(_IMPROVE_SYSTEM, user)
    return {"text": text, "provider": provider}


def pr_ask(diff: str, question: str, extra_context: Optional[str] = None) -> dict:
    if not question or not question.strip():
        raise ValueError("pr_ask requires a non-empty 'question'.")
    user = f"Question: {question}\n\nDiff:\n{_truncate(diff or '')}"
    if extra_context:
        user = f"Context:\n{extra_context}\n\n" + user
    text, provider = ask_ai(_ASK_SYSTEM, user)
    return {"text": text, "provider": provider}


def run_pr_op(project_name: str, op: str, args: dict) -> dict:
    """Dispatcher used by agent_tools.

    Args:
      project_name: project scope (used to fetch diff if not supplied).
      op: one of 'describe', 'review', 'improve', 'ask'.
      args: { 'diff'?: str, 'question'?: str, 'context'?: str,
              'staged'?: bool, 'path'?: str }
            If 'diff' missing, calls git_tools.run_git_op to obtain it.
    """
    op = (op or "").strip().lower()
    diff = args.get("diff")
    if not diff:
        try:
            from git_tools import run_git_op  # local import to avoid cycles
        except Exception as e:
            raise RuntimeError(f"git_tools unavailable: {e}")
        git_args = {"staged": bool(args.get("staged", False))}
        if args.get("path"):
            git_args["path"] = args["path"]
        gres = run_git_op(project_name, "diff", git_args)
        diff = gres.get("diff") or gres.get("output") or gres.get("result") or ""
    ctx = args.get("context")
    if op == "describe":
        return pr_describe(diff, ctx)
    if op == "review":
        return pr_review(diff, ctx)
    if op == "improve":
        return pr_improve(diff, ctx)
    if op == "ask":
        return pr_ask(diff, args.get("question", ""), ctx)
    raise ValueError(f"Unknown pr op: {op!r}. Expected describe|review|improve|ask.")
