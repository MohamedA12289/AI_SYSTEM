import os
import json
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/customization", tags=["customization"])


class InstructionItem(BaseModel):
    id: str
    content: str
    created_at: str


class PromptItem(BaseModel):
    id: str
    name: str
    description: str
    template: str
    created_at: str


class HookItem(BaseModel):
    id: str
    trigger: str
    command: str
    enabled: bool


class MCPServerItem(BaseModel):
    id: str
    name: str
    command: str
    args: List[str]
    env: Dict[str, str]
    status: str


class PluginItem(BaseModel):
    id: str
    name: str
    version: str
    description: str
    enabled: bool


class AgentItem(BaseModel):
    id: str
    name: str
    model: str
    temperature: float
    system_prompt: str


class SkillItem(BaseModel):
    id: str
    name: str
    description: str
    implementation: str
    usage_count: int


def get_cubos_dir(project_path: str) -> Path:
    cubos_dir = Path(project_path) / ".cubos"
    cubos_dir.mkdir(exist_ok=True)
    return cubos_dir


def read_json_file(file_path: Path, default: Any = None) -> Any:
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return default if default is not None else []
    return default if default is not None else []


def write_json_file(file_path: Path, data: Any):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


@router.get("/instructions")
async def get_instructions(project_path: str) -> List[InstructionItem]:
    cubos_dir = get_cubos_dir(project_path)
    instructions_file = cubos_dir / "instructions.json"
    return read_json_file(instructions_file)


@router.post("/instructions")
async def add_instruction(project_path: str, instruction: InstructionItem):
    cubos_dir = get_cubos_dir(project_path)
    instructions_file = cubos_dir / "instructions.json"
    instructions = read_json_file(instructions_file)
    instructions.append(instruction.dict())
    write_json_file(instructions_file, instructions)
    return {"success": True, "instruction": instruction}


@router.delete("/instructions/{instruction_id}")
async def delete_instruction(project_path: str, instruction_id: str):
    cubos_dir = get_cubos_dir(project_path)
    instructions_file = cubos_dir / "instructions.json"
    instructions = read_json_file(instructions_file)
    instructions = [i for i in instructions if i.get("id") != instruction_id]
    write_json_file(instructions_file, instructions)
    return {"success": True}


@router.get("/prompts")
async def get_prompts(project_path: str) -> List[PromptItem]:
    cubos_dir = get_cubos_dir(project_path)
    prompts_file = cubos_dir / "prompts.json"
    return read_json_file(prompts_file)


@router.post("/prompts")
async def add_prompt(project_path: str, prompt: PromptItem):
    cubos_dir = get_cubos_dir(project_path)
    prompts_file = cubos_dir / "prompts.json"
    prompts = read_json_file(prompts_file)
    prompts.append(prompt.dict())
    write_json_file(prompts_file, prompts)
    return {"success": True, "prompt": prompt}


@router.get("/hooks")
async def get_hooks(project_path: str) -> List[HookItem]:
    cubos_dir = get_cubos_dir(project_path)
    hooks_file = cubos_dir / "hooks.json"
    return read_json_file(hooks_file)


@router.post("/hooks")
async def add_hook(project_path: str, hook: HookItem):
    cubos_dir = get_cubos_dir(project_path)
    hooks_file = cubos_dir / "hooks.json"
    hooks = read_json_file(hooks_file)
    hooks.append(hook.dict())
    write_json_file(hooks_file, hooks)
    return {"success": True, "hook": hook}


@router.patch("/hooks/{hook_id}")
async def update_hook(project_path: str, hook_id: str, enabled: bool):
    cubos_dir = get_cubos_dir(project_path)
    hooks_file = cubos_dir / "hooks.json"
    hooks = read_json_file(hooks_file)
    for hook in hooks:
        if hook.get("id") == hook_id:
            hook["enabled"] = enabled
    write_json_file(hooks_file, hooks)
    return {"success": True}


@router.get("/mcp_servers")
async def get_mcp_servers(project_path: str) -> List[MCPServerItem]:
    cubos_dir = get_cubos_dir(project_path)
    mcp_file = cubos_dir / "mcp_servers.json"
    return read_json_file(mcp_file)


@router.post("/mcp_servers")
async def add_mcp_server(project_path: str, server: MCPServerItem):
    cubos_dir = get_cubos_dir(project_path)
    mcp_file = cubos_dir / "mcp_servers.json"
    servers = read_json_file(mcp_file)
    servers.append(server.dict())
    write_json_file(mcp_file, servers)
    return {"success": True, "server": server}


@router.get("/plugins")
async def get_plugins(project_path: str) -> List[PluginItem]:
    cubos_dir = get_cubos_dir(project_path)
    plugins_file = cubos_dir / "plugins.json"
    return read_json_file(plugins_file)


@router.post("/plugins")
async def add_plugin(project_path: str, plugin: PluginItem):
    cubos_dir = get_cubos_dir(project_path)
    plugins_file = cubos_dir / "plugins.json"
    plugins = read_json_file(plugins_file)
    plugins.append(plugin.dict())
    write_json_file(plugins_file, plugins)
    return {"success": True, "plugin": plugin}


@router.patch("/plugins/{plugin_id}")
async def toggle_plugin(project_path: str, plugin_id: str, enabled: bool):
    cubos_dir = get_cubos_dir(project_path)
    plugins_file = cubos_dir / "plugins.json"
    plugins = read_json_file(plugins_file)
    for plugin in plugins:
        if plugin.get("id") == plugin_id:
            plugin["enabled"] = enabled
    write_json_file(plugins_file, plugins)
    return {"success": True}


@router.get("/agents")
async def get_agents(project_path: str) -> List[AgentItem]:
    cubos_dir = get_cubos_dir(project_path)
    agents_file = cubos_dir / "agents.json"
    return read_json_file(agents_file)


@router.post("/agents")
async def add_agent(project_path: str, agent: AgentItem):
    cubos_dir = get_cubos_dir(project_path)
    agents_file = cubos_dir / "agents.json"
    agents = read_json_file(agents_file)
    agents.append(agent.dict())
    write_json_file(agents_file, agents)
    return {"success": True, "agent": agent}


@router.get("/skills")
async def get_skills(project_path: str) -> List[SkillItem]:
    cubos_dir = get_cubos_dir(project_path)
    skills_file = cubos_dir / "skills.json"
    return read_json_file(skills_file)


@router.post("/skills")
async def add_skill(project_path: str, skill: SkillItem):
    cubos_dir = get_cubos_dir(project_path)
    skills_file = cubos_dir / "skills.json"
    skills = read_json_file(skills_file)
    skills.append(skill.dict())
    write_json_file(skills_file, skills)
    return {"success": True, "skill": skill}
