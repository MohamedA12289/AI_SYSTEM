import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Key, Brain, ListTodo, StickyNote, Activity, FileText, Upload, GitBranch, X, PanelRightClose, Shield, Mic, Link2, BarChart3, Camera, TestTube, Search } from "lucide-react";
import { api, isoToTime } from "@/services/api";
import type { Approval, Document, MemoryEntry, Note, ProjectFile, Secret, Snapshot, Task, IngestJob, ActivityEntry } from "@/types";

const categories = [
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "sources", label: "Sources", icon: Link2 },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "ingest", label: "Ingest", icon: Upload },
  { id: "secrets", label: "Secrets", icon: Key },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "snapshots", label: "Snaps", icon: Camera },
  { id: "tests", label: "Tests", icon: TestTube },
  { id: "approvals", label: "Approvals", icon: Shield },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "media", label: "Media", icon: Mic },
  { id: "github", label: "Git", icon: GitBranch },
];

interface Props { projectName?: string; onCollapse: () => void; isSelfUpgrade?: boolean; onSelectPath?: (path: string) => void; selectedPaths?: string[]; }

export function ProjectRightPanel({ projectName, onCollapse, onSelectPath, selectedPaths = [] }: Props) {
  const [activeTab, setActiveTab] = useState("files");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [ingestJobs, setIngestJobs] = useState<IngestJob[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const refresh = async () => {
    if (!projectName) return;
    const calls = [
      api.files.list(projectName).then((d) => setFiles(d.items ?? [])).catch(() => setFiles([])),
      api.memory.list(projectName).then(setMemory).catch(() => setMemory([])),
      api.tasks.list(projectName).then(setTasks).catch(() => setTasks([])),
      api.notes.list(projectName).then(setNotes).catch(() => setNotes([])),
      api.activity.project(projectName, 40).then(setActivity).catch(() => setActivity([])),
      api.snapshots.list(projectName).then(setSnapshots).catch(() => setSnapshots([])),
      api.documents.list(projectName).then(setDocuments).catch(() => setDocuments([])),
      api.approvals.list(projectName, 'todo').then(setApprovals).catch(() => setApprovals([])),
      api.ingest.jobs(projectName).then(setIngestJobs).catch(() => setIngestJobs([])),
      api.secrets.list().then(setSecrets).catch(() => setSecrets([])),
      api.github.status(projectName).then(setGitStatus).catch(() => setGitStatus(null)),
    ];
    await Promise.allSettled(calls);
  };

  useEffect(() => { refresh(); }, [projectName]);
  useEffect(() => { if (!projectName || !searchQuery.trim()) { setSearchResults([]); return; } const t = setTimeout(() => { api.projectSearch.query(projectName, searchQuery).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([])); }, 250); return () => clearTimeout(t); }, [projectName, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const toggleFile = (path: string) => onSelectPath?.(path);

  return (
    <aside className="w-80 border-l border-border bg-background flex flex-col h-screen">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between"><div className="text-sm font-semibold text-foreground truncate">{projectName || 'Workspace'}</div><div className="flex items-center gap-1"><button onClick={refresh} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Search className="w-4 h-4" /></button><button onClick={onCollapse} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><PanelRightClose className="w-4 h-4" /></button></div></div>
      <div className="px-2 py-2 border-b border-border grid grid-cols-5 gap-1">{categories.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors ${activeTab===tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}><tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span></button>)}</div>
      <div className="p-3 border-b border-border"><input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search project files and content..." className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />{searchResults.length > 0 && <div className="mt-2 space-y-1 max-h-28 overflow-auto">{searchResults.slice(0,8).map((r:any,i:number)=><div key={i} className="text-[11px] bg-surface rounded-md px-2 py-1"><div className="font-mono text-foreground truncate">{r.path}</div><div className="text-muted-foreground truncate">{r.match}</div></div>)}</div>}</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {activeTab === 'files' && files.map((f) => <button key={f.path} onClick={() => toggleFile(f.path)} className={`w-full text-left rounded-lg border px-3 py-2 ${selectedSet.has(f.path) ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}><div className="text-[12px] text-foreground truncate">{f.name}</div><div className="text-[10px] text-muted-foreground font-mono truncate">{f.path}</div></button>)}
        {activeTab === 'memory' && <PanelList items={memory.map((m) => ({ title: m.key, subtitle: m.value }))} />}
        {activeTab === 'tasks' && <PanelList items={tasks.map((t) => ({ title: t.title, subtitle: t.status }))} />}
        {activeTab === 'notes' && <PanelList items={notes.map((n) => ({ title: n.content, subtitle: isoToTime(n.created_at) }))} />}
        {activeTab === 'activity' && <PanelList items={activity.map((a) => ({ title: a.action, subtitle: `${a.detail} • ${isoToTime(a.timestamp)}` }))} />}
        {activeTab === 'snapshots' && <PanelList items={snapshots.map((s) => ({ title: s.id, subtitle: isoToTime(s.created_at) }))} />}
        {activeTab === 'docs' && <PanelList items={documents.map((d) => ({ title: d.file_name, subtitle: d.relative_path || d.absolute_path || '' }))} />}
        {activeTab === 'ingest' && <PanelList items={ingestJobs.map((j) => ({ title: j.source_kind, subtitle: `${j.status} • ${j.documents_indexed ?? 0} indexed` }))} />}
        {activeTab === 'secrets' && <PanelList items={secrets.map((s) => ({ title: s.key, subtitle: String(s.value) }))} />}
        {activeTab === 'approvals' && <div className="space-y-2">{approvals.map((a) => <div key={a.id} className="rounded-lg border border-border p-3"><div className="text-[12px] text-foreground">{a.summary || a.approval_type}</div><div className="text-[10px] text-muted-foreground mb-2">{isoToTime(a.created_at)}</div><div className="flex gap-2"><button onClick={async ()=>{ await api.approvals.approve(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-success/10 text-success text-[11px]">Approve</button><button onClick={async ()=>{ await api.approvals.reject(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-[11px]">Reject</button></div></div>)}{approvals.length===0 && <Empty text="No pending approvals" />}</div>}
        {activeTab === 'sources' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground">Linked sources are managed from New Project and Source Link actions.</div></div>}
        {activeTab === 'analysis' && <div className="space-y-2 text-[11px] text-muted-foreground"><div>Select files in the Files tab, then use the header tools.</div>{selectedPaths.length>0 && <div className="bg-surface rounded-lg p-2 text-foreground">Selected: {selectedPaths.join(', ')}</div>}</div>}
        {activeTab === 'media' && <div className="text-[11px] text-muted-foreground">Use header tools to transcribe audio or run voice chat.</div>}
        {activeTab === 'github' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground">{gitStatus?.git_status?.stderr || gitStatus?.git_status?.stdout || 'No git data yet.'}</div></div>}
      </div>
    </aside>
  );
}

function PanelList({ items }: { items: { title: string; subtitle?: string }[] }) {
  if (!items.length) return <Empty text="Nothing here yet" />;
  return <div className="space-y-2">{items.map((item, idx) => <div key={idx} className="rounded-lg border border-border p-3"><div className="text-[12px] text-foreground break-words">{item.title}</div>{item.subtitle && <div className="text-[10px] text-muted-foreground break-words">{item.subtitle}</div>}</div>)}</div>;
}
function Empty({ text }: { text: string }) { return <div className="text-[11px] text-muted-foreground">{text}</div>; }
