"""
Git tool actions exposed to the agent via ``execute_agent_action``.

Backed by GitPython when available; falls back to ``subprocess.run(['git', ...])``.

Supported ops:

* ``status``   - working tree status (branch, ahead/behind, modified, untracked)
* ``log``      - last N commits (sha, author, date, summary)
* ``diff``     - unified diff (staged or unstaged, optional path)
* ``commit``   - stage paths (or all changes) and commit with message
* ``branch``   - create branch (and optionally checkout)
* ``checkout`` - switch branch
* ``stash``    - ``git stash push -m <message>``
* ``init``     - initialise a repo in the project root if none exists
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Dict, List

from file_tools import get_project_root
from process_utils import run_hidden

try:
    import git as _git  # GitPython
    _HAS_GITPYTHON = True
except Exception:
    _git = None
    _HAS_GITPYTHON = False


def _repo_root(project_name: str) -> Path:
    return get_project_root(project_name)


def _run_cli(cwd: Path, args: List[str], check: bool = False) -> Dict[str, Any]:
    proc = run_hidden(
        ["git"] + args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=60,
    )
    out = (proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")
    if check and proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {proc.stderr.strip() or out.strip()}")
    return {"exit_code": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr, "output": out}


def _open_repo(cwd: Path):
    if not _HAS_GITPYTHON:
        return None
    try:
        return _git.Repo(str(cwd))
    except Exception:
        return None


def run_git_op(project_name: str, op: str, args: Dict[str, Any]) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if not op:
        raise ValueError("git op required")
    cwd = _repo_root(project_name)

    if op == "init":
        if (cwd / ".git").exists():
            return {"status": "already_initialised", "path": str(cwd)}
        if _HAS_GITPYTHON:
            _git.Repo.init(str(cwd))
        else:
            _run_cli(cwd, ["init"], check=True)
        return {"status": "initialised", "path": str(cwd)}

    if op == "status":
        repo = _open_repo(cwd)
        if repo is not None:
            try:
                head = repo.head.ref.name if not repo.head.is_detached else "(detached)"
            except Exception:
                head = "(unknown)"
            modified = [item.a_path for item in repo.index.diff(None)]
            staged = [item.a_path for item in repo.index.diff("HEAD")] if repo.head.is_valid() else []
            untracked = list(repo.untracked_files)
            return {
                "branch": head,
                "modified": modified,
                "staged": staged,
                "untracked": untracked,
                "is_dirty": repo.is_dirty(untracked_files=True),
            }
        return _run_cli(cwd, ["status", "--short", "--branch"])

    if op == "log":
        limit = int(args.get("limit") or 20)
        repo = _open_repo(cwd)
        if repo is not None and repo.head.is_valid():
            commits = []
            for c in repo.iter_commits(max_count=limit):
                commits.append({
                    "sha": c.hexsha[:12],
                    "author": f"{c.author.name} <{c.author.email}>",
                    "date": c.committed_datetime.isoformat(),
                    "summary": c.summary,
                })
            return {"commits": commits}
        return _run_cli(cwd, ["log", f"-n{limit}", "--oneline", "--decorate"])

    if op == "diff":
        staged = bool(args.get("staged"))
        path = args.get("path") or ""
        cli_args = ["diff"]
        if staged:
            cli_args.append("--staged")
        if path:
            cli_args.extend(["--", str(path)])
        return _run_cli(cwd, cli_args)

    if op == "commit":
        message = str(args.get("message") or "").strip()
        if not message:
            raise ValueError("commit requires a non-empty 'message'")
        paths = args.get("paths") or []
        if not isinstance(paths, list):
            paths = [paths]
        repo = _open_repo(cwd)
        if repo is not None:
            if paths:
                repo.index.add([str(p) for p in paths])
            else:
                repo.git.add(A=True)
            commit = repo.index.commit(message)
            return {"sha": commit.hexsha[:12], "message": message}
        # CLI fallback
        if paths:
            _run_cli(cwd, ["add"] + [str(p) for p in paths], check=True)
        else:
            _run_cli(cwd, ["add", "-A"], check=True)
        return _run_cli(cwd, ["commit", "-m", message])

    if op == "branch":
        name = str(args.get("name") or "").strip()
        if not name:
            # list branches
            return _run_cli(cwd, ["branch", "--list"])
        checkout = bool(args.get("checkout", True))
        repo = _open_repo(cwd)
        if repo is not None:
            new_branch = repo.create_head(name)
            if checkout:
                new_branch.checkout()
            return {"branch": name, "checked_out": checkout}
        cli = ["checkout", "-b", name] if checkout else ["branch", name]
        return _run_cli(cwd, cli)

    if op == "checkout":
        name = str(args.get("name") or "").strip()
        if not name:
            raise ValueError("checkout requires 'name'")
        repo = _open_repo(cwd)
        if repo is not None:
            repo.git.checkout(name)
            return {"branch": name}
        return _run_cli(cwd, ["checkout", name])

    if op == "stash":
        message = str(args.get("message") or "").strip()
        cli = ["stash", "push"]
        if message:
            cli += ["-m", message]
        return _run_cli(cwd, cli)

    raise ValueError(f"Unknown git op: {op}")
