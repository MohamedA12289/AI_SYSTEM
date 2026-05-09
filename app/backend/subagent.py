"""Subagent / task tool.

Spawns a focused child agent that runs a tight loop:
  1. Build a system prompt from a role (via role_prompts.get_role_prompt).
  2. Call ai_client.ask_ai with the user task.
  3. Optionally do a small number of follow-up tool turns if the response
     is a JSON action; otherwise just return the text.

This is intentionally light-weight: it does NOT pollute the parent agent's
context. Use it for self-contained explorations like "summarise this file"
or "write a test for X".
"""
from __future__ import annotations

import json
from typing import Optional, List, Dict, Any

from ai_client import ask_ai
from role_prompts import get_role_prompt, list_roles


def _safe_role_prompt(role: Optional[str]) -> str:
    if not role:
        return "You are a focused subagent. Answer the task concisely."
    try:
        text = get_role_prompt(role)
        if text:
            return text
    except Exception:
        pass
    return f"You are a focused {role} subagent. Answer the task concisely."


def run_subagent(
    task: str,
    role: Optional[str] = None,
    project_name: Optional[str] = None,
    context: Optional[str] = None,
    extra_messages: Optional[List[Dict[str, str]]] = None,
    max_turns: int = 1,
) -> Dict[str, Any]:
    """Run a one-shot (default) subagent and return its answer.

    Args:
      task: the user-facing task description.
      role: optional role name (e.g. 'developer', 'architect'); if missing
            or unknown, a generic prompt is used.
      project_name: passed through for context only (this subagent does not
            execute project-scoped tools by default).
      context: extra context string injected before the task.
      extra_messages: optional list of {role, content} pairs prepended to
            the user prompt as transcript.
      max_turns: hard cap on follow-up turns. Default 1 (no follow-up).
    Returns:
      {"text": str, "provider": str, "role": str, "turns": int}
    """
    if not task or not str(task).strip():
        raise ValueError("run_subagent requires a non-empty 'task'.")

    system = _safe_role_prompt(role)
    parts: List[str] = []
    if project_name:
        parts.append(f"Project: {project_name}")
    if context:
        parts.append(f"Context:\n{context}")
    if extra_messages:
        for m in extra_messages:
            r = str(m.get("role", "user"))
            c = str(m.get("content", ""))
            parts.append(f"[{r}] {c}")
    parts.append(f"Task:\n{task}")
    user_prompt = "\n\n".join(parts)

    text, provider = ask_ai(system, user_prompt)
    turns = 1

    # Optional minimal follow-up loop: if the model returns an action JSON,
    # we don't actually execute it here (subagents are sandboxed); we just
    # surface it to the parent. max_turns reserved for future use.
    return {
        "text": text,
        "provider": provider,
        "role": role or "",
        "turns": turns,
    }


def run_subagent_op(project_name: str, op: str, args: dict) -> dict:
    """Dispatcher used by agent_tools."""
    op = (op or "").strip().lower()
    if op in ("", "run", "task"):
        return run_subagent(
            task=args.get("task", ""),
            role=args.get("role"),
            project_name=project_name,
            context=args.get("context"),
            extra_messages=args.get("messages"),
            max_turns=int(args.get("max_turns", 1)),
        )
    if op == "list_roles":
        try:
            return {"roles": list_roles()}
        except Exception as e:
            return {"roles": [], "error": str(e)}
    raise ValueError(f"Unknown subagent op: {op!r}")
