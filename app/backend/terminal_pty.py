"""
WebSocket terminal endpoint backed by a real PTY:
 - Windows: pywinpty (ConPTY)
 - Unix: built-in pty module + fork
Falls back to a simple subprocess line-runner if neither is available.
"""

from __future__ import annotations

import asyncio
import os
import sys
import json
import shlex
import pathlib
import subprocess
from typing import Dict, Any
from fastapi import WebSocket, WebSocketDisconnect

from memory import get_project_path
from project_registry import get_registered_project

active_terminals: Dict[str, dict] = {}

DEFAULT_COLS = 100
DEFAULT_ROWS = 30


def _resolve_cwd(project_name: str) -> str:
    try:
        project = get_registered_project(project_name)
        project_path = pathlib.Path(project["workspace_root"])
    except Exception:
        try:
            project_path = get_project_path(project_name)
        except Exception:
            project_path = pathlib.Path.home()
    if not project_path.exists():
        project_path = pathlib.Path.home()
    return str(project_path)


def _default_shell() -> list[str]:
    if sys.platform == "win32":
        comspec = os.environ.get("COMSPEC") or "cmd.exe"
        if os.environ.get("CUBOS_TERMINAL_SHELL"):
            return shlex.split(os.environ["CUBOS_TERMINAL_SHELL"], posix=False)
        return [comspec]
    shell = os.environ.get("SHELL") or "/bin/bash"
    return [shell, "-il"]


async def _run_winpty(websocket: WebSocket, project_name: str, cwd: str) -> bool:
    try:
        import winpty  # type: ignore
    except Exception as e:
        try:
            await websocket.send_json({
                "type": "output",
                "data": f"\x1b[33m[winpty unavailable: {e}; using fallback shell]\x1b[0m\r\n",
            })
        except Exception:
            pass
        return False

    loop = asyncio.get_running_loop()
    cols, rows = DEFAULT_COLS, DEFAULT_ROWS
    shell_argv = _default_shell()
    cmdline = subprocess.list2cmdline(shell_argv) if len(shell_argv) > 1 else shell_argv[0]

    try:
        pty_proc = winpty.PTY(cols, rows)
    except Exception as e:
        await websocket.send_json({"type": "output", "data": f"\x1b[31mPTY init failed: {e}\x1b[0m\r\n"})
        return False

    try:
        pty_proc.spawn(cmdline, cwd=cwd, env=os.environ.copy())
    except Exception as e:
        await websocket.send_json({"type": "output", "data": f"\x1b[31mPTY spawn failed: {e}\x1b[0m\r\n"})
        try: pty_proc.close()
        except Exception: pass
        return False

    stop = asyncio.Event()

    async def reader():
        while not stop.is_set():
            try:
                data = await loop.run_in_executor(None, pty_proc.read, 4096)
            except Exception:
                break
            if not data:
                if not pty_proc.isalive():
                    break
                await asyncio.sleep(0.02)
                continue
            text = data if isinstance(data, str) else data.decode("utf-8", errors="replace")
            try:
                await websocket.send_json({"type": "output", "data": text})
            except Exception:
                break
        try:
            await websocket.send_json({"type": "output", "data": "\r\n\x1b[33m[process exited]\x1b[0m\r\n"})
        except Exception:
            pass

    reader_task = asyncio.create_task(reader())

    try:
        while True:
            message = await websocket.receive_text()
            try:
                msg = json.loads(message)
            except Exception:
                continue
            t = msg.get("type")
            if t == "input":
                data = msg.get("data", "")
                try:
                    pty_proc.write(data)
                except Exception:
                    break
            elif t == "resize":
                try:
                    c = int(msg.get("cols") or DEFAULT_COLS)
                    r = int(msg.get("rows") or DEFAULT_ROWS)
                    pty_proc.set_size(c, r)
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop.set()
        try: pty_proc.close()
        except Exception: pass
        try: reader_task.cancel()
        except Exception: pass
    return True


async def _run_unix_pty(websocket: WebSocket, project_name: str, cwd: str) -> bool:
    if sys.platform == "win32":
        return False
    try:
        import pty
        import fcntl
        import termios
        import struct
        import signal
    except Exception:
        return False

    loop = asyncio.get_running_loop()
    shell_argv = _default_shell()

    pid, master_fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(cwd)
        except Exception:
            pass
        env = os.environ.copy()
        env.setdefault("TERM", "xterm-256color")
        try:
            os.execvpe(shell_argv[0], shell_argv, env)
        except Exception:
            os._exit(1)

    def set_size(cols: int, rows: int):
        try:
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except Exception:
            pass

    set_size(DEFAULT_COLS, DEFAULT_ROWS)
    stop = asyncio.Event()

    async def reader():
        while not stop.is_set():
            try:
                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
            except OSError:
                break
            if not data:
                break
            try:
                await websocket.send_json({"type": "output", "data": data.decode("utf-8", errors="replace")})
            except Exception:
                break
        try:
            await websocket.send_json({"type": "output", "data": "\r\n\x1b[33m[process exited]\x1b[0m\r\n"})
        except Exception:
            pass

    reader_task = asyncio.create_task(reader())

    try:
        while True:
            message = await websocket.receive_text()
            try:
                msg = json.loads(message)
            except Exception:
                continue
            t = msg.get("type")
            if t == "input":
                data = msg.get("data", "")
                try:
                    os.write(master_fd, data.encode("utf-8"))
                except Exception:
                    break
            elif t == "resize":
                try:
                    set_size(int(msg.get("cols") or DEFAULT_COLS), int(msg.get("rows") or DEFAULT_ROWS))
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop.set()
        try:
            os.kill(pid, signal.SIGHUP)
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass
        try:
            reader_task.cancel()
        except Exception:
            pass
    return True


async def _run_fallback(websocket: WebSocket, project_name: str, cwd: str):
    """Fallback line-based runner when no PTY is available."""
    async def send_output(text: str):
        try:
            await websocket.send_json({"type": "output", "data": text})
        except Exception:
            pass

    async def send_prompt():
        await send_output(f"\r\n\x1b[32m{cwd.replace(chr(92), '/')}\x1b[0m\x1b[33m $ \x1b[0m")

    await send_output(f"\x1b[1;33m[fallback shell - real PTY unavailable]\x1b[0m\r\n")
    await send_prompt()

    input_buffer = ""
    try:
        while True:
            message = await websocket.receive_text()
            try:
                msg = json.loads(message)
            except Exception:
                continue
            if msg.get("type") != "input":
                continue
            data = msg.get("data", "")
            for char in data:
                code = ord(char)
                if char in ("\r", "\n"):
                    await send_output("\r\n")
                    command = input_buffer.strip()
                    input_buffer = ""
                    if not command:
                        await send_prompt()
                        continue
                    if command.lower().startswith("cd ") or command.lower() == "cd":
                        parts = command.split(None, 1)
                        target = parts[1] if len(parts) > 1 else str(pathlib.Path.home())
                        target = target.strip().strip('"').strip("'")
                        try:
                            new_path = (pathlib.Path(cwd) / target).resolve()
                            if new_path.is_dir():
                                cwd = str(new_path)
                            else:
                                await send_output(f"\x1b[31mcd: no such directory: {target}\x1b[0m\r\n")
                        except Exception as e:
                            await send_output(f"\x1b[31mcd: {e}\x1b[0m\r\n")
                        await send_prompt()
                        continue
                    if command in ("clear", "cls"):
                        await send_output("\x1b[2J\x1b[H")
                        await send_prompt()
                        continue
                    try:
                        shell_cmd = ["cmd.exe", "/C", command] if sys.platform == "win32" else ["/bin/bash", "-c", command]
                        extra: dict[str, Any] = {}
                        if sys.platform == "win32":
                            extra["creationflags"] = 0x08000000
                        proc = await asyncio.create_subprocess_exec(
                            *shell_cmd,
                            stdin=asyncio.subprocess.DEVNULL,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.STDOUT,
                            cwd=cwd,
                            **extra,
                        )
                        while True:
                            chunk = await proc.stdout.read(1024)
                            if not chunk:
                                break
                            await send_output(chunk.decode("utf-8", errors="replace").replace("\n", "\r\n"))
                        await proc.wait()
                    except Exception as e:
                        await send_output(f"\x1b[31mError: {e}\x1b[0m\r\n")
                    await send_prompt()
                elif code == 127 or char == "\x08":
                    if input_buffer:
                        input_buffer = input_buffer[:-1]
                        await send_output("\x08 \x08")
                elif code == 3:
                    input_buffer = ""
                    await send_output("^C\r\n")
                    await send_prompt()
                elif code >= 32:
                    input_buffer += char
                    await send_output(char)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


async def handle_terminal_session(websocket: WebSocket, project_name: str):
    """Handle a terminal WebSocket session using a real PTY when available."""
    await websocket.accept()
    cwd = _resolve_cwd(project_name)
    active_terminals[project_name] = {"websocket": websocket, "cwd": cwd}

    try:
        await websocket.send_json({"type": "output", "data": f"\x1b[1;32mConnected to {project_name}\x1b[0m\r\n"})
    except Exception:
        return

    handled = False
    try:
        if sys.platform == "win32":
            handled = await _run_winpty(websocket, project_name, cwd)
        else:
            handled = await _run_unix_pty(websocket, project_name, cwd)
    except WebSocketDisconnect:
        handled = True
    except Exception:
        handled = False

    if not handled:
        try:
            await _run_fallback(websocket, project_name, cwd)
        except Exception:
            pass

    if project_name in active_terminals:
        del active_terminals[project_name]
