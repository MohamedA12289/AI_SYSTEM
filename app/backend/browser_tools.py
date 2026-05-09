"""Headless browser tool using Playwright (sync API).

Two operations are exposed:
  * ``browse(url)`` -> {url, title, markdown, length}
  * ``screenshot(url)`` -> {url, png_base64, bytes}

Both spin up a Chromium browser per call (cheap; Playwright reuses the
binary across calls). For heavy use a persistent context could be added.
"""
from __future__ import annotations

import base64
from typing import Any, Dict, Optional

_PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.sync_api import sync_playwright  # type: ignore
    _PLAYWRIGHT_AVAILABLE = True
except Exception:
    sync_playwright = None  # type: ignore

try:
    import html2text  # type: ignore
except Exception:
    html2text = None  # type: ignore


def is_available() -> bool:
    return _PLAYWRIGHT_AVAILABLE


def _html_to_markdown(html: str) -> str:
    if html2text is not None:
        h = html2text.HTML2Text()
        h.ignore_images = False
        h.ignore_links = False
        h.body_width = 0
        return h.handle(html)
    # Minimal fallback: strip tags
    import re
    text = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text


def browse(
    url: str,
    timeout_ms: int = 20000,
    wait_until: str = "domcontentloaded",
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    if not _PLAYWRIGHT_AVAILABLE:
        raise RuntimeError("playwright not installed")
    if not url or not isinstance(url, str):
        raise ValueError("browse requires a non-empty url")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx_kwargs: Dict[str, Any] = {}
            if user_agent:
                ctx_kwargs["user_agent"] = user_agent
            context = browser.new_context(**ctx_kwargs)
            page = context.new_page()
            page.goto(url, timeout=timeout_ms, wait_until=wait_until)
            try:
                title = page.title()
            except Exception:
                title = ""
            html = page.content()
            md = _html_to_markdown(html)
            return {
                "url": page.url,
                "title": title,
                "markdown": md,
                "length": len(md),
            }
        finally:
            try:
                browser.close()
            except Exception:
                pass


def screenshot(
    url: str,
    timeout_ms: int = 20000,
    wait_until: str = "domcontentloaded",
    full_page: bool = True,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    if not _PLAYWRIGHT_AVAILABLE:
        raise RuntimeError("playwright not installed")
    if not url or not isinstance(url, str):
        raise ValueError("screenshot requires a non-empty url")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx_kwargs: Dict[str, Any] = {}
            if user_agent:
                ctx_kwargs["user_agent"] = user_agent
            context = browser.new_context(**ctx_kwargs)
            page = context.new_page()
            page.goto(url, timeout=timeout_ms, wait_until=wait_until)
            png = page.screenshot(full_page=full_page)
            return {
                "url": page.url,
                "png_base64": base64.b64encode(png).decode("ascii"),
                "bytes": len(png),
            }
        finally:
            try:
                browser.close()
            except Exception:
                pass


def run_browser_op(project_name: str, op: str, args: dict) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if op == "available":
        return {"available": _PLAYWRIGHT_AVAILABLE}
    url = args.get("url", "")
    if op == "browse":
        return browse(
            url,
            timeout_ms=int(args.get("timeout_ms", 20000)),
            wait_until=str(args.get("wait_until", "domcontentloaded")),
            user_agent=args.get("user_agent"),
        )
    if op == "screenshot":
        return screenshot(
            url,
            timeout_ms=int(args.get("timeout_ms", 20000)),
            wait_until=str(args.get("wait_until", "domcontentloaded")),
            full_page=bool(args.get("full_page", True)),
            user_agent=args.get("user_agent"),
        )
    raise ValueError(f"Unknown browser op: {op!r}")
