import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskItem(BaseModel):
    id: str
    content: str
    status: str
    created_at: str
    updated_at: str


class UpdateTaskRequest(BaseModel):
    status: str


def get_tasks_file(project_path: str) -> Path:
    cubos_dir = Path(project_path) / ".cubos"
    cubos_dir.mkdir(exist_ok=True)
    return cubos_dir / "tasks.json"


def read_tasks(project_path: str) -> List[dict]:
    tasks_file = get_tasks_file(project_path)
    if tasks_file.exists():
        try:
            with open(tasks_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return []
    return []


def write_tasks(project_path: str, tasks: List[dict]):
    tasks_file = get_tasks_file(project_path)
    with open(tasks_file, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)


@router.get("")
async def get_tasks(project_path: str) -> List[TaskItem]:
    return read_tasks(project_path)


@router.post("")
async def create_task(project_path: str, task: TaskItem):
    tasks = read_tasks(project_path)
    tasks.append(task.dict())
    write_tasks(project_path, tasks)
    return {"success": True, "task": task}


@router.patch("/{task_id}")
async def update_task(project_path: str, task_id: str, request: UpdateTaskRequest):
    tasks = read_tasks(project_path)
    task_found = False
    for task in tasks:
        if task.get("id") == task_id:
            task["status"] = request.status
            task_found = True
            break
    
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found")
    
    write_tasks(project_path, tasks)
    return {"success": True}


@router.delete("/{task_id}")
async def delete_task(project_path: str, task_id: str):
    tasks = read_tasks(project_path)
    tasks = [t for t in tasks if t.get("id") != task_id]
    write_tasks(project_path, tasks)
    return {"success": True}
