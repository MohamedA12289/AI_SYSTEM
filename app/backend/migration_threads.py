"""
Thread Migration Script

Migrates existing project messages from messages.jsonl to the new thread-based structure.
Each project's existing conversation becomes a single thread with auto-generated title.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from datetime import datetime, timezone

from config import CONFIGS_BASE_PATH
from project_registry import list_registered_projects
from chat_store import (
    get_messages_path,
    get_threads_path,
    get_threads_dir,
    create_thread,
    get_thread_messages_path,
    ensure_threads_store,
)
from ai_client import generate_thread_title
from memory import get_project_path


MIGRATION_STATUS_FILE = CONFIGS_BASE_PATH / "migration_status.json"
MIGRATION_LOG_FILE = CONFIGS_BASE_PATH.parent / "logs" / "migration_threads.log"


def _log(message: str) -> None:
    """Log migration message to file and console"""
    timestamp = datetime.now(timezone.utc).isoformat()
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    
    # Ensure logs directory exists
    MIGRATION_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    with MIGRATION_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(log_message + "\n")


def _read_migration_status() -> dict:
    """Read migration status file"""
    if not MIGRATION_STATUS_FILE.exists():
        return {"migrations": {}}
    try:
        return json.loads(MIGRATION_STATUS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"migrations": {}}


def _write_migration_status(status: dict) -> None:
    """Write migration status file"""
    MIGRATION_STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    MIGRATION_STATUS_FILE.write_text(json.dumps(status, indent=2), encoding="utf-8")


def _is_migration_complete(project_name: str) -> bool:
    """Check if migration is already complete for a project"""
    status = _read_migration_status()
    return status.get("migrations", {}).get(project_name, {}).get("threads_migrated", False)


def _mark_migration_complete(project_name: str) -> None:
    """Mark migration as complete for a project"""
    status = _read_migration_status()
    if "migrations" not in status:
        status["migrations"] = {}
    status["migrations"][project_name] = {
        "threads_migrated": True,
        "migrated_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_migration_status(status)


def _backup_project_messages(project_name: str) -> None:
    """Create backup of project messages before migration"""
    messages_path = get_messages_path(project_name)
    if not messages_path.exists():
        return
    
    backup_path = messages_path.with_suffix(".jsonl.backup")
    shutil.copy2(messages_path, backup_path)
    _log(f"  Backed up messages to {backup_path.name}")


def migrate_project_to_threads(project_name: str) -> bool:
    """
    Migrate a single project's messages to thread-based structure.
    Returns True if migration was performed, False if skipped.
    """
    try:
        _log(f"Migrating project: {project_name}")
        
        # Check if already migrated
        if _is_migration_complete(project_name):
            _log(f"  Already migrated, skipping")
            return False
        
        messages_path = get_messages_path(project_name)
        threads_path = get_threads_path(project_name)
        
        # If threads.json already exists, skip migration
        if threads_path.exists():
            _log(f"  threads.json already exists, marking as migrated")
            _mark_migration_complete(project_name)
            return False
        
        # If no messages.jsonl, just initialize empty threads store
        if not messages_path.exists() or messages_path.stat().st_size == 0:
            _log(f"  No messages to migrate, initializing empty threads store")
            ensure_threads_store(project_name)
            _mark_migration_complete(project_name)
            return True
        
        # Backup existing messages
        _backup_project_messages(project_name)
        
        # Read all existing messages
        messages = []
        for raw_line in messages_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                messages.append(json.loads(line))
            except Exception:
                continue
        
        if not messages:
            _log(f"  No valid messages found, initializing empty threads store")
            ensure_threads_store(project_name)
            _mark_migration_complete(project_name)
            return True
        
        _log(f"  Found {len(messages)} messages to migrate")
        
        # Generate title from first user message
        first_user_message = None
        for msg in messages:
            if msg.get("role") == "user":
                first_user_message = msg.get("content", "")
                break
        
        if first_user_message:
            try:
                title = generate_thread_title(first_user_message)
                _log(f"  Generated title: {title}")
            except Exception as e:
                _log(f"  Title generation failed: {e}, using fallback")
                title = "Initial Conversation"
        else:
            title = "Initial Conversation"
        
        # Create thread
        thread = create_thread(project_name, title)
        thread_id = thread["thread_id"]
        _log(f"  Created thread: {thread_id}")
        
        # Write all messages to thread JSONL file
        thread_messages_path = get_thread_messages_path(project_name, thread_id)
        with thread_messages_path.open("w", encoding="utf-8") as f:
            for msg in messages:
                # Add thread_id to message
                msg["thread_id"] = thread_id
                f.write(json.dumps(msg, ensure_ascii=False) + "\n")
        
        _log(f"  Migrated {len(messages)} messages to thread {thread_id}")
        
        # Update thread metadata
        from chat_store import _read_threads_json, _write_threads_json
        data = _read_threads_json(project_name)
        for t in data["threads"]:
            if t["thread_id"] == thread_id:
                t["message_count"] = len(messages)
                # Keep original created_at from first message if available
                if messages:
                    t["created_at"] = messages[0].get("timestamp", t["created_at"])
                    t["updated_at"] = messages[-1].get("timestamp", t["updated_at"])
                break
        _write_threads_json(project_name, data)
        
        _log(f"  Updated thread metadata (message_count: {len(messages)})")
        
        # Mark migration complete
        _mark_migration_complete(project_name)
        _log(f"  Migration complete for {project_name}")
        
        return True
        
    except Exception as e:
        _log(f"  ERROR migrating {project_name}: {e}")
        import traceback
        _log(traceback.format_exc())
        return False


def migrate_all_projects() -> dict:
    """
    Migrate all projects to thread-based structure.
    Returns summary of migration results.
    """
    _log("=" * 60)
    _log("Starting thread migration for all projects")
    _log("=" * 60)
    
    try:
        projects_data = list_registered_projects()
        projects = projects_data.get("projects", [])
        
        if not projects:
            _log("No projects found")
            return {"total": 0, "migrated": 0, "skipped": 0, "errors": 0}
        
        _log(f"Found {len(projects)} projects")
        
        results = {"total": len(projects), "migrated": 0, "skipped": 0, "errors": 0}
        
        for project in projects:
            project_name = project.get("project_name")
            if not project_name:
                continue
            
            try:
                migrated = migrate_project_to_threads(project_name)
                if migrated:
                    results["migrated"] += 1
                else:
                    results["skipped"] += 1
            except Exception as e:
                _log(f"ERROR: Failed to migrate {project_name}: {e}")
                results["errors"] += 1
        
        _log("=" * 60)
        _log(f"Migration complete: {results['migrated']} migrated, {results['skipped']} skipped, {results['errors']} errors")
        _log("=" * 60)
        
        return results
        
    except Exception as e:
        _log(f"FATAL ERROR during migration: {e}")
        import traceback
        _log(traceback.format_exc())
        return {"total": 0, "migrated": 0, "skipped": 0, "errors": 1}


def run_migration_on_startup() -> None:
    """Run migration automatically on backend startup"""
    # Check if global migration has been run
    status = _read_migration_status()
    if status.get("global_migration_complete", False):
        return
    
    _log("Running thread migration on startup")
    results = migrate_all_projects()
    
    # Mark global migration as complete
    status["global_migration_complete"] = True
    status["global_migration_completed_at"] = datetime.now(timezone.utc).isoformat()
    status["migration_results"] = results
    _write_migration_status(status)


if __name__ == "__main__":
    # Allow running migration script manually
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--project":
        if len(sys.argv) > 2:
            project_name = sys.argv[2]
            _log(f"Manual migration for project: {project_name}")
            migrate_project_to_threads(project_name)
        else:
            print("Usage: python migration_threads.py --project <project_name>")
    else:
        # Migrate all projects
        migrate_all_projects()
