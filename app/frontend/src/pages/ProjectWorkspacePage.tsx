import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, PanelRight, Hammer, Play, Search, BarChart3, ListTodo, Wand2, Star, FileText, Package, GitCommit, ChevronDown, X, Mic, Link2, Code2, MessageSquare } from "lucide-react";
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
      approvalId: m.metadata?.approval_id,
      approvalType: m.metadata?.approval_type,
      approvalData: m.metadata?.payload,
    } as ChatMessageType;
  });
}

export default function ProjectWorkspacePage({ rightPanelOpen, onToggleRightPanel, assistantMode, onModeChange, forceProjectId, isSelfUpgrade }: Props) {
  const params = useParams();
  const navigate = useNavigate();
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

    const streamId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: streamId, role: "assistant", content: "▋", timestamp: now }]);

    api.chat.stream(
      projectId,
      content,
      (token) => {
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: (m.content === "▋" ? "" : m.content) + token } : m
        ));
      },
      async () => {
        setMessages((prev) => prev.map((m) =>
          m.id === streamId && m.content === "▋" ? { ...m, content: "Done." } : m
        ));
        await refresh();
      },
      (err) => {
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: cleanDisplayText(err) || "Request failed." } : m
        ));
      }
    );
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
            <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px]">
              <button className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-foreground font-medium transition-colors">
                <MessageSquare className="w-3 h-3" /> Chat
              </button>
              <button
                onClick={() => isSelfUpgrade ? navigate("/self-upgrade/code") : navigate(`/project/${projectId}/code`)}
                className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground hover:bg-secondary transition-colors"
              >
                <Code2 className="w-3 h-3" /> Code
              </button>
            </div>
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
            {messages.map((msg) => <ChatMessage key={msg.id} message={msg as any} isSelfUpgrade={isSelfUpgrade} projectName={projectId} onApprovalResolved={refresh} />)}
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
