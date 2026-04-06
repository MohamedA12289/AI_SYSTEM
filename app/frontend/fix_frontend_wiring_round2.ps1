$ErrorActionPreference = 'Stop'

$root = 'D:\AI_SYSTEM\app\frontend'
if (!(Test-Path $root)) { throw "Frontend folder not found: $root" }

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = Join-Path $root ("_wiring_fix_round2_backup_" + $timestamp)
New-Item -ItemType Directory -Path $backup -Force | Out-Null

$filesToBackup = @(
  'src\services\api.ts',
  'src\pages\ProjectWorkspacePage.tsx',
  'src\components\ChatMessage.tsx',
  'src\components\ProjectRightPanel.tsx'
)

foreach ($rel in $filesToBackup) {
  $src = Join-Path $root $rel
  if (Test-Path $src) {
    $dst = Join-Path $backup $rel
    New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
    Copy-Item $src $dst -Force
  }
}

$apiTs = @'
import type {
  ActivityEntry,
  AppSettings,
  Approval,
  AssistantMode,
  DashboardSummary,
  Document,
  IngestJob,
  MemoryEntry,
  Note,
  Project,
  ProjectFile,
  SearchResult,
  Secret,
  Snapshot,
  Task,
  TestCase,
} from "@/types";

const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  const body = options.body;
  if (body && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (error: any) {
    throw new Error(error?.message || "Failed to fetch");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text || `API ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail || parsed?.message || detail;
    } catch {}
    throw new Error(detail || `API ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function post<T>(path: string, body?: any) {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}
function patch<T>(path: string, body?: any) {
  return request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}
function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

export const api = {
  health: () => request<{ status: string; phase: string }>("/"),

  settings: {
    get: () => request<AppSettings>("/settings"),
    setAssistantMode: (mode: AssistantMode) => post<AppSettings>("/settings", { patch: { assistant: { mode } } }),
    patch: (patchValue: any) => post<AppSettings>("/settings", { patch: patchValue }),
  },

  models: {
    list: () => request<{ active_model: string; models: string[] }>("/models"),
    activate: (active_model: string) => post<any>("/models/active", { active_model }),
  },

  projects: {
    list: async (): Promise<Project[]> => {
      const data = await request<{ projects: Project[] }>("/projects");
      return data.projects ?? [];
    },
    get: (projectName: string) => request<Project>(`/projects/${projectName}`),
    create: (payload: { project_name: string; display_name?: string; description?: string; project_type?: string }) =>
      post<{ created: boolean; project: Project }>("/projects/create", payload),
    update: (projectName: string, payload: any) => patch<Project>(`/projects/${projectName}`, payload),
    archive: (projectName: string) => post<Project>(`/projects/${projectName}/archive`, {}),
    delete: (projectName: string) => del<{ deleted: boolean }>(`/projects/${projectName}`),
    importExisting: (payload: { project_name: string; display_name?: string; description?: string; source_path: string; access_mode?: string }) =>
      post<any>("/projects/import", payload),
  },

  chat: {
    legacySend: (projectName: string, prompt: string) => post<{ response: string }>("/chat", { project_name: projectName, prompt }),
    agentSend: (projectName: string, prompt: string, allow_writes = false, allow_commands = false) =>
      post<any>("/agent/chat", { project_name: projectName, prompt, allow_writes, allow_commands }),
    agentLoop: (projectName: string, prompt: string, allow_writes = false, allow_commands = false, max_steps = 4) =>
      post<any>("/agent/loop", { project_name: projectName, prompt, allow_writes, allow_commands, max_steps }),
    send: async (projectName: string, prompt: string, mode: AssistantMode) => {
      if (mode === "build") {
        try {
          return await api.chat.agentLoop(projectName, prompt, false, false, 4);
        } catch {}
        try {
          return await api.chat.agentSend(projectName, prompt, false, false);
        } catch {}
      }
      const legacy = await api.chat.legacySend(projectName, prompt);
      return {
        assistant_message: legacy.response,
        action_payload: { action: "respond", args: { message: legacy.response } },
        tool_execution: { executed: true, action: "respond", message: legacy.response },
      };
    },
    messages: (projectName: string, offset = 0, limit = 100) => request<{ items: any[]; total: number; has_more: boolean }>(`/project/${projectName}/messages?offset=${offset}&limit=${limit}`),
    summary: (projectName: string) => request<any>(`/project/${projectName}/chat/summary`),
  },

  files: {
    list: (projectName: string, subpath = "") => request<{ project_name: string; items: ProjectFile[] }>(`/project/${projectName}/files?subpath=${encodeURIComponent(subpath)}`),
    read: (projectName: string, path: string) => request<{ project_name: string; path: string; content: string }>(`/project/${projectName}/file?path=${encodeURIComponent(path)}`),
    write: (projectName: string, path: string, content: string) => post<any>(`/project/${projectName}/file/write`, { path, content }),
    overwrite: (projectName: string, path: string, content: string) => post<any>(`/project/${projectName}/file/overwrite`, { path, content }),
    diff: (projectName: string, path: string, proposed_content: string) => request<any>(`/project/${projectName}/file/diff?path=${encodeURIComponent(path)}&proposed_content=${encodeURIComponent(proposed_content)}`),
  },

  tasks: {
    list: async (projectName: string): Promise<Task[]> => (await request<{ tasks: Task[] }>(`/project/${projectName}/tasks`)).tasks ?? [],
    create: (projectName: string, title: string, status = "todo") => post<Task>(`/project/${projectName}/tasks`, { title, status }),
    update: (projectName: string, id: string, payload: Partial<Task>) => patch<Task>(`/project/${projectName}/tasks/${id}`, payload),
    delete: (projectName: string, id: string) => del<{ deleted: boolean }>(`/project/${projectName}/tasks/${id}`),
  },

  notes: {
    list: async (projectName: string): Promise<Note[]> => (await request<{ notes: Note[] }>(`/project/${projectName}/notes`)).notes ?? [],
    create: (projectName: string, content: string) => post<Note>(`/project/${projectName}/notes`, { content }),
    update: (projectName: string, id: string, payload: Partial<Note>) => patch<Note>(`/project/${projectName}/notes/${id}`, payload),
    delete: (projectName: string, id: string) => del<{ deleted: boolean }>(`/project/${projectName}/notes/${id}`),
  },

  memory: {
    list: async (projectName: string): Promise<MemoryEntry[]> => (await request<{ entries: MemoryEntry[] }>(`/project/${projectName}/memory`)).entries ?? [],
    create: (projectName: string, key: string, value: string, pinned = false) => post<MemoryEntry>(`/project/${projectName}/memory`, { key, value, pinned }),
    update: (projectName: string, id: string, payload: Partial<MemoryEntry>) => patch<MemoryEntry>(`/project/${projectName}/memory/${id}`, payload),
    delete: (projectName: string, id: string) => del<{ deleted: boolean }>(`/project/${projectName}/memory/${id}`),
  },

  secrets: {
    list: async (): Promise<Secret[]> => (await request<{ items: Secret[] }>("/secrets")).items ?? [],
    set: (key: string, value: string) => post<any>(`/secrets/${encodeURIComponent(key)}`, { value }),
    reveal: (key: string) => post<any>(`/secrets/${encodeURIComponent(key)}/reveal`, {}),
    delete: (key: string) => del<any>(`/secrets/${encodeURIComponent(key)}`),
  },

  approvals: {
    list: async (projectName: string, status = "pending"): Promise<Approval[]> => (await request<{ items: Approval[] }>(`/project/${projectName}/approvals?status=${encodeURIComponent(status)}`)).items ?? [],
    approve: (projectName: string, approvalId: string, note = "") => post<any>(`/project/${projectName}/approvals/${approvalId}/approve`, { note }),
    reject: (projectName: string, approvalId: string, note = "") => post<any>(`/project/${projectName}/approvals/${approvalId}/reject`, { note }),
  },

  snapshots: {
    list: async (projectName: string): Promise<Snapshot[]> => (await request<{ items: Snapshot[] }>(`/project/${projectName}/snapshots`)).items ?? [],
    create: (projectName: string, note = "") => post<Snapshot>(`/project/${projectName}/snapshots`, { note }),
    restore: (projectName: string, snapshotId: string) => post<any>(`/project/${projectName}/snapshots/${snapshotId}/restore`, {}),
  },

  tests: {
    list: (projectName: string) => request<any>(`/project/${projectName}/tests`),
    create: (projectName: string, title: string, command: string[], timeout_seconds = 30) => post<TestCase>(`/project/${projectName}/tests`, { title, command, timeout_seconds }),
    run: (projectName: string, testId: string) => post<any>(`/project/${projectName}/tests/${testId}/run`, {}),
    delete: (projectName: string, testId: string) => del<any>(`/project/${projectName}/tests/${testId}`),
  },

  dashboard: {
    summary: (projectName: string, path: string) => post<DashboardSummary>(`/project/${projectName}/data/dashboard-summary`, { path }),
  },

  analysis: {
    workspaceAnalyze: (projectName: string, paths: string[], focus = "Give a broad high-level analysis.") => post<any>(`/project/${projectName}/workspace/analyze`, { paths, focus }),
    pairReview: (projectName: string, paths: string[], prompt = "Review this code and tell me the most important issues and improvements.") => post<any>(`/project/${projectName}/pair/review`, { paths, prompt }),
    pairPlan: (projectName: string, paths: string[], prompt = "Create a practical implementation plan for these files.") => post<any>(`/project/${projectName}/pair/plan`, { paths, prompt }),
    refactorPreview: (projectName: string, path: string, prompt = "Preview the best refactor for this file in plain language.") => post<any>(`/project/${projectName}/pair/refactor-preview`, { path, prompt }),
    cowork: (projectName: string, mode: string, paths: string[], instruction = "Help improve this workspace and explain the next best actions.") => post<any>(`/project/${projectName}/cowork/instruction`, { mode, paths, instruction }),
    deepResearch: (projectName: string, prompt: string) => post<any>(`/project/${projectName}/research/deep-report`, { prompt, save_report: false }),
  },

  source: {
    link: (projectName: string, source_path: string, mode = "link_readonly") => post<any>(`/projects/${projectName}/source/link`, { source_path, mode }),
  },

  media: {
    transcribe: (projectName: string, path: string, model_name = "base", task = "transcribe", language = "en") => post<any>(`/project/${projectName}/media/transcribe-file`, { path, model_name, task, language }),
    voiceChat: (projectName: string, path: string, model_name = "base", task = "transcribe", language = "en") => post<any>(`/project/${projectName}/voice/chat`, { path, model_name, task, language }),
  },

  scaffold: {
    app: (projectName: string, kind: string, target_dir: string, app_name = "generated_app") => post<any>(`/project/${projectName}/scaffold/app`, { kind, target_dir, app_name }),
  },

  github: {
    status: (projectName: string) => request<any>(`/project/${projectName}/github/status`),
    branches: (projectName: string) => request<any>(`/project/${projectName}/github/branches`),
    commit: (projectName: string, message: string, paths?: string[]) => post<any>(`/project/${projectName}/github/commit`, { message, paths }),
  },

  activity: {
    project: async (projectName: string, limit = 50): Promise<ActivityEntry[]> => (await request<{ items: ActivityEntry[] }>(`/project/${projectName}/activity?limit=${limit}`)).items ?? [],
    global: async (limit = 50): Promise<ActivityEntry[]> => (await request<{ items: ActivityEntry[] }>(`/activity?limit=${limit}`)).items ?? [],
  },

  documents: {
    list: async (projectName: string): Promise<Document[]> => (await request<{ documents: Document[] }>(`/project/${projectName}/documents`)).documents ?? [],
    search: (projectName: string, query: string) => request<{ query: string; results: any[] }>(`/project/${projectName}/documents/search?query=${encodeURIComponent(query)}`),
    detail: (projectName: string, documentId: string) => request<Document>(`/project/${projectName}/documents/${documentId}`),
    content: (projectName: string, documentId: string) => request<any>(`/project/${projectName}/documents/${documentId}/content`),
    summarize: (projectName: string, documentId: string) => post<any>(`/project/${projectName}/documents/${documentId}/summarize`, {}),
  },

  ingest: {
    jobs: async (projectName: string): Promise<IngestJob[]> => (await request<{ jobs: IngestJob[] }>(`/project/${projectName}/ingest/jobs`)).jobs ?? [],
    file: (projectName: string, source_path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/file`, { source_path, access_mode }),
    folder: (projectName: string, source_path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/folder`, { source_path, access_mode }),
    zip: (projectName: string, source_path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/zip`, { source_path, access_mode }),
  },

  projectSearch: {
    query: (projectName: string, query: string) => request<{ query: string; results: SearchResult[] }>(`/project/${projectName}/search?query=${encodeURIComponent(query)}`),
  },
};

export function isoToTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

export function groupTimestamp(value?: string | null): "today" | "yesterday" | "older" {
  if (!value) return "older";
  const d = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return "today";
  if (d >= startYesterday) return "yesterday";
  return "older";
}

export function projectToDisplay(p: Project) {
  return {
    id: p.project_name,
    name: p.display_name || p.project_name,
    description: p.description || "",
    status: p.archived ? "archived" : "active",
  };
}
'@

$chatMessageTsx = @'
import { Bot, User, Brain, AlertTriangle, Terminal, Loader2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";
import { ApprovalCard } from "./ApprovalCard";
import { ToolResultCard } from "./ToolResultCard";

interface Props {
  message: ChatMessageType;
  isSelfUpgrade?: boolean;
}

const richToolTypes = [
  "review_result", "plan_result", "refactor_result", "cowork_result",
  "research_result", "scaffold_result", "data_summary", "transcript_result",
  "voice_result", "analysis_result",
];

function cleanDisplayText(input?: string) {
  const text = String(input ?? "");
  return text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\[[0-9]+[A-Za-z]\](?:\[K\])?/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r/g, "")
    .trim();
}

export function ChatMessage({ message, isSelfUpgrade }: Props) {
  const safeMessage = { ...message, content: cleanDisplayText(message.content) };

  if (safeMessage.role === "approval") {
    return <ApprovalCard message={safeMessage} isSelfUpgrade={isSelfUpgrade} />;
  }

  if (safeMessage.role === "tool" && safeMessage.toolType && richToolTypes.includes(safeMessage.toolType)) {
    return <ToolResultCard message={safeMessage} />;
  }

  const isUser = safeMessage.role === "user";
  const isPlanning = safeMessage.role === "planning";
  const isTool = safeMessage.role === "tool";
  const isStatus = safeMessage.role === "status";

  if (isTool) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-muted-foreground animate-fade-in">
        <Terminal className="w-3.5 h-3.5" />
        <span className="whitespace-pre-wrap break-words">{safeMessage.content}</span>
        <span className="ml-auto text-[10px]">{safeMessage.timestamp}</span>
      </div>
    );
  }

  if (isStatus) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground animate-fade-in">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{safeMessage.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
          isPlanning
            ? isSelfUpgrade ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
            : "bg-secondary text-foreground"
        }`}>
          {isPlanning ? (isSelfUpgrade ? <AlertTriangle className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />) : <Bot className="w-3.5 h-3.5" />}
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? "order-first" : ""}`}>
        {isPlanning && (
          <span className={`text-[10px] font-medium mb-1 block ${isSelfUpgrade ? "text-warning" : "text-muted-foreground"}`}>
            {isSelfUpgrade ? "Planning (Self-Upgrade)" : "Planning"}
          </span>
        )}
        <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-foreground text-background"
            : isPlanning
              ? isSelfUpgrade ? "bg-warning/5 border border-warning/15 text-foreground" : "bg-secondary/60 border border-border text-foreground"
              : "bg-card border border-border text-card-foreground"
        }`}>
          <pre className="whitespace-pre-wrap font-sans break-words">{safeMessage.content || "(empty)"}</pre>
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 block">{safeMessage.timestamp}</span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-secondary flex items-center justify-center mt-0.5">
          <User className="w-3.5 h-3.5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
'@

$rightPanelTsx = @'
import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Key, Brain, ListTodo, StickyNote, Activity, FileText, Upload, GitBranch, PanelRightClose, Shield, Mic, Link2, BarChart3, Camera, TestTube, Search } from "lucide-react";
import { api, isoToTime } from "@/services/api";
import type { Approval, Document, MemoryEntry, Note, ProjectFile, Secret, Snapshot, Task, IngestJob, ActivityEntry } from "@/types";

const categories = [
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "sources", label: "Sources", icon: Link2 },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "ingest", label: "Ingest", icon: Upload },
  { id: "secrets", label: "Secrets", icon: Key },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "snapshots", label: "Snaps", icon: Camera },
  { id: "tests", label: "Tests", icon: TestTube },
  { id: "approvals", label: "Approvals", icon: Shield },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "media", label: "Media", icon: Mic },
  { id: "github", label: "Git", icon: GitBranch },
];

interface Props {
  projectName?: string;
  onCollapse: () => void;
  isSelfUpgrade?: boolean;
  onSelectPath?: (path: string) => void;
  selectedPaths?: string[];
  refreshToken?: number;
}

export function ProjectRightPanel({ projectName, onCollapse, onSelectPath, selectedPaths = [], refreshToken = 0 }: Props) {
  const [activeTab, setActiveTab] = useState("files");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [ingestJobs, setIngestJobs] = useState<IngestJob[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const refresh = async () => {
    if (!projectName) return;
    const calls = [
      api.files.list(projectName).then((d) => setFiles(d.items ?? [])).catch(() => setFiles([])),
      api.memory.list(projectName).then(setMemory).catch(() => setMemory([])),
      api.tasks.list(projectName).then(setTasks).catch(() => setTasks([])),
      api.notes.list(projectName).then(setNotes).catch(() => setNotes([])),
      api.activity.project(projectName, 40).then(setActivity).catch(() => setActivity([])),
      api.snapshots.list(projectName).then(setSnapshots).catch(() => setSnapshots([])),
      api.documents.list(projectName).then(setDocuments).catch(() => setDocuments([])),
      api.approvals.list(projectName, 'pending').then(setApprovals).catch(() => setApprovals([])),
      api.ingest.jobs(projectName).then(setIngestJobs).catch(() => setIngestJobs([])),
      api.secrets.list().then(setSecrets).catch(() => setSecrets([])),
      api.github.status(projectName).then(setGitStatus).catch(() => setGitStatus(null)),
    ];
    await Promise.allSettled(calls);
  };

  useEffect(() => { refresh(); }, [projectName, refreshToken]);
  useEffect(() => {
    if (!projectName || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.projectSearch.query(projectName, searchQuery).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [projectName, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const toggleFile = (path: string) => onSelectPath?.(path);

  return (
    <aside className="w-80 border-l border-border bg-background flex flex-col h-screen">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground truncate">{projectName || 'Workspace'}</div>
        <div className="flex items-center gap-1">
          <button onClick={refresh} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Search className="w-4 h-4" /></button>
          <button onClick={onCollapse} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><PanelRightClose className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="px-2 py-2 border-b border-border grid grid-cols-5 gap-1">
        {categories.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors ${activeTab===tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
            <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="p-3 border-b border-border">
        <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search project files and content..." className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-28 overflow-auto">
            {searchResults.slice(0,8).map((r:any,i:number)=>(
              <div key={i} className="text-[11px] bg-surface rounded-md px-2 py-1">
                <div className="font-mono text-foreground truncate">{r.path}</div>
                <div className="text-muted-foreground truncate">{r.match}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {activeTab === 'files' && files.map((f) => (
          <button key={f.path} onClick={() => toggleFile(f.path)} className={`w-full text-left rounded-lg border px-3 py-2 ${selectedSet.has(f.path) ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}>
            <div className="text-[12px] text-foreground truncate">{f.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">{f.path}</div>
          </button>
        ))}
        {activeTab === 'memory' && <PanelList items={memory.map((m) => ({ title: m.key, subtitle: m.value }))} />}
        {activeTab === 'tasks' && <PanelList items={tasks.map((t) => ({ title: t.title, subtitle: t.status }))} />}
        {activeTab === 'notes' && <PanelList items={notes.map((n) => ({ title: n.content, subtitle: isoToTime(n.created_at) }))} />}
        {activeTab === 'activity' && <PanelList items={activity.map((a) => ({ title: a.action, subtitle: `${a.detail} • ${isoToTime(a.timestamp)}` }))} />}
        {activeTab === 'snapshots' && <PanelList items={snapshots.map((s) => ({ title: s.id, subtitle: isoToTime(s.created_at) }))} />}
        {activeTab === 'docs' && <PanelList items={documents.map((d) => ({ title: d.file_name, subtitle: d.relative_path || d.absolute_path || '' }))} />}
        {activeTab === 'ingest' && <PanelList items={ingestJobs.map((j) => ({ title: j.source_kind, subtitle: `${j.status} • ${j.documents_indexed ?? 0} indexed` }))} />}
        {activeTab === 'secrets' && <PanelList items={secrets.map((s) => ({ title: s.key, subtitle: String(s.value) }))} />}
        {activeTab === 'approvals' && (
          <div className="space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="text-[12px] text-foreground">{a.summary || a.approval_type}</div>
                <div className="text-[10px] text-muted-foreground mb-2">{isoToTime(a.created_at)}</div>
                <div className="flex gap-2">
                  <button onClick={async ()=>{ await api.approvals.approve(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-success/10 text-success text-[11px]">Approve</button>
                  <button onClick={async ()=>{ await api.approvals.reject(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-[11px]">Reject</button>
                </div>
              </div>
            ))}
            {approvals.length===0 && <Empty text="No pending approvals" />}
          </div>
        )}
        {activeTab === 'sources' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground">Linked sources are managed from New Project and Source Link actions.</div></div>}
        {activeTab === 'analysis' && <div className="space-y-2 text-[11px] text-muted-foreground"><div>Select files in the Files tab, then use the header tools.</div>{selectedPaths.length>0 && <div className="bg-surface rounded-lg p-2 text-foreground">Selected: {selectedPaths.join(', ')}</div>}</div>}
        {activeTab === 'media' && <div className="text-[11px] text-muted-foreground">Use header tools to transcribe audio or run voice chat.</div>}
        {activeTab === 'github' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground break-words">{gitStatus?.git_status?.stderr || gitStatus?.git_status?.stdout || 'No git data yet.'}</div></div>}
      </div>
    </aside>
  );
}

function PanelList({ items }: { items: { title: string; subtitle?: string }[] }) {
  if (!items.length) return <Empty text="Nothing here yet" />;
  return <div className="space-y-2">{items.map((item, idx) => <div key={idx} className="rounded-lg border border-border p-3"><div className="text-[12px] text-foreground break-words">{item.title}</div>{item.subtitle && <div className="text-[10px] text-muted-foreground break-words">{item.subtitle}</div>}</div>)}</div>;
}
function Empty({ text }: { text: string }) { return <div className="text-[11px] text-muted-foreground">{text}</div>; }
'@

$workspaceTsx = @'
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, PanelRight, Hammer, Play, Search, BarChart3, ListTodo, Wand2, Star, FileText, Package, GitCommit, ChevronDown, X, Mic, Link2 } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProjectRightPanel } from "@/components/ProjectRightPanel";
import { api, isoToTime, projectToDisplay } from "@/services/api";
import type { AssistantMode, ChatMessage as ChatMessageType, Project } from "@/types";

interface Props {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  assistantMode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
  forceProjectId?: string;
  isSelfUpgrade?: boolean;
}

const workspaceActions = [
  { label: "Analyze Workspace", icon: BarChart3, action: "analyze", mode: "both" },
  { label: "Pair Review", icon: Search, action: "review", mode: "both" },
  { label: "Pair Plan", icon: ListTodo, action: "plan", mode: "both" },
  { label: "Refactor Preview", icon: Wand2, action: "refactor", mode: "both" },
  { label: "Cowork", icon: Star, action: "cowork", mode: "both" },
  { label: "Deep Research", icon: FileText, action: "research", mode: "both" },
  { label: "Data Summary", icon: BarChart3, action: "summary", mode: "both" },
  { label: "Transcribe Media", icon: Mic, action: "transcribe", mode: "both" },
  { label: "Voice Chat", icon: Mic, action: "voice", mode: "both" },
  { label: "Source Link", icon: Link2, action: "source", mode: "both" },
  { label: "Scaffold App", icon: Package, action: "scaffold", mode: "build" },
  { label: "Git Commit", icon: GitCommit, action: "commit", mode: "build" },
] as const;

function cleanDisplayText(input?: string) {
  const text = String(input ?? "");
  return text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\[[0-9]+[A-Za-z]\](?:\[K\])?/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r/g, "")
    .trim();
}

function toChatMessages(items: any[]): ChatMessageType[] {
  return (items ?? []).map((m) => {
    const role = m.message_type === "approval"
      ? "approval"
      : m.message_type === "tool_result"
        ? "tool"
        : (m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user");

    return {
      id: m.id,
      role,
      content: cleanDisplayText(m.content || ""),
      timestamp: isoToTime(m.timestamp),
      approvalType: m.metadata?.approval_type,
      approvalData: m.metadata?.payload,
    } as ChatMessageType;
  });
}

export default function ProjectWorkspacePage({ rightPanelOpen, onToggleRightPanel, assistantMode, onModeChange, forceProjectId, isSelfUpgrade }: Props) {
  const params = useParams();
  const projectId = forceProjectId || params.projectId || "";
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [panelRefreshToken, setPanelRefreshToken] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const refresh = async () => {
    if (!projectId) return;
    try {
      const p = await api.projects.get(projectId);
      setProject(p);
    } catch {}
    try {
      const msg = await api.chat.messages(projectId, 0, 100);
      setMessages(toChatMessages(msg.items));
    } catch {}
    try {
      const fileResp = await api.files.list(projectId, "");
      setFileCount((fileResp.items ?? []).length);
    } catch {
      setFileCount(0);
    }
    setPanelRefreshToken((v) => v + 1);
  };

  useEffect(() => { refresh(); }, [projectId]);

  const appendToolResult = (data: any, toolType: ChatMessageType["toolType"]) => {
    const pretty = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    setMessages((prev) => [...prev, {
      id: `tool-${Date.now()}`,
      role: "tool",
      content: cleanDisplayText(pretty),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      toolType,
      toolData: data,
    }]);
  };

  const handleSend = async (content: string) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content, timestamp: now }]);

    try {
      const res = await api.chat.send(projectId, content, assistantMode);
      const text = cleanDisplayText(
        res?.assistant_message ||
        res?.response ||
        res?.tool_execution?.message ||
        "Done."
      );

      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: assistantMode === "plan" ? "planning" : "assistant",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);

      await refresh();
    } catch (e: any) {
      const message = cleanDisplayText(e?.message || "Backend request failed.") || "Backend request failed.";
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
  };

  const handleAction = async (action: string) => {
    setActionsOpen(false);
    const primaryPath = selectedPaths[0] || "smoke.txt";

    try {
      if (action === "analyze") appendToolResult(await api.analysis.workspaceAnalyze(projectId, selectedPaths.length ? selectedPaths : [primaryPath]), "analysis_result");
      else if (action === "review") appendToolResult(await api.analysis.pairReview(projectId, selectedPaths.length ? selectedPaths : [primaryPath]), "review_result");
      else if (action === "plan") appendToolResult(await api.analysis.pairPlan(projectId, selectedPaths.length ? selectedPaths : [primaryPath]), "plan_result");
      else if (action === "refactor") appendToolResult(await api.analysis.refactorPreview(projectId, primaryPath), "refactor_result");
      else if (action === "cowork") appendToolResult(await api.analysis.cowork(projectId, "review", selectedPaths.length ? selectedPaths : [primaryPath]), "cowork_result");
      else if (action === "research") {
        const query = window.prompt("Research query", "Give me a short research summary about OpenAI.") || "";
        if (!query) return;
        appendToolResult(await api.analysis.deepResearch(projectId, query), "research_result");
      }
      else if (action === "summary") {
        const path = window.prompt("CSV path for dashboard summary", "D:\\AI_SYSTEM\\app\\backend\\_smoke_assets_final\\sample.csv") || "";
        if (!path) return;
        appendToolResult(await api.dashboard.summary(projectId, path), "data_summary");
      }
      else if (action === "transcribe") {
        const path = window.prompt("Media file path", "D:\\AI_SYSTEM\\app\\backend\\_smoke_assets_final\\sample.wav") || "";
        if (!path) return;
        appendToolResult(await api.media.transcribe(projectId, path), "transcript_result");
      }
      else if (action === "voice") {
        const path = window.prompt("Media file path", "D:\\AI_SYSTEM\\app\\backend\\_smoke_assets_final\\sample.wav") || "";
        if (!path) return;
        appendToolResult(await api.media.voiceChat(projectId, path), "voice_result");
      }
      else if (action === "source") {
        const source_path = window.prompt("Source folder path", "D:\\AI_SYSTEM\\app\\backend\\_smoke_assets_final\\sample_folder") || "";
        if (!source_path) return;
        appendToolResult(await api.source.link(projectId, source_path), "fetch_result");
      }
      else if (action === "scaffold") {
        const kind = window.prompt("Scaffold kind", "fastapi_service") || "fastapi_service";
        const target_dir = window.prompt("Target directory", "generated_app") || "generated_app";
        appendToolResult(await api.scaffold.app(projectId, kind, target_dir, target_dir), "scaffold_result");
      }
      else if (action === "commit") {
        const message = window.prompt("Commit message", "Frontend workspace commit") || "";
        if (!message) return;
        appendToolResult(await api.github.commit(projectId, message), "command_output");
      }
      await refresh();
    } catch (e: any) {
      appendToolResult({ error: cleanDisplayText(e?.message || "Action failed") }, "command_output");
    }
  };

  const display = project ? projectToDisplay(project as any) : { name: projectId, description: "", status: "active" };
  const filteredActions = workspaceActions.filter((a) => a.mode === "both" || a.mode === assistantMode);

  return (
    <div className="flex-1 flex h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">{display.name}</h1>
              <p className="text-[10px] text-muted-foreground truncate">{display.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${assistantMode === "build" ? "bg-foreground/10 text-foreground" : "bg-info/10 text-info"}`}>
              {assistantMode === "build" ? <Hammer className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {assistantMode === "build" ? "Build" : "Plan"}
            </span>
            <button onClick={() => setSearchOpen(!searchOpen)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors"><Search className="w-3.5 h-3.5" /></button>
            <div className="relative" ref={actionsRef}>
              <button onClick={() => setActionsOpen(!actionsOpen)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Tools<ChevronDown className={`w-3 h-3 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} /></button>
              {actionsOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[220px] animate-scale-in origin-top-right">
                  <div className="p-1.5">
                    {filteredActions.map((action) => (
                      <button key={action.label} onClick={() => handleAction(action.action)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] text-foreground hover:bg-secondary/70 transition-colors text-left">
                        <action.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-md bg-secondary font-mono">{fileCount} files</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${display.status === 'active' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>{display.status}</span>
            {!rightPanelOpen && <button onClick={onToggleRightPanel} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors"><PanelRight className="w-4 h-4" /></button>}
          </div>
        </header>
        {searchOpen && (
          <div className="px-5 py-2 border-b border-border bg-background">
            <div className="relative max-w-lg mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search project files and content..." className="w-full pl-9 pr-8 py-2 text-[12px] bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" autoFocus />
              <button onClick={()=>{setSearchOpen(false); setSearchQuery('');}} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
        <div className="flex justify-center py-2">
          <button onClick={async()=>{setLoadingOlder(true); await refresh(); setLoadingOlder(false);}} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-md hover:bg-secondary">
            {loadingOlder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Loader2 className="w-3 h-3" />}Load older messages
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg) => <ChatMessage key={msg.id} message={msg as any} isSelfUpgrade={isSelfUpgrade} />)}
          </div>
        </div>
        <ChatInput placeholder={`Message ${display.name}...`} onSend={handleSend} assistantMode={assistantMode} onModeChange={onModeChange} />
      </div>
      {rightPanelOpen && (
        <ProjectRightPanel
          projectName={projectId}
          onCollapse={onToggleRightPanel}
          selectedPaths={selectedPaths}
          refreshToken={panelRefreshToken}
          onSelectPath={(path) => setSelectedPaths((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path])}
        />
      )}
    </div>
  );
}
'@

Set-Content -Path (Join-Path $root 'src\services\api.ts') -Value $apiTs -Encoding UTF8
Set-Content -Path (Join-Path $root 'src\components\ChatMessage.tsx') -Value $chatMessageTsx -Encoding UTF8
Set-Content -Path (Join-Path $root 'src\components\ProjectRightPanel.tsx') -Value $rightPanelTsx -Encoding UTF8
Set-Content -Path (Join-Path $root 'src\pages\ProjectWorkspacePage.tsx') -Value $workspaceTsx -Encoding UTF8

Write-Host "Frontend wiring round 2 applied. Backup: $backup" -ForegroundColor Green
Write-Host "Now run: npm run build" -ForegroundColor Yellow
