import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import HomePage from "@/pages/HomePage";
import ProjectWorkspacePage from "@/pages/ProjectWorkspacePage";
import CodeModePage from "@/pages/CodeModePage";
import SettingsPage from "@/pages/SettingsPage";
import NewProjectPage from "@/pages/NewProjectPage";
import SelfUpgradePage from "@/pages/SelfUpgradePage";
import NotFound from "@/pages/NotFound";
import { ProjectBrainProvider } from "@/contexts/ProjectBrainContext";
import { api, groupTimestamp, isoToTime, projectToDisplay } from "@/services/api";
import type { AssistantMode, ChatHistoryItem, Project } from "@/types";

function ProjectChatLayout({ rightPanelOpen, onToggleRightPanel, assistantMode, onModeChange }: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  assistantMode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
}) {
  const { projectId } = useParams();
  return (
    <ProjectBrainProvider projectId={projectId!}>
      <ProjectWorkspacePage
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={onToggleRightPanel}
        assistantMode={assistantMode}
        onModeChange={onModeChange}
      />
    </ProjectBrainProvider>
  );
}

function ProjectCodeLayout({ assistantMode }: { assistantMode: AssistantMode }) {
  const { projectId } = useParams();
  return (
    <ProjectBrainProvider projectId={projectId!}>
      <CodeModePage assistantMode={assistantMode} />
    </ProjectBrainProvider>
  );
}

function SelfUpgradeChatLayout({ rightPanelOpen, onToggleRightPanel, assistantMode, onModeChange }: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  assistantMode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
}) {
  return (
    <SelfUpgradePage
      rightPanelOpen={rightPanelOpen}
      onToggleRightPanel={onToggleRightPanel}
      assistantMode={assistantMode}
      onModeChange={onModeChange}
    />
  );
}

function SelfUpgradeCodeLayout({ assistantMode }: { assistantMode: AssistantMode }) {
  return (
    <ProjectBrainProvider projectId="self_upgrade">
      <CodeModePage assistantMode={assistantMode} isSelfUpgrade />
    </ProjectBrainProvider>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("build");
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = async () => {
    const items = await api.projects.list();
    setProjects(items.filter((p) => !p.archived));
    return items;
  };

  const refreshSettings = async () => {
    const s = await api.settings.get();
    setAssistantMode(s.assistant?.mode ?? "build");
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
    document.documentElement.classList.add("dark");
    (async () => {
      setLoading(true);
      try {
        const items = await refreshProjects();
        await refreshSettings();
        await refreshHistory(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sidebarProjects = useMemo(() => projects.map(projectToDisplay), [projects]);

  const handleModeChange = async (mode: AssistantMode) => {
    setAssistantMode(mode);
    try { await api.settings.setAssistantMode(mode); } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex w-full">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        projects={sidebarProjects as any}
        chatHistory={history}
      />
      <Routes>
        <Route path="/" element={<HomePage assistantMode={assistantMode} onModeChange={handleModeChange} projects={projects} loading={loading} onRefreshProjects={refreshProjects} />} />
        <Route path="/project/:projectId" element={<Navigate to="chat" replace />} />
        <Route path="/project/:projectId/chat" element={<ProjectChatLayout rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen((v) => !v)} assistantMode={assistantMode} onModeChange={handleModeChange} />} />
        <Route path="/project/:projectId/code" element={<ProjectCodeLayout assistantMode={assistantMode} />} />
        <Route path="/self-upgrade" element={<Navigate to="chat" replace />} />
        <Route path="/self-upgrade/chat" element={<SelfUpgradeChatLayout rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen((v) => !v)} assistantMode={assistantMode} onModeChange={handleModeChange} />} />
        <Route path="/self-upgrade/code" element={<SelfUpgradeCodeLayout assistantMode={assistantMode} />} />
        <Route path="/settings" element={<SettingsPage assistantMode={assistantMode} onModeChange={handleModeChange} />} />
        <Route path="/new-project" element={<NewProjectPage onProjectCreated={refreshProjects} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  );
}
