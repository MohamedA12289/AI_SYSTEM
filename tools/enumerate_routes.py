"""Enumerate every backend route and every frontend API call.

Writes ROUTES.md at repo root with:
  - Backend routes (method, path, source file:line)
  - Frontend API call sites (method, path, source file:line)
  - Diff: frontend paths not present in backend (likely 404 bugs)
"""
from __future__ import annotations
import os
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "app" / "backend"
FRONTEND = REPO / "app" / "frontend" / "src"
ELECTRON = REPO / "app" / "frontend" / "electron"
OUT = REPO / "ROUTES.md"

SKIP_DIRS = {"venv", "__pycache__", "node_modules", "dist", "dist-backend",
             "dist-electron", "build", ".git"}

BACKEND_PAT = re.compile(
    r'@(?:app|router)\.(get|post|put|delete|patch|websocket)\(\s*[\'"]([^\'"]+)[\'"]'
)

# Frontend patterns we care about
FE_PATS = [
    # fetch("/path"), fetch(`/path`), fetch("http://.../path")
    re.compile(r'fetch\(\s*[`\'"]([^`\'"]+)[`\'"]'),
    # apiClient.get("/path"), api.post(`/path`)
    re.compile(r'(?:apiClient|api|backend)\.(?:get|post|put|delete|patch)\(\s*[`\'"]([^`\'"]+)[`\'"]'),
    # axios.get("/path")
    re.compile(r'axios\.(?:get|post|put|delete|patch)\(\s*[`\'"]([^`\'"]+)[`\'"]'),
    # new WebSocket("ws://.../path")
    re.compile(r'new\s+WebSocket\(\s*[`\'"]([^`\'"]+)[`\'"]'),
]


def iter_files(root: Path, exts: tuple[str, ...]):
    if not root.exists():
        return
    for dp, dirs, fns in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in fns:
            if fn.endswith(exts):
                yield Path(dp) / fn


def scan_backend():
    out = []  # (method, path, file:line)
    for p in iter_files(BACKEND, (".py",)):
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in BACKEND_PAT.finditer(text):
            line_no = text[: m.start()].count("\n") + 1
            out.append((m.group(1).upper(), m.group(2),
                        f"{p.relative_to(REPO)}:{line_no}"))
    return out


def _extract_path(s: str) -> str | None:
    """Normalize a string from fetch() etc. into a backend path, or None."""
    if not s:
        return None
    # Strip protocol+host
    s = re.sub(r'^https?://[^/]+', '', s)
    s = re.sub(r'^wss?://[^/]+', '', s)
    # ${API_BASE}/foo or ${baseUrl}/foo
    s = re.sub(r'^\$\{[^}]+\}', '', s)
    # leftover starting char
    if not s.startswith('/'):
        return None
    # Drop querystring
    s = s.split('?', 1)[0]
    return s


def scan_frontend():
    out = []
    for p in iter_files(FRONTEND, (".ts", ".tsx", ".js", ".jsx")):
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pat in FE_PATS:
            for m in pat.finditer(text):
                raw = m.group(1)
                path = _extract_path(raw)
                if not path:
                    continue
                line_no = text[: m.start()].count("\n") + 1
                # Determine method by surrounding text
                ctx = text[max(0, m.start() - 30): m.start() + 80]
                method = "GET"
                if ".post(" in ctx or "method: 'POST'" in ctx or 'method: "POST"' in ctx:
                    method = "POST"
                elif ".put(" in ctx or "method: 'PUT'" in ctx:
                    method = "PUT"
                elif ".delete(" in ctx or "method: 'DELETE'" in ctx:
                    method = "DELETE"
                elif ".patch(" in ctx:
                    method = "PATCH"
                elif "new WebSocket" in ctx:
                    method = "WS"
                out.append((method, path,
                            f"{p.relative_to(REPO)}:{line_no}", raw))
    # Also scan electron main/preload
    for p in iter_files(ELECTRON, (".cjs", ".js", ".ts")):
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pat in FE_PATS:
            for m in pat.finditer(text):
                raw = m.group(1)
                path = _extract_path(raw)
                if not path:
                    continue
                line_no = text[: m.start()].count("\n") + 1
                ctx = text[max(0, m.start() - 30): m.start() + 80]
                method = "GET"
                if ".post(" in ctx or "method: 'POST'" in ctx:
                    method = "POST"
                elif "new WebSocket" in ctx:
                    method = "WS"
                out.append((method, path,
                            f"{p.relative_to(REPO)}:{line_no}", raw))
    return out


def _path_match(fe_path: str, be_path: str) -> bool:
    """A frontend literal matches a backend route template if the segments line up."""
    fe = fe_path.rstrip('/').split('/')
    be = be_path.rstrip('/').split('/')
    if len(fe) != len(be):
        return False
    for f, b in zip(fe, be):
        if b.startswith('{') and b.endswith('}'):
            continue  # path param
        # frontend may have a template literal segment that is a placeholder
        if '${' in f:
            continue
        if f != b:
            return False
    return True


def main():
    be = scan_backend()
    fe = scan_frontend()

    # Dedupe
    be_set = {(m, p) for m, p, _ in be}
    fe_set = {}
    for m, p, src, raw in fe:
        fe_set.setdefault((m, p), []).append((src, raw))

    # Diff: frontend paths with no matching backend route
    missing = []
    for (m, p), sites in fe_set.items():
        if m == "WS":
            ok = any(_path_match(p, bp) for bm, bp in be_set if bm == "WEBSOCKET")
        else:
            ok = any(_path_match(p, bp) for bm, bp in be_set if bm == m)
            if not ok:
                # also allow if any method matches
                ok = any(_path_match(p, bp) for _, bp in be_set)
        if not ok:
            missing.append((m, p, sites))

    lines = ["# CubOS Route Manifest", "",
             f"Backend routes: **{len(be_set)}**  ·  Frontend call sites: **{len(fe)}**  ·  Unique frontend paths: **{len(fe_set)}**",
             f"Frontend paths with NO matching backend route: **{len(missing)}**",
             "",
             "## Backend routes", "",
             "| Method | Path | Source |", "|---|---|---|"]
    for m, p, src in sorted(be, key=lambda r: (r[1], r[0])):
        lines.append(f"| {m} | `{p}` | {src} |")

    lines += ["", "## Frontend call sites", "",
              "| Method | Path | Source | Raw |", "|---|---|---|---|"]
    for m, p, src, raw in sorted(fe, key=lambda r: (r[1], r[0])):
        raw_s = raw.replace('|', '\\|')
        lines.append(f"| {m} | `{p}` | {src} | `{raw_s}` |")

    lines += ["", "## Frontend paths with NO matching backend route (likely 404s)", ""]
    if not missing:
        lines.append("_(none — every frontend call has a backend route)_")
    else:
        lines.append("| Method | Path | Sites |")
        lines.append("|---|---|---|")
        for m, p, sites in sorted(missing):
            srcs = "<br>".join(s for s, _ in sites)
            lines.append(f"| {m} | `{p}` | {srcs} |")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Backend routes: {len(be_set)}")
    print(f"Frontend unique paths: {len(fe_set)}")
    print(f"Missing on backend: {len(missing)}")


if __name__ == "__main__":
    main()
