"""MCP (Model Context Protocol) plugin client.

Loads server definitions from a JSON config (default: ``~/.cubos/mcp.json``),
launches each server on demand via stdio, lists their tools, and lets the
agent invoke tools by ``server.tool`` name. Uses the official ``mcp``
Python SDK when available and falls back to a clear error otherwise.

Config schema (mcp.json)::

    {
      "servers": {
        "fs": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/some/dir"],
          "env": {"OPTIONAL": "value"}
        }
      }
    }
"""
from __future__ import annotations

import asyncio
import json
import os
import threading
from typing import Any, Dict, List, Optional

# Try to import the MCP SDK lazily so import failures don't kill the backend.
_MCP_AVAILABLE = False
try:
    from mcp import ClientSession, StdioServerParameters  # type: ignore
    from mcp.client.stdio import stdio_client  # type: ignore
    _MCP_AVAILABLE = True
except Exception:
    ClientSession = None  # type: ignore
    StdioServerParameters = None  # type: ignore
    stdio_client = None  # type: ignore


DEFAULT_CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".cubos", "mcp.json")


def is_available() -> bool:
    return _MCP_AVAILABLE


def load_config(path: Optional[str] = None) -> Dict[str, Any]:
    p = path or DEFAULT_CONFIG_PATH
    if not os.path.isfile(p):
        return {"servers": {}}
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"servers": {}}
        if "servers" not in data or not isinstance(data["servers"], dict):
            data["servers"] = {}
        return data
    except Exception as e:
        return {"servers": {}, "error": f"Failed to parse {p}: {e}"}


# --- Async core --------------------------------------------------------------
async def _list_tools_async(server_name: str, server_cfg: dict) -> Dict[str, Any]:
    if not _MCP_AVAILABLE:
        raise RuntimeError("mcp SDK not installed")
    params = StdioServerParameters(
        command=server_cfg["command"],
        args=server_cfg.get("args", []),
        env={**os.environ, **(server_cfg.get("env") or {})},
    )
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as session:
            await session.initialize()
            tools = await session.list_tools()
            out = []
            for t in tools.tools:
                out.append({
                    "name": t.name,
                    "description": getattr(t, "description", "") or "",
                    "input_schema": getattr(t, "inputSchema", None),
                })
            return {"server": server_name, "tools": out}


async def _call_tool_async(server_name: str, server_cfg: dict, tool: str, arguments: dict) -> Dict[str, Any]:
    if not _MCP_AVAILABLE:
        raise RuntimeError("mcp SDK not installed")
    params = StdioServerParameters(
        command=server_cfg["command"],
        args=server_cfg.get("args", []),
        env={**os.environ, **(server_cfg.get("env") or {})},
    )
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as session:
            await session.initialize()
            result = await session.call_tool(tool, arguments=arguments or {})
            content_out: List[Any] = []
            for c in getattr(result, "content", []) or []:
                t = getattr(c, "type", None)
                if t == "text":
                    content_out.append({"type": "text", "text": getattr(c, "text", "")})
                else:
                    content_out.append({"type": t or "unknown", "raw": str(c)})
            return {
                "server": server_name,
                "tool": tool,
                "isError": bool(getattr(result, "isError", False)),
                "content": content_out,
            }


def _run_async(coro) -> Any:
    """Run an async coroutine from sync context, even if a loop already exists."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Off-thread execution
            box: Dict[str, Any] = {}

            def runner():
                box["v"] = asyncio.run(coro)

            t = threading.Thread(target=runner, daemon=True)
            t.start()
            t.join()
            return box.get("v")
    except RuntimeError:
        pass
    return asyncio.run(coro)


# --- Public sync API ---------------------------------------------------------
def list_servers(config_path: Optional[str] = None) -> Dict[str, Any]:
    cfg = load_config(config_path)
    return {
        "available": _MCP_AVAILABLE,
        "config_path": config_path or DEFAULT_CONFIG_PATH,
        "servers": list((cfg.get("servers") or {}).keys()),
        "config": cfg,
    }


def list_tools(server_name: str, config_path: Optional[str] = None) -> Dict[str, Any]:
    if not _MCP_AVAILABLE:
        return {"available": False, "error": "mcp SDK not installed"}
    cfg = load_config(config_path)
    srv = (cfg.get("servers") or {}).get(server_name)
    if not srv:
        raise ValueError(f"MCP server {server_name!r} not in config")
    return _run_async(_list_tools_async(server_name, srv))


def call_tool(server_name: str, tool: str, arguments: Optional[dict] = None, config_path: Optional[str] = None) -> Dict[str, Any]:
    if not _MCP_AVAILABLE:
        return {"available": False, "error": "mcp SDK not installed"}
    cfg = load_config(config_path)
    srv = (cfg.get("servers") or {}).get(server_name)
    if not srv:
        raise ValueError(f"MCP server {server_name!r} not in config")
    return _run_async(_call_tool_async(server_name, srv, tool, arguments or {}))


def run_mcp_op(project_name: str, op: str, args: dict) -> Dict[str, Any]:
    """Dispatcher used by agent_tools."""
    op = (op or "").strip().lower()
    cfg_path = args.get("config_path")
    if op in ("", "list_servers", "servers"):
        return list_servers(cfg_path)
    if op in ("list_tools", "tools"):
        srv = args.get("server")
        if not srv:
            raise ValueError("mcp list_tools requires 'server'")
        return list_tools(srv, cfg_path)
    if op in ("call", "call_tool", "invoke"):
        srv = args.get("server")
        tool = args.get("tool")
        if not srv or not tool:
            raise ValueError("mcp call requires 'server' and 'tool'")
        return call_tool(srv, tool, args.get("arguments") or {}, cfg_path)
    raise ValueError(f"Unknown mcp op: {op!r}")
