import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, FolderKanban, Plus, Loader2, FolderOpen, MessageSquare, Code2, ChevronRight } from "lucide-react";
import { CubOSBear } from "@/components/CubOSBear";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { ModelSelector } from "@/components/ModelSelector";
import { api, getApiBase, isoToTime, projectToDisplay } from "@/services/api";
import type { ChatMessage as ChatMessageType, Project } from "@/types";

interface Props {
  projects: Project[];
  loading?: boolean;
  onRefreshProjects?: () => Promise<Project[]>;
}

export default function HomePage({ projects, loading, onRefreshProjects }: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const displayProjects = useMemo(() => projects.map(projectToDisplay), [projects]);

  useEffect(() => {
    api.activity.global(8).then((a) => { setActivity(a); setBackendOk(true); }).catch(() => { setActivity([]); setBackendOk(false); });
  }, []);

  const handleSend = async (content: string) => {
    const userMsg: ChatMessageType = { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, userMsg]);
    if (!projects.length) {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: "Create a project first, then I can chat within that workspace.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }
    try {
      const res = await api.chat.agentLoop(projects[0].project_name, content, false, false, 4);
      const contentOut = res.assistant_message || res.response || res.tool_execution?.message || "Done.";
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: contentOut, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: e?.message || 'Unable to reach backend.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  const handleOpenFolder = async () => {
    setImportError(null);

    if (!(window as any).cubosDesktop?.showOpenDialog) {
      setImportError('Open Folder requires the desktop app. Use "New Project" instead in browser mode.');
      setTimeout(() => setImportError(null), 5000);
      return;
    }

    try {
      const result = await (window as any).cubosDesktop.showOpenDialog({
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        setImportLoading(true);

        const response = await fetch(`${getApiBase()}/projects/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath }),
        });

        if (response.ok) {
          const data = await response.json();
          const project = data.project;
          await onRefreshProjects?.();
          navigate(`/project/${project.project_name}`);
        } else if (response.status === 409) {
          const data = await response.json().catch(() => ({}));
          const projectName = data.project_name || data.detail?.project_name;
          await onRefreshProjects?.();
          if (projectName) {
            navigate(`/project/${projectName}`);
          } else {
            setImportError('Project already exists.');
            setTimeout(() => setImportError(null), 5000);
          }
        } else {
          const errorText = await response.text();
          setImportError(`Failed to import folder: ${errorText}`);
          setTimeout(() => setImportError(null), 5000);
        }
        setImportLoading(false);
      }
    } catch (err: any) {
      setImportError(err?.message || 'Failed to import folder');
      setTimeout(() => setImportError(null), 5000);
      setImportLoading(false);
    }
  };

  if (messages.length) {
    return (
      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg as any} />
            ))}
          </div>
        </div>
        <ChatInput placeholder="Message CubOS..." onSend={handleSend} />
      </div>
    );
  }

  const backendDotClass = backendOk === null ? "bg-muted-foreground animate-pulse" : backendOk ? "bg-success" : "bg-destructive";
  const backendLabel = loading ? "connecting…" : backendOk === false ? "unreachable" : "connected";

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-12">
        <div className="flex flex-col items-center mb-8">
          <CubOSBear size={56} className="text-foreground mb-3" />
          <h1 className="text-xl font-semibold text-foreground tracking-tight">CubOS</h1>
          <p className="text-sm text-muted-foreground mt-1">Local AI workspace — what would you like to build?</p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <ChatInput placeholder="Ask anything or start a project…" onSend={handleSend} />
        </div>

        <div className="flex items-center gap-3 mb-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-[11px] font-mono text-muted-foreground">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className={`w-1.5 h-1.5 rounded-full ${backendDotClass}`} />}
            backend {backendLabel}
          </div>
          <ModelSelector compact className="ml-auto" />
        </div>
        {importError && (
          <div className="max-w-2xl mx-auto mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {importError}
          </div>
        )}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projects</span>
            <div className="flex gap-2">
              <button
                onClick={handleOpenFolder}
                disabled={importLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-all disabled:opacity-50"
                title="Open an existing folder as a project"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open Folder
                  </>
                )}
              </button>
              <button
                onClick={() => navigate('/new-project')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-[12px]">Loading projects…</span>
            </div>
          ) : displayProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 border border-dashed border-border rounded-xl bg-secondary/20">
              <FolderKanban className="w-10 h-10 text-muted-foreground/25" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-foreground">No projects yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">Open a folder or create a new project to get started</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleOpenFolder} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-medium hover:bg-secondary/80 transition-colors">
                  <FolderOpen className="w-3.5 h-3.5" />Open Folder
                </button>
                <button onClick={() => navigate('/new-project')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-3.5 h-3.5" />New Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {displayProjects.map((p: any) => (
                <div
                  key={p.id}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-foreground/20 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <FolderKanban className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <button
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="text-[13px] font-medium text-foreground truncate text-left hover:text-foreground/80 flex-1"
                    >
                      {p.name}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 pl-5">
                    {p.description || "No description"}
                  </p>
                  <div className="flex items-center gap-1 pl-5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-[11px] text-foreground transition-colors"
                      title="Open chat"
                    >
                      <MessageSquare className="w-3 h-3" />Chat
                    </button>
                    <button
                      onClick={() => navigate(`/project/${p.id}/code`)}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-[11px] text-foreground transition-colors"
                      title="Open code editor"
                    >
                      <Code2 className="w-3 h-3" />Code
                    </button>
                    <button
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="flex items-center gap-1 px-2 py-1 ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {activity.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Recent Activity
            </span>
            <div className="space-y-0.5 mt-2">
              {activity.slice(0, 6).map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[12px] text-foreground">{a.action}</span>
                  <span className="text-[11px] text-muted-foreground font-mono truncate">{a.detail}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{isoToTime(a.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}