from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import websockets
from fastapi import HTTPException


REPO = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO / "app" / "backend"
VENV_PY = BACKEND_DIR / "venv" / "Scripts" / "python.exe"


def _python() -> str:
    return str(VENV_PY) if VENV_PY.exists() else sys.executable


def _free_port() -> int:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def _creationflags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _check_ai_timeout() -> tuple[bool, str]:
    sys.path.insert(0, str(BACKEND_DIR))
    import ollama_client

    original = ollama_client.ask_ai

    def slow_ai(*args: Any, **kwargs: Any):
        time.sleep(1)
        return "", {}

    ollama_client.ask_ai = slow_ai
    try:
        try:
            ollama_client.ask_ollama("slow", timeout=0.05)
        except HTTPException as exc:
            return exc.status_code == 504, f"status={exc.status_code}"
        return False, "ask_ollama returned instead of timing out"
    finally:
        ollama_client.ask_ai = original


def _wait_health(base_url: str, timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            response = httpx.get(base_url + "/", timeout=2.0)
            if response.status_code < 500:
                return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


async def _expect_http(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    expected_status: int,
    *,
    json_body: dict | None = None,
    max_ms: float | None = None,
) -> tuple[bool, str]:
    start = time.time()
    response = await client.request(method, path, json=json_body)
    latency_ms = (time.time() - start) * 1000
    ok = response.status_code == expected_status
    if max_ms is not None and latency_ms > max_ms:
        ok = False
    return ok, f"{response.status_code} in {latency_ms:.0f}ms"


async def _terminal_health(base_url: str) -> tuple[bool, str]:
    ws_url = base_url.replace("http://", "ws://") + "/ws/terminal/health"
    async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        if ready.get("type") != "ready":
            return False, f"first frame={ready}"
        await ws.send("__ping__")
        pong = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        return pong.get("type") == "pong", f"pong={pong}"


async def _terminal_ready(base_url: str) -> tuple[bool, str]:
    ws_url = base_url.replace("http://", "ws://") + "/ws/terminal/_codex_missing"
    async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        if ready.get("type") != "ready":
            return False, f"first frame={ready}"
        prelude = ""
        prelude_deadline = time.time() + 3
        while time.time() < prelude_deadline:
            try:
                prelude += str(await asyncio.wait_for(ws.recv(), timeout=0.5))
            except asyncio.TimeoutError:
                break
        await ws.send(json.dumps({"type": "input", "data": "echo hi\r\n"}))
        got = ""
        deadline = time.time() + 8
        while time.time() < deadline:
            try:
                got += str(await asyncio.wait_for(ws.recv(), timeout=1))
            except asyncio.TimeoutError:
                continue
            if "hi" in got.lower():
                return True, "ready plus echo"
        return False, f"ready but echo missing: prelude={prelude[:120]!r} got={got[:160]!r}"


async def _voice_ready(base_url: str) -> tuple[bool, str]:
    ws_url = base_url.replace("http://", "ws://") + "/ws/voice"
    async with websockets.connect(ws_url, open_timeout=5, close_timeout=2) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        return ready.get("type") == "ready", f"first frame={ready}"


async def _run_server_checks(base_url: str) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    async with httpx.AsyncClient(base_url=base_url, timeout=8.0) as client:
        ok, detail = await _expect_http(client, "GET", "/voice/available", 200, max_ms=6500)
        results.append(("voice available returns quickly", ok, detail))

        guarded_routes = [
            ("POST", "/project/_codex_missing/workspace/analyze", {}),
            ("POST", "/project/_codex_missing/coagent/workspace-map", {"focus": ""}),
            ("POST", "/project/_codex_missing/coagent/api-contracts", {}),
            ("POST", "/project/_codex_missing/coagent/project-state", {"focus": ""}),
            ("POST", "/chat", {"project_name": "_codex_missing", "prompt": "ping"}),
            ("POST", "/agent/chat", {"project_name": "_codex_missing", "prompt": "ping"}),
        ]
        for method, path, body in guarded_routes:
            ok, detail = await _expect_http(client, method, path, 404, json_body=body)
            results.append((f"{path} returns project 404", ok, detail))

    for name, check in [
        ("terminal health websocket ready/pong", _terminal_health),
        ("terminal session websocket ready", _terminal_ready),
        ("voice websocket ready", _voice_ready),
    ]:
        try:
            ok, detail = await check(base_url)
        except Exception as exc:
            ok, detail = False, f"{type(exc).__name__}: {exc}"
        results.append((name, ok, detail))
    return results


def main() -> int:
    os.environ.setdefault("CUBOS_BASE_PATH", str(REPO))
    results: list[tuple[str, bool, str]] = []
    ok, detail = _check_ai_timeout()
    results.append(("ask_ollama returns 504 on timeout", ok, detail))

    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["CUBOS_BASE_PATH"] = str(REPO)
    env["CUBOS_PORT"] = str(port)

    proc = subprocess.Popen(
        [_python(), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        creationflags=_creationflags(),
    )

    try:
        if not _wait_health(base_url):
            stderr = ""
            try:
                stderr = (proc.stderr.read() or b"").decode("utf-8", errors="replace")[-2000:]
            except Exception:
                pass
            results.append(("backend starts", False, stderr or "health timeout"))
        else:
            results.append(("backend starts", True, base_url))
            results.extend(asyncio.run(_run_server_checks(base_url)))
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    failures = 0
    for name, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {detail}")
        if not ok:
            failures += 1
    print(f"\nSprint 2 smoke: {len(results) - failures}/{len(results)} passed")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
