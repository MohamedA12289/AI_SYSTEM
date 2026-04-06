import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, FolderKanban, Hammer, Play } from "lucide-react";
import { CubOSBear } from "@/components/CubOSBear";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { api, isoToTime, projectToDisplay } from "@/services/api";
import type { AssistantMode, ChatMessage as ChatMessageType, Project } from "@/types";

interface Props {
  assistantMode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
  projects: Project[];
  loading?: boolean;
  onRefreshProjects?: () => Promise<Project[]>;
}

export default function HomePage({ assistantMode, onModeChange, projects, loading }: Props) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const displayProjects = useMemo(() => projects.map(projectToDisplay), [projects]);

  useEffect(() => { api.activity.global(8).then(setActivity).catch(() => setActivity([])); }, []);

  const handleSend = async (content: string) => {
    const userMsg: ChatMessageType = { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((prev) => [...prev, userMsg]);
    if (!projects.length) {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: "Create a project first, then I can chat within that workspace.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }
    try {
      const res = await api.chat.send(projects[0].project_name, content, assistantMode);
      const contentOut = res.assistant_message || res.response || res.tool_execution?.message || "Done.";
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: assistantMode === 'plan' ? 'planning' : 'assistant', content: contentOut, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: e?.message || 'Unable to reach backend.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  if (messages.length) {
    return <div className="flex-1 flex flex-col h-screen"><div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6"><div className="max-w-2xl mx-auto space-y-5">{messages.map((msg) => <ChatMessage key={msg.id} message={msg as any} />)}</div></div><ChatInput placeholder="Message CubOS..." onSend={handleSend} assistantMode={assistantMode} onModeChange={onModeChange} /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
        <div className="flex flex-col items-center mb-10">
          <CubOSBear size={64} className="text-foreground mb-4" />
          <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1">CubOS</h1>
          <p className="text-sm text-muted-foreground">What would you like to work on?</p>
        </div>
        <div className="max-w-2xl mx-auto mb-12"><ChatInput placeholder="Message CubOS..." onSend={handleSend} assistantMode={assistantMode} onModeChange={onModeChange} /></div>
        <div className="flex items-center gap-3 mb-8 max-w-2xl mx-auto">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-[11px] text-muted-foreground font-mono"><span className="w-1.5 h-1.5 rounded-full bg-success" />{loading ? 'loading…' : 'backend connected'}</span>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${assistantMode === 'build' ? 'bg-foreground/10 text-foreground' : 'bg-info/10 text-info'}`}>{assistantMode === 'build' ? <Hammer className="w-3 h-3" /> : <Play className="w-3 h-3" />}{assistantMode === 'build' ? 'Build Mode' : 'Plan Mode'}</span>
          <span className="text-[11px] text-muted-foreground ml-auto">{displayProjects.length} projects active</span>
        </div>
        <div className="max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3 block">Projects</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {displayProjects.map((p:any) => <button key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-card border border-border rounded-xl p-4 text-left hover:border-foreground/20 transition-all group"><div className="flex items-center gap-2 mb-2"><FolderKanban className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-[13px] font-medium text-foreground truncate">{p.name}</span></div><p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{p.description}</p><div className="flex items-center gap-3 text-[10px] text-muted-foreground"><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${p.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></div></button>)}
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3 block flex items-center gap-1.5"><Activity className="w-3 h-3" />Recent Activity</span>
          <div className="space-y-0.5">{activity.slice(0, 8).map((a:any) => <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors"><Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" /><span className="text-[12px] text-foreground">{a.action}</span><span className="text-[11px] text-muted-foreground font-mono truncate">{a.detail}</span><span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{isoToTime(a.timestamp)}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}
