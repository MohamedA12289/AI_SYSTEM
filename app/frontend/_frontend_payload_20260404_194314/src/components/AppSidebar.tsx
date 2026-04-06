import { useLocation, useNavigate } from "react-router-dom";
import { Home, Settings, Plus, ChevronRight, ChevronLeft, Zap } from "lucide-react";
import { useState } from "react";
import { CubOSBear } from "./CubOSBear";
import type { ChatHistoryItem } from "@/types";

interface SidebarProject {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  projects?: SidebarProject[];
  chatHistory?: ChatHistoryItem[];
}

export function AppSidebar({ collapsed, onToggle, projects = [], chatHistory = [] }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const isActive = (path: string) => location.pathname === path;
  const grouped = {
    today: chatHistory.filter((x) => x.group === "today"),
    yesterday: chatHistory.filter((x) => x.group === "yesterday"),
    older: chatHistory.filter((x) => x.group === "older"),
  };

  if (collapsed) {
    return (
      <aside className="w-14 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        <div className="flex items-center justify-center py-4"><CubOSBear size={24} className="text-foreground" /></div>
        <nav className="flex-1 flex flex-col items-center gap-1 py-2 px-1.5">
          <button onClick={() => navigate("/")} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive("/") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}><Home className="w-4 h-4" /></button>
          <div className="w-5 h-px bg-sidebar-border my-1" />
          {projects.slice(0, 6).map((p) => (
            <button key={p.id} onClick={() => navigate(`/project/${p.id}`)} title={p.name}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${location.pathname === `/project/${p.id}` ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>{p.name.charAt(0)}</button>
          ))}
          <button onClick={() => navigate("/new-project")} className="w-9 h-9 rounded-lg flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"><Plus className="w-4 h-4" /></button>
          <div className="w-5 h-px bg-sidebar-border my-1" />
          <button onClick={() => navigate("/self-upgrade")} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive("/self-upgrade") ? "bg-warning/10 text-warning" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}><Zap className="w-4 h-4" /></button>
        </nav>
        <div className="flex flex-col items-center gap-1 pb-3 px-1.5">
          <button onClick={() => navigate("/settings")} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive("/settings") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}><Settings className="w-4 h-4" /></button>
          <button onClick={onToggle} className="w-9 h-9 rounded-lg flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-3 py-3.5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <CubOSBear size={26} className="text-foreground" />
          <span className="font-semibold text-foreground tracking-tight text-sm">CubOS</span>
        </div>
        <button onClick={onToggle} className="p-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2 space-y-0.5">
        <button onClick={() => navigate("/")} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${isActive("/") ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}><Home className="w-4 h-4" />Home</button>
        <div className="pt-3">
          <button onClick={() => setProjectsOpen((v)=>!v)} className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground px-2.5 py-1"><span>Projects</span><ChevronRight className={`w-3 h-3 transition-transform ${projectsOpen ? 'rotate-90' : ''}`} /></button>
          {projectsOpen && <div className="mt-1 space-y-0.5">{projects.map((p) => <button key={p.id} onClick={() => navigate(`/project/${p.id}`)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${location.pathname === `/project/${p.id}` ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'}`}><span className="truncate">{p.name}</span></button>)}<button onClick={() => navigate('/new-project')} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/50"><Plus className="w-3.5 h-3.5" />New Project</button></div>}
        </div>
        <div className="pt-3">
          <button onClick={() => setHistoryOpen((v)=>!v)} className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground px-2.5 py-1"><span>History</span><ChevronRight className={`w-3 h-3 transition-transform ${historyOpen ? 'rotate-90' : ''}`} /></button>
          {historyOpen && <div className="mt-1 space-y-2">{(['today','yesterday','older'] as const).map((group) => grouped[group].length ? <div key={group}><div className="px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{group}</div><div className="space-y-0.5">{grouped[group].slice(0,6).map((h) => <button key={h.id} onClick={() => h.projectId ? navigate(`/project/${h.projectId}`) : navigate('/')} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors"><div className="text-[12px] text-foreground truncate">{h.title}</div><div className="text-[10px] text-muted-foreground truncate">{h.preview}</div></button>)}</div></div> : null)}</div>}
        </div>
        <div className="pt-3">
          <button onClick={() => navigate('/self-upgrade')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${isActive('/self-upgrade') ? 'bg-warning/10 text-warning font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'}`}><Zap className="w-4 h-4" />Self-Upgrade</button>
        </div>
      </nav>
      <div className="p-2 border-t border-sidebar-border">
        <button onClick={() => navigate('/settings')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${isActive('/settings') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'}`}><Settings className="w-4 h-4" />Settings</button>
      </div>
    </aside>
  );
}
