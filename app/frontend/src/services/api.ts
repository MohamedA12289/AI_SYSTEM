import type {
  ActivityEntry,
  AppSettings,
  Approval,
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
  Thread,
  ThreadMessage,
} from "@/types";

let BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
let baseInitialized = false;
let baseInitPromise: Promise<string> | null = null;

async function initializeBaseUrl(): Promise<string> {
  if (baseInitialized) return BASE;
  if (baseInitPromise) return baseInitPromise;
  baseInitPromise = (async () => {
    if (typeof window !== 'undefined' && (window as any).cubosDesktop?.getBackendPort) {
      try {
        const result = await (window as any).cubosDesktop.getBackendPort();
        if (result.ok && result.port) {
          BASE = `http://127.0.0.1:${result.port}`;
          console.log('[API] Using dynamic backend port:', result.port);
        }
      } catch (error) {
        console.warn('[API] Failed to get backend port, using default:', error);
      }
    }
    baseInitialized = true;
    return BASE;
  })();
  return baseInitPromise;
}

export const apiBaseReady = initializeBaseUrl();

export function getApiBase(): string { return BASE; }
export function getApiBaseAsync(): Promise<string> { return initializeBaseUrl(); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = await initializeBaseUrl();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  const body = options.body;
  if (body && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...options, headers });
  } catch (error: any) {
    throw new Error(error?.message || "Failed to fetch");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text || `API ${res.status}`;
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(text);
      const parsedDetail = parsedBody?.detail || parsedBody?.message;
      detail = typeof parsedDetail === "string" ? parsedDetail : parsedDetail ? JSON.stringify(parsedDetail) : detail;
    } catch {}
    const error = new Error(detail || `API ${res.status}`);
    (error as any).status = res.status;
    (error as any).body = parsedBody;
    (error as any).detail = parsedBody?.detail;
    throw error;
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
function put<T>(path: string, body?: any) {
  return request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
}
function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

type ProjectImportPayload = {
  path?: string;
  source_path?: string;
  project_name?: string;
  display_name?: string;
  description?: string;
  access_mode?: string;
};

type ProviderKey = "ollama" | "groq" | "openai" | "anthropic" | "openrouter";

type ProviderCatalog = {
  providers: ProviderKey[];
  ollama?: { active: string; models: string[] };
  groq?: { active: string; models: string[] };
  openai?: { active: string; models: string[] };
  anthropic?: { active: string; models: string[] };
  openrouter?: { active: string; models: string[] };
};

function normalizeProjectImportPayload(payload: ProjectImportPayload): ProjectImportPayload {
  const path = (payload.path || payload.source_path || "").trim();
  return {
    path,
    source_path: payload.source_path,
    project_name: payload.project_name,
    display_name: payload.display_name,
    description: payload.description ?? "",
    access_mode: payload.access_mode ?? "import",
  };
}

async function projectWorkspaceRoot(projectName: string): Promise<string> {
  const project = await request<Project>(`/projects/${encodeURIComponent(projectName)}`);
  const workspaceRoot = project.workspace_root || (project as any).project_path || (project as any).path;
  if (!workspaceRoot) throw new Error(`Project ${projectName} has no workspace path.`);
  return workspaceRoot;
}

function gitFileList(items: any[] | undefined): string[] {
  return (items ?? [])
    .map((item) => typeof item === "string" ? item : item?.file || item?.path || item?.name)
    .filter(Boolean);
}

function normalizeGitStatus(raw: any) {
  const stagedItems = raw?.staged ?? [];
  const unstagedItems = raw?.unstaged ?? [];
  const untrackedItems = unstagedItems.filter((item: any) => ["?", "??", "U"].includes(String(item?.status ?? item?.state ?? "")));
  const modifiedItems = unstagedItems.filter((item: any) => !untrackedItems.includes(item));
  return {
    ...raw,
    branch: raw?.branch || "main",
    ahead: raw?.ahead || 0,
    behind: raw?.behind || 0,
    staged: gitFileList(stagedItems),
    modified: gitFileList(raw?.modified ?? modifiedItems),
    untracked: gitFileList(raw?.untracked ?? untrackedItems),
  };
}

async function gitStatusForProjectPath(projectPath: string) {
  const raw = await request<any>(`/api/git/status?project_path=${encodeURIComponent(projectPath)}`);
  return normalizeGitStatus(raw);
}

async function stageGitFiles(projectPath: string, files: string[]) {
  if (!files.length) return null;
  return post<any>("/api/git/stage", { project_path: projectPath, files });
}

export const api = {
  health: () => request<{ status: string; phase: string }>("/"),

  settings: {
    get: () => request<AppSettings>("/settings"),
    patch: (patchValue: any) => post<AppSettings>("/settings", { patch: patchValue }),
  },

  provider: {
    get: () => request<{ active: string }>("/settings/provider"),
    set: (active: string) => post<{ active: string; settings: AppSettings }>("/settings/provider", { active }),
    list: () => request<ProviderCatalog>("/settings/providers"),
    setModel: (provider: ProviderKey, model: string) => post<{ provider: string; model: string; settings: AppSettings }>("/settings/provider/model", { provider, model }),
  },

  models: {
    list: () => request<{ active_model: string; models: string[] }>("/models"),
    activate: (active_model: string) => post<any>("/models/active", { active_model }),
    listOllama: () => request<{ models: string[]; error?: string }>("/ollama/models"),
  },

  groqModels: {
    list: () => request<{ active_groq_model: string; groq_models: string[] }>("/groq/models"),
    activate: (active_groq_model: string) => post<{ active_groq_model: string; settings: AppSettings }>("/groq/models/active", { active_groq_model }),
  },

  projects: {
    list: async (): Promise<Project[]> => {
      const data = await request<{ projects: Project[] }>("/projects");
      return data.projects ?? [];
    },
    get: (projectName: string) => request<Project>(`/projects/${encodeURIComponent(projectName)}`),
    create: (payload: { project_name: string; display_name?: string; description?: string; project_type?: string }) =>
      post<{ created: boolean; project: Project }>("/projects/create", payload),
    importExisting: (payload: ProjectImportPayload) =>
      post<{ imported: boolean; created?: boolean; project: Project; project_name?: string; linked_source?: string; access_mode?: string }>(
        "/projects/import",
        normalizeProjectImportPayload(payload),
      ),
    update: (projectName: string, payload: any) => patch<Project>(`/projects/${encodeURIComponent(projectName)}`, payload),
    archive: (projectName: string) => post<Project>(`/projects/${encodeURIComponent(projectName)}/archive`, {}),
    delete: (projectName: string) => del<{ deleted: boolean }>(`/projects/${encodeURIComponent(projectName)}`),
  },

  chat: {
    legacySend: (projectName: string, prompt: string) => post<{ response: string }>("/chat", { project_name: projectName, prompt }),
    agentSend: (projectName: string, prompt: string, allow_writes = false, allow_commands = false) =>
      post<any>("/agent/chat", { project_name: projectName, prompt, allow_writes, allow_commands }),
    agentLoop: (projectName: string, prompt: string, allow_writes = false, allow_commands = false, max_steps = 4) =>
      post<any>("/agent/loop", { project_name: projectName, prompt, allow_writes, allow_commands, max_steps }),
    messages: (projectName: string, offset = 0, limit = 100) => request<{ items: any[]; total: number; has_more: boolean }>(`/project/${projectName}/messages?offset=${offset}&limit=${limit}`),
    summary: (projectName: string) => request<any>(`/project/${projectName}/chat/summary`),
    stream: (projectName: string, prompt: string, onToken: (t: string) => void, onDone: () => void, onError: (e: string) => void): (() => void) => {
      const ctrl = new AbortController();
      initializeBaseUrl().then((base) => fetch(`${base}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName, prompt }),
        signal: ctrl.signal,
      })).then(async (res) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { onDone(); return; }
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") { onDone(); return; }
            try {
              const obj = JSON.parse(data);
              if (obj.token) onToken(obj.token);
              if (obj.error) onError(obj.error);
            } catch {}
          }
        }
        onDone();
      }).catch((err) => { if (err?.name !== "AbortError") onError(String(err)); });
      return () => ctrl.abort();
    },
  },

  threads: {
    list: (projectName: string) => request<{ threads: Thread[] }>(`/api/projects/${projectName}/threads`),
    create: (projectName: string, title?: string) =>
      post<{ thread: Thread }>(`/api/projects/${projectName}/threads`, { title }),
    get: (threadId: string) => request<{ thread: Thread }>(`/api/threads/${threadId}`),
    updateTitle: (threadId: string, title: string) =>
      put<{ thread: Thread }>(`/api/threads/${threadId}/title`, { title }),
    delete: (threadId: string) => del<{ deleted: boolean }>(`/api/threads/${threadId}`),
    messages: (threadId: string, offset = 0, limit = 100) =>
      request<{ items: ThreadMessage[]; total: number; has_more: boolean }>(`/api/threads/${threadId}/messages?offset=${offset}&limit=${limit}`),
    sendMessage: (threadId: string, content: string) =>
      post<{ message: ThreadMessage; auto_titled?: boolean }>(`/api/threads/${threadId}/messages`, { role: "user", content }),
    messageCount: (threadId: string) => request<{ count: number }>(`/api/threads/${threadId}/messages/count`),
    stream: (
      threadId: string,
      prompt: string,
      onToken: (t: string) => void,
      onDone: () => void,
      onError: (e: string) => void,
      opts?: { enableTools?: boolean; onTool?: (tool: { name: string; args: any; result_preview: string }) => void }
    ): (() => void) => {
      const ctrl = new AbortController();
      initializeBaseUrl().then((base) => fetch(`${base}/api/threads/${threadId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, enable_tools: !!opts?.enableTools }),
        signal: ctrl.signal,
      })).then(async (res) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { onDone(); return; }
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") { onDone(); return; }
            try {
              const obj = JSON.parse(data);
              if (obj.token) onToken(obj.token);
              if (obj.tool && opts?.onTool) opts.onTool(obj.tool);
              if (obj.error) onError(obj.error);
            } catch {}
          }
        }
        onDone();
      }).catch((err) => { if (err?.name !== "AbortError") onError(String(err)); });
      return () => {
        // Tell the server to stop generating, then abort the local fetch.
        initializeBaseUrl().then((base) => fetch(`${base}/api/threads/${threadId}/cancel`, { method: "POST" })).catch(() => null);
        ctrl.abort();
      };
    },
    cancel: (threadId: string) => post<{ ok: boolean }>(`/api/threads/${threadId}/cancel`, {}),
  },

  files: {
    list: (projectName: string, subpath = "") => request<{ project_name: string; items: ProjectFile[] }>(`/project/${projectName}/files?subpath=${encodeURIComponent(subpath)}`),
    read: (projectName: string, path: string) => request<{ project_name: string; path: string; content: string }>(`/project/${projectName}/file?path=${encodeURIComponent(path)}`),
    readRange: (projectName: string, path: string, startLine: number, endLine?: number) =>
      request<{ project_name: string; path: string; start_line: number; end_line: number; total_lines: number; content: string }>(
        `/project/${projectName}/file/range?path=${encodeURIComponent(path)}&start_line=${startLine}${endLine != null ? `&end_line=${endLine}` : ""}`
      ),
    write: (projectName: string, path: string, content: string) => post<any>(`/project/${projectName}/file/write`, { path, content }),
    overwrite: (projectName: string, path: string, content: string) => post<any>(`/project/${projectName}/file/overwrite`, { path, content }),
    diff: (projectName: string, path: string, proposed_content: string) => post<any>(`/project/${projectName}/file/diff`, { path, content: proposed_content }),
    delete: (projectName: string, path: string) => del<any>(`/project/${projectName}/file?path=${encodeURIComponent(path)}`),
    search: (projectName: string, query: string) => request<{ results: any[] }>(`/project/${projectName}/files/search?q=${encodeURIComponent(query)}`),
  },

  diagnostics: {
    run: (projectName: string) => request<{ problems: any[] }>(`/project/${projectName}/diagnostics`),
  },

  command: {
    run: (projectName: string, command: string[], timeout_seconds = 30) =>
      post<any>(`/project/${projectName}/command/run`, { command, timeout_seconds }),
    stream: (
      projectName: string,
      command: string[],
      onLine: (line: string) => void,
      onDone: (exitCode: number) => void,
      onError: (e: string) => void
    ): (() => void) => {
      const ctrl = new AbortController();
      initializeBaseUrl().then((base) => fetch(`${base}/project/${projectName}/command/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, timeout_seconds: 60 }),
        signal: ctrl.signal,
      })).then(async (res) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { onDone(0); return; }
        let buf = "";
        let lastExit = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const ln of lines) {
            if (!ln.startsWith("data: ")) continue;
            const data = ln.slice(6).trim();
            if (data === "[DONE]") { onDone(lastExit); return; }
            try {
              const obj = JSON.parse(data);
              if (obj.line !== undefined) onLine(obj.line);
              if (obj.exit_code !== undefined) lastExit = obj.exit_code;
              if (obj.error) onError(obj.error);
            } catch {}
          }
        }
        onDone(lastExit);
      }).catch((err) => { if (err?.name !== "AbortError") onError(String(err)); });
      return () => ctrl.abort();
    },
  },

  tasks: {
    list: async (projectName: string): Promise<Task[]> => (await request<{ tasks: Task[] }>(`/project/${projectName}/tasks`)).tasks ?? [],
    create: (projectName: string, title: string, status = "todo", description?: string) =>
      post<Task>(`/project/${projectName}/tasks`, { title, status, description }),
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
    list: async (masked = true): Promise<Secret[]> => (await request<{ items: Secret[] }>(`/secrets?masked=${masked}`)).items ?? [],
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
    transcribeUpload: async (projectName: string, file: File, model_name = "base", task = "transcribe"): Promise<any> => {
      const base = await initializeBaseUrl();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model_name", model_name);
      formData.append("task", task);
      const resp = await fetch(`${base}/project/${projectName}/media/transcribe-upload`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  },

  scaffold: {
    app: (projectName: string, kind: string, target_dir: string, app_name = "generated_app") => post<any>(`/project/${projectName}/scaffold/app`, { kind, target_dir, app_name }),
  },

  github: {
    status: (projectName: string) => request<any>(`/project/${projectName}/github/status`),
    branches: (projectName: string) => request<any>(`/project/${projectName}/github/branches`),
    commit: (projectName: string, message: string, paths?: string[]) => post<any>(`/project/${projectName}/github/commit`, { message, paths }),
    authStatus: (state: string) => request<{ authenticated: boolean; username?: string }>(`/api/github/auth/status?state=${encodeURIComponent(state)}`),
    createRepo: (payload: { name: string; description?: string; private?: boolean; project_path?: string; state: string; push?: boolean }) =>
      post<any>(`/api/github/auth/repos/create`, payload),
  },

  git: {
    status: async (projectName: string) => gitStatusForProjectPath(await projectWorkspaceRoot(projectName)),
    currentBranch: (projectName: string) => request<{ branch: string }>(`/project/${projectName}/git/branch`),
    branches: async (projectName: string) => {
      const projectPath = await projectWorkspaceRoot(projectName);
      const branches = await request<string[]>(`/api/git/branches?project_path=${encodeURIComponent(projectPath)}`);
      return { branches };
    },
    checkout: async (projectName: string, branch: string) => {
      const projectPath = await projectWorkspaceRoot(projectName);
      return request<any>(`/api/git/checkout?project_path=${encodeURIComponent(projectPath)}&branch=${encodeURIComponent(branch)}`, { method: "POST" });
    },
    stage: async (projectName: string, files: string[]) => stageGitFiles(await projectWorkspaceRoot(projectName), files),
    unstage: async (projectName: string, files: string[]) => post<any>("/api/git/unstage", { project_path: await projectWorkspaceRoot(projectName), files }),
    commit: async (projectName: string, message: string, files?: string[]) => {
      const projectPath = await projectWorkspaceRoot(projectName);
      if (files?.length) {
        await stageGitFiles(projectPath, files);
      } else {
        const status = await gitStatusForProjectPath(projectPath);
        await stageGitFiles(projectPath, [...status.modified, ...status.untracked]);
      }
      return post<any>("/api/git/commit", { project_path: projectPath, message });
    },
    push: async (projectName: string) => post<any>("/api/git/push", { project_path: await projectWorkspaceRoot(projectName) }),
    pull: async (projectName: string) => post<any>("/api/git/pull", { project_path: await projectWorkspaceRoot(projectName) }),
    cloneProject: (repoUrl: string, projectName?: string) => post<any>(`/projects/clone-git`, { repo_url: repoUrl, project_name: projectName }),
    init: (project_path: string, initial_commit = true) => post<any>(`/api/git/init`, { project_path, initial_commit }),
    setRemote: (project_path: string, remote_url: string, name = "origin") => post<any>(`/api/git/set-remote`, { project_path, remote_url, name }),
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

  codeAgent: {
    workspaceMap: (projectName: string, focus = "") => post<any>(`/project/${projectName}/coagent/workspace-map`, { focus }),
    fileTargets: (projectName: string, task: string, contextFiles: string[] = []) => post<any>(`/project/${projectName}/coagent/file-targets`, { task, context_files: contextFiles }),
    whyFailing: (projectName: string, errorText: string, contextFiles: string[] = [], recentChanges: string[] = []) => post<any>(`/project/${projectName}/coagent/why-failing`, { error_text: errorText, context_files: contextFiles, recent_changes: recentChanges }),
    wiringTrace: (projectName: string, feature: string, startingFile = "") => post<any>(`/project/${projectName}/coagent/wiring-trace`, { feature, starting_file: startingFile }),
    cleanupScan: (projectName: string) => post<any>(`/project/${projectName}/coagent/cleanup-scan`, {}),
    apiContracts: (projectName: string) => post<any>(`/project/${projectName}/coagent/api-contracts`, {}),
    projectState: (projectName: string, focus = "") => post<any>(`/project/${projectName}/coagent/project-state`, { focus }),
    runCommand: (projectName: string, command: string[], timeout_seconds = 30) => post<any>(`/project/${projectName}/coagent/run-command`, { command, timeout_seconds }),
    codingMemory: (projectName: string, action: "read" | "write", key = "", value = "", pinned = false) => post<any>(`/project/${projectName}/coagent/coding-memory`, { action, key, value, pinned }),
  },

  index: {
    trigger: (projectName: string) => post<{ triggered: boolean; project_name: string }>(`/project/${projectName}/index/trigger`, {}),
    status: (projectName: string) => request<{ status: string; last_indexed?: string; file_count?: number; error?: string }>(`/project/${projectName}/index/status`),
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
