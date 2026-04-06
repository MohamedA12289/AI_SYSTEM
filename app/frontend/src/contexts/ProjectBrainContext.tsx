import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, isoToTime } from "@/services/api";
import type { Approval, ChatMessage as ChatMessageType, Project, ProjectFile } from "@/types";

function cleanText(input?: string) {
  const text = String(input ?? "");
  return text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\r/g, "")
    .replace(/\uFEFF/g, "")
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
      content: cleanText(m.content || ""),
      timestamp: isoToTime(m.timestamp),
      approvalId: m.metadata?.approval_id,
      approvalType: m.metadata?.approval_type,
      approvalData: m.metadata?.payload,
    } as ChatMessageType;
  });
}

export interface OpenTab {
  path: string;
  name: string;
  content?: string;
  isDirty?: boolean;
}

export interface AiMessage {
  role: "user" | "ai";
  text: string;
  hasDiff?: boolean;
  diffId?: string;
}

interface SessionSnapshot {
  openTabs: OpenTab[];
  activeTabPath: string | null;
  selectedPaths: string[];
  codeAiMessages: AiMessage[];
}

const sessionRegistry = new Map<string, SessionSnapshot>();

export function getSessionAiMessages(projectId: string): AiMessage[] {
  return sessionRegistry.get(projectId)?.codeAiMessages ?? [];
}

export function setSessionAiMessages(projectId: string, msgs: AiMessage[]) {
  const snap = sessionRegistry.get(projectId) ?? { openTabs: [], activeTabPath: null, selectedPaths: [], codeAiMessages: [] };
  sessionRegistry.set(projectId, { ...snap, codeAiMessages: msgs });
}

export interface ProjectBrainState {
  projectId: string;
  project: Project | null;
  messages: ChatMessageType[];
  files: ProjectFile[];
  pendingApprovals: Approval[];
  selectedPaths: string[];
  openTabs: OpenTab[];
  activeTabPath: string | null;
  panelRefreshToken: number;
  fileCount: number;
  loading: boolean;

  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
  setOpenTabs: React.Dispatch<React.SetStateAction<OpenTab[]>>;
  setActiveTabPath: (path: string | null) => void;
  refresh: () => Promise<void>;
  openFile: (path: string, name: string) => Promise<void>;
  saveFile: (path: string, content: string) => Promise<void>;
  closeTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
}

const ProjectBrainContext = createContext<ProjectBrainState | null>(null);

export function useProjectBrain() {
  const ctx = useContext(ProjectBrainContext);
  if (!ctx) throw new Error("useProjectBrain must be used inside ProjectBrainProvider");
  return ctx;
}

export function ProjectBrainProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const saved = sessionRegistry.get(projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>(saved?.selectedPaths ?? []);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(saved?.openTabs ?? []);
  const [activeTabPath, setActiveTabPathState] = useState<string | null>(saved?.activeTabPath ?? null);
  const [panelRefreshToken, setPanelRefreshToken] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadedProjectId = useRef<string>("");

  const setActiveTabPath = useCallback((path: string | null) => {
    setActiveTabPathState(path);
  }, []);

  useEffect(() => {
    const snap = sessionRegistry.get(projectId);
    sessionRegistry.set(projectId, {
      openTabs,
      activeTabPath,
      selectedPaths,
      codeAiMessages: snap?.codeAiMessages ?? [],
    });
  }, [projectId, openTabs, activeTabPath, selectedPaths]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try { setProject(await api.projects.get(projectId)); } catch {}
    try {
      const msg = await api.chat.messages(projectId, 0, 100);
      setMessages(toChatMessages(msg.items));
    } catch {}
    try {
      const fileResp = await api.files.list(projectId, "");
      setFiles(fileResp.items ?? []);
      setFileCount((fileResp.items ?? []).length);
    } catch { setFileCount(0); }
    try {
      const appr = await api.approvals.list(projectId, "pending");
      setPendingApprovals(appr);
    } catch {}
    setPanelRefreshToken((v) => v + 1);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || loadedProjectId.current === projectId) return;
    loadedProjectId.current = projectId;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [projectId, refresh]);

  const openFile = useCallback(async (path: string, name: string) => {
    setActiveTabPathState(path);
    setOpenTabs((prev) => {
      if (prev.find((t) => t.path === path)) return prev;
      return [...prev, { path, name }];
    });
    try {
      const res = await api.files.read(projectId, path);
      setOpenTabs((prev) => prev.map((t) => t.path === path ? { ...t, content: res.content } : t));
    } catch {}
  }, [projectId]);

  const saveFile = useCallback(async (path: string, content: string) => {
    await api.files.overwrite(projectId, path, content);
    setOpenTabs((prev) => prev.map((t) => t.path === path ? { ...t, content, isDirty: false } : t));
  }, [projectId]);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (activeTabPath === path) {
        setActiveTabPathState(next.length ? next[next.length - 1].path : null);
      }
      return next;
    });
  }, [activeTabPath]);

  const updateTabContent = useCallback((path: string, content: string) => {
    setOpenTabs((prev) => prev.map((t) => t.path === path ? { ...t, content, isDirty: true } : t));
  }, []);

  return (
    <ProjectBrainContext.Provider value={{
      projectId, project, messages, files, pendingApprovals,
      selectedPaths, setSelectedPaths,
      openTabs, setOpenTabs, activeTabPath, setActiveTabPath,
      panelRefreshToken, fileCount, loading,
      setMessages, refresh, openFile, saveFile, closeTab, updateTabContent,
    }}>
      {children}
    </ProjectBrainContext.Provider>
  );
}
