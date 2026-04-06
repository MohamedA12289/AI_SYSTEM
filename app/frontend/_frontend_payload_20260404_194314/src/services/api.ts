import type {
  ActivityEntry,
  AppSettings,
  Approval,
  AssistantMode,
  ChatMessage,
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
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API ${res.status}`);
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
    send: async (projectName: string, prompt: string, mode: AssistantMode) => {
      if (mode === "build") {
        try { return await api.chat.agentSend(projectName, prompt); } catch {}
      }
      const legacy = await api.chat.legacySend(projectName, prompt);
      return { assistant_message: legacy.response, action_payload: { action: "respond", args: { message: legacy.response } }, tool_execution: { executed: true, action: "respond", message: legacy.response } };
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
    list: async (projectName: string, status = "todo"): Promise<Approval[]> => (await request<{ items: Approval[] }>(`/project/${projectName}/approvals?status=${encodeURIComponent(status)}`)).items ?? [],
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
    workspaceAnalyze: (projectName: string, selected_paths: string[]) => post<any>(`/project/${projectName}/workspace/analyze`, { selected_paths }),
    pairReview: (projectName: string, selected_paths: string[]) => post<any>(`/project/${projectName}/pair/review`, { selected_paths }),
    pairPlan: (projectName: string, selected_paths: string[]) => post<any>(`/project/${projectName}/pair/plan`, { selected_paths }),
    refactorPreview: (projectName: string, path: string) => post<any>(`/project/${projectName}/pair/refactor-preview`, { path }),
    cowork: (projectName: string, mode: string, selected_paths: string[]) => post<any>(`/project/${projectName}/cowork/instruction`, { mode, selected_paths }),
    deepResearch: (projectName: string, query: string) => post<any>(`/project/${projectName}/research/deep-report`, { query }),
  },

  source: {
    link: (projectName: string, source_path: string, mode = "link_readonly") => post<any>(`/project/${projectName}/source/link`, { source_path, mode }),
  },

  media: {
    transcribe: (projectName: string, path: string, model_name = "base", task = "transcribe", language = "en") => post<any>(`/project/${projectName}/media/transcribe-file`, { path, model_name, task, language }),
    voiceChat: (projectName: string, path: string, prompt = "Please help with this audio.") => post<any>(`/project/${projectName}/voice/chat`, { path, prompt }),
  },

  scaffold: {
    app: (projectName: string, kind: string, target_dir: string) => post<any>(`/project/${projectName}/scaffold/app`, { kind, target_dir }),
  },

  github: {
    status: (projectName: string) => request<any>(`/project/${projectName}/github/status`),
    branches: (projectName: string) => request<any>(`/project/${projectName}/github/branches`),
    commit: (projectName: string, message: string) => post<any>(`/project/${projectName}/github/commit`, { message }),
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
    file: (projectName: string, path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/file`, { path, access_mode }),
    folder: (projectName: string, path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/folder`, { path, access_mode }),
    zip: (projectName: string, path: string, access_mode = "import") => post<any>(`/project/${projectName}/ingest/zip`, { path, access_mode }),
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
