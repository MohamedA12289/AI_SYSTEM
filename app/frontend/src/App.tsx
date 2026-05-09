  import { useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/AppSidebar";
import HomePage from "@/pages/HomePage";
import ProjectWorkspacePage from "@/pages/ProjectWorkspacePage";
import CodeModePage from "@/pages/CodeModePage";
import SettingsPage from "@/pages/SettingsPage";
import NewProjectPage from "@/pages/NewProjectPage";
import SelfUpgradePage from "@/pages/SelfUpgradePage";
import WelcomePage from "@/pages/WelcomePage";
import NotFound from "@/pages/NotFound";
import ChatsPage from "@/pages/ChatsPage";
import { ProjectBrainProvider } from "@/contexts/ProjectBrainContext";
import { api, groupTimestamp, isoToTime, projectToDisplay } from "@/services/api";
import { ThemeManager } from "@/services/ThemeManager";
import { SettingsManager } from "@/services/SettingsManager";
import type { ChatHistoryItem, Project } from "@/types";

function ProjectChatLayout({ rightPanelOpen, onToggleRightPanel }: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}) {
  const { projectId } = useParams();
  return (
    <ProjectBrainProvider projectId={projectId!}>
      <ProjectWorkspacePage
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={onToggleRightPanel}
      />
    </ProjectBrainProvider>
  );
}

function ProjectCodeLayout() {
  const { projectId } = useParams();
  return (
    <ProjectBrainProvider projectId={projectId!}>
      <CodeModePage />
    </ProjectBrainProvider>
  );
}

function SelfUpgradeChatLayout({ rightPanelOpen, onToggleRightPanel }: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}) {
  return (
    <SelfUpgradePage
      rightPanelOpen={rightPanelOpen}
      onToggleRightPanel={onToggleRightPanel}
    />
  );
}

function SelfUpgradeCodeLayout() {
  return (
    <ProjectBrainProvider projectId="self_upgrade">
      <CodeModePage isSelfUpgrade />
    </ProjectBrainProvider>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [startupStatus, setStartupStatus] = useState("Starting CubOS…");
  const location = useLocation();

  useEffect(() => {
    const parts = location.pathname.split("/");
    if (location.pathname.startsWith("/project/") && parts[2]) {
      const pid = decodeURIComponent(parts[2]);
      const p = projects.find((x) => x.project_name === pid);
      document.title = `${p?.display_name || pid} — CubOS`;
    } else if (location.pathname.startsWith("/self-upgrade")) {
      document.title = "Self-Upgrade — CubOS";
    } else if (location.pathname === "/settings") {
      document.title = "Settings — CubOS";
    } else if (location.pathname === "/new-project") {
      document.title = "New Project — CubOS";
    } else {
      document.title = "CubOS";
    }
  }, [location.pathname, projects]);

  const refreshProjects = async () => {
    const items = await api.projects.list();
    setProjects(items.filter((p) => !p.archived));
    return items;
  };

  const refreshSettings = async () => {
    await api.settings.get();
  };

  const refreshHistory = async (items: Project[]) => {
    const rows: ChatHistoryItem[] = [];
    for (const p of items.slice(0, 8)) {
      try {
        const msg = await api.chat.messages(p.project_name, 0, 2);
        const latest = msg.items?.[msg.items.length - 1];
        if (latest) {
          rows.push({
            id: `${p.project_name}-${latest.id}`,
            title: p.display_name || p.project_name,
            preview: String(latest.content || "").slice(0, 80),
            timestamp: isoToTime(latest.timestamp),
            group: groupTimestamp(latest.timestamp),
            projectId: p.project_name,
          });
        }
      } catch {}
    }
    setHistory(rows);
  };

  useEffect(() => {
    const savedTheme = SettingsManager.get('workbench.colorTheme');
    if (savedTheme) {
      ThemeManager.setTheme(savedTheme as any);
    }

    const unsubSettings = SettingsManager.onChange((s) => {
      const ct = s['workbench.colorTheme'];
      if (ct) ThemeManager.setTheme(ct as any);
      const provider = s['ai.provider'];
      if (provider) {
        api.provider.set(provider).catch(() => null);
      }
    });

    window.cubosDesktop?.onBackendError?.((msg: string) => {
      setBackendError(msg || "The CubOS backend stopped unexpectedly.");
    });

    const waitForBackend = async (retries = 20, delayMs = 500): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          await api.projects.list();
          return true;
        } catch {
          await new Promise((r) => setTimeout(r, delayMs));
          if (i === 3) setStartupStatus("Waiting for backend…");
          if (i === 10) setStartupStatus("Backend is taking longer than usual…");
        }
      }
      return false;
    };

    (async () => {
      setLoading(true);
      try {
        const backendReady = await waitForBackend();
        if (!backendReady) {
          setBackendError(
            "CubOS could not connect to the backend service.\n\nIf you installed CubOS normally, please try restarting the app.\nIf the problem persists, check that no other program is blocking port 8000."
          );
          setLoading(false);
          return;
        }
        const items = await refreshProjects();
        await refreshSettings();
        await refreshHistory(items);
      } finally {
        setLoading(false);
      }
    })();

    return () => { unsubSettings(); };
  }, []);

  const sidebarProjects = useMemo(() => projects.map(projectToDisplay), [projects]);

  if (backendError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-5 max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <span className="text-xl font-bold text-destructive">!</span>
          </div>
          <h1 className="text-base font-semibold text-foreground">CubOS could not start</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{backendError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">C</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
            {startupStatus}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex w-full">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        projects={sidebarProjects as any}
        chatHistory={history}
      />
      <Routes>
        <Route path="/" element={<HomePage projects={projects} loading={loading} onRefreshProjects={refreshProjects} />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/project/:projectId" element={<Navigate to="thread/latest" replace />} />
        <Route path="/project/:projectId/chat" element={<Navigate to="../thread/latest" replace />} />
        <Route path="/project/:projectId/thread/:threadId" element={<ProjectChatLayout rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen((v) => !v)} />} />
        <Route path="/project/:projectId/code" element={<ProjectCodeLayout />} />
        <Route path="/self-upgrade" element={<Navigate to="chat" replace />} />
        <Route path="/self-upgrade/chat" element={<SelfUpgradeChatLayout rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen((v) => !v)} />} />
        <Route path="/self-upgrade/code" element={<SelfUpgradeCodeLayout />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/new-project" element={<NewProjectPage onProjectCreated={refreshProjects} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
      <Toaster />
    </TooltipProvider>
  );
}
