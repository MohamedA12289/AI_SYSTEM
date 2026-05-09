"""
Context / prompt compression.

When the chat or agent context grows too large, we summarise older messages
into a compact synopsis so that newer turns keep more breathing room.

Two entry points:

* :func:`approx_token_count` - cheap heuristic (chars / 4) so callers do not
  need the tokenizer-of-the-day.
* :func:`compress_messages` - given a list of ``{"role": ..., "content": ...}``
  dicts and a target token budget, returns a new list where leading turns are
  collapsed into a single ``role="system"`` summary message.

The summary is built locally (no AI call) by extracting the first sentence of
each older message. If an AI provider is available it could be used later, but
the deterministic path keeps things fast and offline-friendly.
"""

from __future__ import annotations

from typing import Iterable, List, Dict, Any

CHARS_PER_TOKEN = 4.0


def approx_token_count(text: str) -> int:
    """Cheap token estimate. ~4 chars per token works for English/code."""
    if not text:
        return 0
    return max(1, int(len(text) / CHARS_PER_TOKEN))


def messages_token_count(messages: Iterable[Dict[str, Any]]) -> int:
    total = 0
    for m in messages:
        content = m.get("content", "") if isinstance(m, dict) else ""
        if not isinstance(content, str):
            content = str(content)
        # +6 tokens of overhead per message for role/structure
        total += approx_token_count(content) + 6
    return total


def _first_sentence(text: str, limit: int = 220) -> str:
    text = (text or "").strip().replace("\n", " ")
    if not text:
        return ""
    for sep in (". ", "! ", "? "):
        idx = text.find(sep)
        if 0 < idx <= limit:
            return text[: idx + 1]
    return text[:limit] + ("..." if len(text) > limit else "")


def _summarise_block(messages: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for m in messages:
        role = (m.get("role") or "?")[:9]
        content = m.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        sentence = _first_sentence(content)
        if sentence:
            lines.append(f"- {role}: {sentence}")
    if not lines:
        return ""
    header = f"[Summary of {len(messages)} earlier messages]"
    return header + "\n" + "\n".join(lines)


def compress_messages(
    messages: List[Dict[str, Any]],
    max_tokens: int = 6000,
    keep_recent: int = 6,
) -> List[Dict[str, Any]]:
    """
    Return a new message list whose total approx-token count is <= max_tokens.

    Strategy:
        1. Always keep the first ``system`` message (instructions) if present.
        2. Always keep the last ``keep_recent`` messages verbatim.
        3. Replace everything in between with one summarised system message.

    If the result is still over budget, recent messages are progressively
    truncated from their start so the absolute newest turn remains intact.
    """
    if not messages:
        return []

    if messages_token_count(messages) <= max_tokens:
        return list(messages)

    head: List[Dict[str, Any]] = []
    body = list(messages)
    if body and body[0].get("role") == "system":
        head.append(body.pop(0))

    if len(body) <= keep_recent:
        result = head + body
    else:
        older = body[:-keep_recent]
        recent = body[-keep_recent:]
        summary = _summarise_block(older)
        result = list(head)
        if summary:
            result.append({"role": "system", "content": summary})
        result.extend(recent)

    # Hard cap if still over budget: trim oldest non-system messages' content.
    while messages_token_count(result) > max_tokens and len(result) > 2:
        for i in range(len(result)):
            if result[i].get("role") == "system":
                continue
            content = result[i].get("content", "")
            if isinstance(content, str) and len(content) > 400:
                result[i] = dict(result[i])
                result[i]["content"] = content[:400] + "\n[...truncated]"
                break
        else:
            break

    return result
