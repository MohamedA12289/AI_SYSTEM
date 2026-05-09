import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, PanelRight, Search, BarChart3, ListTodo, Wand2, Star, FileText, ChevronDown, X, Mic, Link2, Code2, MessageSquare, MessageCircle, RefreshCw } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProjectRightPanel } from "@/components/ProjectRightPanel";
import { ModeToggle } from "@/components/ModeToggle";
import { ModelSelector } from "@/components/ModelSelector";
import { api, isoToTime, projectToDisplay } from "@/services/api";
import { getActiveThreadId, setActiveThreadId } from "@/contexts/ProjectBrainContext";
import type { ChatMessage as ChatMessageType, Project } from "@/types";

interface Props {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
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

function stripUserContext(content: string): string {
  if (content.includes('[USER MESSAGE]:')) {
    const match = content.match(/\[USER MESSAGE\]:\s*([\s\S]*?)(?:\n\n\[AVAILABLE FILES IN PROJECT\][\s\S]*)?$/);
    if (match) return match[1].trim();
  }
  if (content.includes('[CONTEXT:') || content.includes('[AVAILABLE FILES IN PROJECT]')) {
    const parts = content.split('\n\n');
    const userParts = parts.filter(p => !p.startsWith('[CONTEXT:') && !p.startsWith('[FILE CONTENT') && !p.startsWith('[AVAILABLE FILES'));
    if (userParts.length > 0) return userParts.join('\n\n').trim();
  }
  return content;
}

function toChatMessages(items: any[]): ChatMessageType[] {
  return (items ?? []).map((m) => {
    const role = m.message_type === "approval"
      ? "approval"
      : m.message_type === "tool_result"
        ? "tool"
        : (m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user");

    const rawContent = m.content || "";
    const displayContent = role === "user" ? stripUserContext(rawContent) : rawContent;

    return {
      id: m.id,
      role,
      content: cleanDisplayText(displayContent),
      timestamp: isoToTime(m.timestamp),
      approvalId: m.metadata?.approval_id,
      approvalType: m.metadata?.approval_type,
      approvalData: m.metadata?.payload,
    } as ChatMessageType;
  });
}

export default function ProjectWorkspacePage({ rightPanelOpen, onToggleRightPanel, forceProjectId, isSelfUpgrade }: Props) {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = forceProjectId || params.projectId || "";
  const threadId = params.threadId;
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [panelRefreshToken, setPanelRefreshToken] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string>("");
  const [promptDialog, setPromptDialog] = useState<{ title: string; placeholder: string; onConfirm: (val: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const actionsRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileResolveRef = useRef<((file: File | null) => void) | null>(null);
  const pathFileInputRef = useRef<HTMLInputElement>(null);
  const pathFileResolveRef = useRef<((path: string | null) => void) | null>(null);

  const pickMediaFile = (): Promise<File | null> => {
    return new Promise((resolve) => {
      mediaFileResolveRef.current = resolve;
      mediaFileInputRef.current?.click();
    });
  };

  const pickFilePath = async (options?: { directory?: boolean; title?: string }): Promise<string | null> => {
    if ((window as any).cubosDesktop?.showOpenDialog) {
      const result = await (window as any).cubosDesktop.showOpenDialog({
        title: options?.title || "Select File",
        properties: options?.directory ? ['openDirectory'] : ['openFile'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    }
    return new Promise((resolve) => {
      pathFileResolveRef.current = resolve;
      if (pathFileInputRef.current) {
        if (options?.directory) {
          (pathFileInputRef.current as any).webkitdirectory = true;
          pathFileInputRef.current.accept = '';
        } else {
          (pathFileInputRef.current as any).webkitdirectory = false;
          pathFileInputRef.current.accept = '*/*';
        }
        pathFileInputRef.current.click();
      }
    });
  };

  useEffect(() => {
    if (!projectId || !threadId) return;
    if (threadId === "latest") {
      api.threads.list(projectId).then((res) => {
        const threads = res.threads || [];
        const savedId = getActiveThreadId(projectId);
        const saved = savedId ? threads.find((t: any) => t.id === savedId) : null;
        if (saved) {
          navigate(`/project/${projectId}/thread/${saved.id}`, { replace: true });
        } else if (threads.length > 0) {
          const latest = threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          navigate(`/project/${projectId}/thread/${latest.id}`, { replace: true });
        } else {
          api.threads.create(projectId).then((result) => {
            navigate(`/project/${projectId}/thread/${result.thread.id}`, { replace: true });
          }).catch(() => null);
        }
      }).catch(() => null);
      return;
    }
    setActiveThreadId(projectId, threadId);
  }, [projectId, threadId, navigate]);

  useEffect(() => {
    api.provider.get().then((d) => setActiveProvider(d.active ?? "")).catch(() => null);
  }, []);

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

    if (threadId && threadId !== "latest") {
      try {
        const msg = await api.threads.messages(threadId, 0, 100);
        setMessages(toChatMessages(msg.items));
      } catch {}
    }

    try {
      const fileResp = await api.files.list(projectId, "");
      setFileCount((fileResp.items ?? []).length);
    } catch {
      setFileCount(0);
    }
    setPanelRefreshToken((v) => v + 1);
  };

  useEffect(() => {
    setInitialLoading(true);
    refresh().finally(() => setInitialLoading(false));
  }, [projectId, threadId]);

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
    if (!threadId || threadId === "latest") return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content, timestamp: now }]);

    const streamId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: streamId, role: "assistant", content: "▋", timestamp: now }]);
    setIsStreaming(true);

    cancelStreamRef.current = api.threads.stream(
      threadId,
      content,
      (token) => {
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: (m.content === "▋" ? "" : m.content) + token } : m
        ));
      },
      async () => {
        setIsStreaming(false);
        cancelStreamRef.current = null;
        setMessages((prev) => prev.map((m) =>
          m.id === streamId && m.content === "▋" ? { ...m, content: "Done." } : m
        ));
        await refresh();
      },
      (err) => {
        setIsStreaming(false);
        cancelStreamRef.current = null;
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: cleanDisplayText(err) || "Request failed." } : m
        ));
      }
    ) as any;
  };

  const handleStopStream = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setIsStreaming(false);
  };

  const showPrompt = (title: string, placeholder: string): Promise<string> => {
    return new Promise((resolve) => {
      setPromptValue('');
      setPromptDialog({ title, placeholder, onConfirm: resolve });
    });
  };

  const handleAction = async (action: string) => {
    setActionsOpen(false);
    const primaryPath = selectedPaths[0] || "";

    try {
      if (action === "analyze") appendToolResult(await api.analysis.workspaceAnalyze(projectId, selectedPaths.length ? selectedPaths : undefined), "analysis_result");
      else if (action === "review") appendToolResult(await api.analysis.pairReview(projectId, selectedPaths.length ? selectedPaths : undefined), "review_result");
      else if (action === "plan") appendToolResult(await api.analysis.pairPlan(projectId, selectedPaths.length ? selectedPaths : undefined), "plan_result");
      else if (action === "refactor") {
        if (!primaryPath) { appendToolResult({ error: "Select a file first to refactor" }, "command_output"); return; }
        appendToolResult(await api.analysis.refactorPreview(projectId, primaryPath), "refactor_result");
      }
      else if (action === "cowork") appendToolResult(await api.analysis.cowork(projectId, "review", selectedPaths.length ? selectedPaths : undefined), "cowork_result");
      else if (action === "research") {
        const query = await showPrompt("Deep Research", "Enter your research query…");
        if (!query.trim()) return;
        appendToolResult(await api.analysis.deepResearch(projectId, query), "research_result");
      }
      else if (action === "summary") {
        const path = await pickFilePath({ title: "Select CSV File" });
        if (!path) return;
        appendToolResult(await api.dashboard.summary(projectId, path), "data_summary");
      }
      else if (action === "transcribe") {
        const file = await pickMediaFile();
        if (!file) return;
        appendToolResult(await api.media.transcribeUpload(projectId, file), "transcript_result");
      }
      else if (action === "voice") {
        const file = await pickMediaFile();
        if (!file) return;
        appendToolResult(await api.media.transcribeUpload(projectId, file), "voice_result");
      }
      else if (action === "source") {
        const source_path = await pickFilePath({ directory: true, title: "Select Source Folder" });
        if (!source_path) return;
        appendToolResult(await api.source.link(projectId, source_path), "fetch_result");
      }
      await refresh();
    } catch (e: any) {
      appendToolResult({ error: cleanDisplayText(e?.message || "Action failed") }, "command_output");
    }
  };

  const display = project ? projectToDisplay(project as any) : { name: projectId, description: "", status: "active" };
  const filteredActions = workspaceActions.filter((a) => a.mode === "both");

  return (
    <div className="flex-1 flex h-screen">
      <input
        ref={mediaFileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.mp4,.mov,.mkv,.avi,.webm,.m4v"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          mediaFileResolveRef.current?.(file);
          mediaFileResolveRef.current = null;
          if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
        }}
      />
      <input
        ref={pathFileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          const path = file ? (file as any).path || file.name : null;
          pathFileResolveRef.current?.(path);
          pathFileResolveRef.current = null;
          if (pathFileInputRef.current) pathFileInputRef.current.value = '';
        }}
      />
      {promptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl p-5 w-[400px] shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{promptDialog.title}</h3>
            <input
              autoFocus
              value={promptValue}
              onChange={e => setPromptValue(e.target.value)}
              placeholder={promptDialog.placeholder}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
              onKeyDown={e => {
                if (e.key === 'Enter') { const v = promptValue; setPromptDialog(null); promptDialog.onConfirm(v); }
                if (e.key === 'Escape') { setPromptDialog(null); promptDialog.onConfirm(''); }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPromptDialog(null); promptDialog.onConfirm(''); }}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { const v = promptValue; setPromptDialog(null); promptDialog.onConfirm(v); }}
                className="px-3 py-1.5 text-xs rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-background">
          <div className="flex items-center gap-3 min-w-0">
            {isSelfUpgrade && (
              <div className="flex-shrink-0 w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center">
                <span className="text-warning text-xs">⚡</span>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-foreground truncate">{display.name}</h1>
                {isSelfUpgrade && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                    System
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{display.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isSelfUpgrade && <ModeToggle currentMode="chat" />}
            {isSelfUpgrade && (
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px]">
                <button className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-foreground font-medium transition-colors">
                  <MessageSquare className="w-3 h-3" /> Chat
                </button>
                <button
                  onClick={() => navigate("/self-upgrade/code")}
                  className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <Code2 className="w-3 h-3" /> Code
                </button>
              </div>
            )}
            <ModelSelector compact />
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
            {activeProvider && (
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-md bg-secondary font-mono hidden lg:inline-flex items-center gap-1">
                {activeProvider === "groq" ? "Groq" : activeProvider === "openai" ? "OpenAI" : activeProvider === "abacus" ? "Abacus" : activeProvider === "ollama" ? "Ollama" : activeProvider}
              </span>
            )}
            {isStreaming && (
              <span className="flex items-center gap-1 text-[10px] text-info px-2 py-0.5 rounded-md bg-info/10 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />thinking
              </span>
            )}
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
          {messages.length > 0 && (
            <button onClick={async()=>{setLoadingOlder(true); await refresh(); setLoadingOlder(false);}} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-md hover:bg-secondary">
              {loadingOlder ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Refresh messages
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          <div className="max-w-2xl mx-auto space-y-5">
            {initialLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[12px]">Loading workspace…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground">No messages yet — start chatting below</p>
              </div>
            ) : (
              messages.map((msg) => <ChatMessage key={msg.id} message={msg as any} isSelfUpgrade={isSelfUpgrade} projectName={projectId} onApprovalResolved={refresh} />)
            )}
          </div>
        </div>
        <ChatInput placeholder={`Message ${display.name}...`} onSend={handleSend} isGenerating={isStreaming} onStop={handleStopStream} />
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
