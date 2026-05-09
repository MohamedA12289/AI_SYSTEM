import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FolderOpen, Key, Brain, ListTodo, StickyNote, Activity, FileText, Upload, GitBranch, PanelRightClose, Shield, Mic, Link2, BarChart3, Camera, TestTube, RefreshCw, ChevronDown, Plus, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { api, isoToTime } from "@/services/api";
import type { Approval, Document, MemoryEntry, Note, ProjectFile, Secret, Snapshot, Task, IngestJob, ActivityEntry } from "@/types";
import { toast } from "sonner";

const categories = [
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "secrets", label: "Secrets", icon: Key },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "snapshots", label: "Snaps", icon: Camera },
  { id: "approvals", label: "Approvals", icon: Shield },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "ingest", label: "Ingest", icon: Upload },
  { id: "sources", label: "Sources", icon: Link2 },
  { id: "tests", label: "Tests", icon: TestTube },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "media", label: "Media", icon: Mic },
  { id: "github", label: "Git", icon: GitBranch },
];

const PRIMARY_TABS = ["files", "memory", "tasks", "notes", "secrets", "activity", "approvals", "github"];

interface Props {
  projectName?: string;
  onCollapse: () => void;
  isSelfUpgrade?: boolean;
  onSelectPath?: (path: string) => void;
  selectedPaths?: string[];
  refreshToken?: number;
}

export function ProjectRightPanel({ projectName, onCollapse, onSelectPath, selectedPaths = [], refreshToken = 0 }: Props) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState("files");
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [refreshing, setRefreshing] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [newMemoryKey, setNewMemoryKey] = useState("");
  const [newMemoryValue, setNewMemoryValue] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const [mediaTranscribing, setMediaTranscribing] = useState(false);
  const [mediaTranscript, setMediaTranscript] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    if (!projectName) return;
    setRefreshing(true);
    const calls = [
      api.files.list(projectName).then((d) => setFiles(d.items ?? [])).catch(() => setFiles([])),
      api.memory.list(projectName).then(setMemory).catch(() => setMemory([])),
      api.tasks.list(projectName).then(setTasks).catch(() => setTasks([])),
      api.notes.list(projectName).then(setNotes).catch(() => setNotes([])),
      api.activity.project(projectName, 40).then(setActivity).catch(() => setActivity([])),
      api.snapshots.list(projectName).then(setSnapshots).catch(() => setSnapshots([])),
      api.documents.list(projectName).then(setDocuments).catch(() => setDocuments([])),
      api.approvals.list(projectName, 'pending').then(setApprovals).catch(() => setApprovals([])),
      api.ingest.jobs(projectName).then(setIngestJobs).catch(() => setIngestJobs([])),
      api.secrets.list(true).then(setSecrets).catch(() => setSecrets([])),
      api.github.status(projectName).then(setGitStatus).catch(() => setGitStatus(null)),
    ];
    await Promise.allSettled(calls);
    setRefreshing(false);
  };

  useEffect(() => { refresh(); }, [projectName, refreshToken]);
  useEffect(() => {
    if (!projectName || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.projectSearch.query(projectName, searchQuery).then((d) => setSearchResults(d.results ?? [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [projectName, searchQuery]);

  const handleAddMemory = async () => {
    if (!projectName || !newMemoryValue.trim()) return;
    try {
      const content = newMemoryValue.trim();
      const firstLine = content.split('\n')[0].trim();
      const derivedKey = firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
      const key = newMemoryKey.trim() || derivedKey || `note-${Date.now()}`;
      await api.memory.create(projectName, key, content, false);
      setNewMemoryKey("");
      setNewMemoryValue("");
      setShowAddMemory(false);
      await refresh();
      toast.success("Memory added");
    } catch (error) {
      toast.error("Failed to add memory");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!projectName) return;
    try {
      await api.memory.delete(projectName, id);
      await refresh();
      toast.success("Memory deleted");
    } catch (error) {
      toast.error("Failed to delete memory");
    }
  };

  const handleAddTask = async () => {
    if (!projectName || !newTaskTitle.trim()) return;
    try {
      await api.tasks.create(projectName, newTaskTitle.trim(), "pending", newTaskDescription.trim() || undefined);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setShowAddTask(false);
      await refresh();
      toast.success("Task added");
    } catch (error) {
      toast.error("Failed to add task");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!projectName) return;
    try {
      await api.tasks.delete(projectName, id);
      await refresh();
      toast.success("Task deleted");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleAddNote = async () => {
    if (!projectName || !newNoteContent.trim()) return;
    try {
      await api.notes.create(projectName, newNoteContent);
      setNewNoteContent("");
      setShowAddNote(false);
      await refresh();
      toast.success("Note added");
    } catch (error) {
      toast.error("Failed to add note");
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!projectName) return;
    try {
      await api.notes.delete(projectName, id);
      await refresh();
      toast.success("Note deleted");
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const toggleFile = (path: string) => onSelectPath?.(path);

  const primaryCats = categories.filter((c) => PRIMARY_TABS.includes(c.id));
  const moreCats = categories.filter((c) => !PRIMARY_TABS.includes(c.id));
  const activeInMore = moreCats.some((c) => c.id === activeTab);

  return (
    <aside className="w-80 border-l border-border bg-background flex flex-col h-screen">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground truncate">{projectName || 'Workspace'}</div>
        <div className="flex items-center gap-1">
          <button onClick={refresh} title="Refresh panel" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onCollapse} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><PanelRightClose className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="px-2 py-2 border-b border-border">
        <div className="grid grid-cols-5 gap-1 mb-1">
          {primaryCats.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] transition-colors ${activeTab===tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
              <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <button onClick={() => setMoreOpen((v) => !v)} className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-colors ${activeInMore ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
            {activeInMore ? (() => { const C = moreCats.find(c=>c.id===activeTab); return C ? <><C.icon className="w-3.5 h-3.5" /><span>{C.label}</span></> : null; })() : <span>More tools…</span>}
            <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 p-1.5 grid grid-cols-3 gap-1 w-full">
              {moreCats.map((tab) => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }} className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] transition-colors ${activeTab===tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                  <tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-3 border-b border-border">
        <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search project files and content..." className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-28 overflow-auto">
            {searchResults.slice(0,8).map((r:any,i:number)=>(
              <div key={i} className="text-[11px] bg-surface rounded-md px-2 py-1">
                <div className="font-mono text-foreground truncate">{r.path}</div>
                <div className="text-muted-foreground truncate">{r.match}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {activeTab === 'files' && files.map((f) => (
          <div key={f.path} className={`group w-full flex items-center gap-2 rounded-lg border px-3 py-2 ${selectedSet.has(f.path) ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}>
            <button onClick={() => toggleFile(f.path)} className="flex-1 min-w-0 text-left">
              <div className="text-[12px] text-foreground truncate">{f.name}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{f.path}</div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const pid = projectId || projectName;
                if (!pid) return;
                navigate(`/project/${pid}/code`, { state: { openFilePath: f.path } });
              }}
              title="Open in Code Mode"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {activeTab === 'memory' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAddMemory(!showAddMemory)}
              className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">Add Memory</span>
            </button>
            {showAddMemory && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-surface">
                <textarea
                  value={newMemoryValue}
                  onChange={(e) => setNewMemoryValue(e.target.value)}
                  placeholder="What should I remember? (free-form)"
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddMemory();
                  }}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
                  autoFocus
                />
                <input
                  type="text"
                  value={newMemoryKey}
                  onChange={(e) => setNewMemoryKey(e.target.value)}
                  placeholder="Optional label (auto-generated if blank)"
                  className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMemory}
                    className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded text-[11px] hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMemory(false);
                      setNewMemoryKey("");
                      setNewMemoryValue("");
                    }}
                    className="px-2 py-1 bg-surface border border-border rounded text-[11px] hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {memory.length === 0 && !showAddMemory && <Empty text="No memories yet" />}
            {memory.map((m, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 group relative hover:border-foreground/20 transition-colors">
                {m.key && m.key !== m.value && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 truncate pr-6">{m.key}</div>
                )}
                <div className="text-[12px] text-foreground whitespace-pre-wrap break-words">{m.value}</div>
                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'tasks' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">Add Task</span>
            </button>
            {showAddTask && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-surface">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddTask(); }}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Description (optional)..."
                  rows={3}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTask}
                    className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded text-[11px] hover:opacity-90"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTask(false);
                      setNewTaskTitle("");
                      setNewTaskDescription("");
                    }}
                    className="px-2 py-1 bg-surface border border-border rounded text-[11px] hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {tasks.length === 0 && !showAddTask && <Empty text="Nothing here yet" />}
            {tasks.map((t, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 group relative hover:border-foreground/20 transition-colors">
                <div className="text-[12px] text-foreground break-words font-medium pr-6">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words mt-1">{t.description}</div>
                )}
                <div className="text-[10px] text-muted-foreground break-words mt-1 uppercase tracking-wider">{t.status}</div>
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'notes' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAddNote(!showAddNote)}
              className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">Add Note</span>
            </button>
            {showAddNote && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-surface">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Note content..."
                  rows={3}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded text-[11px] hover:opacity-90"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteContent("");
                    }}
                    className="px-2 py-1 bg-surface border border-border rounded text-[11px] hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {notes.length === 0 && !showAddNote && <Empty text="Nothing here yet" />}
            {notes.map((n, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 group relative">
                <div className="text-[12px] text-foreground break-words">{n.content}</div>
                <div className="text-[10px] text-muted-foreground break-words">{isoToTime(n.created_at)}</div>
                <button
                  onClick={() => handleDeleteNote(n.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'activity' && <PanelList items={activity.map((a) => ({ title: a.action, subtitle: `${a.detail} â€¢ ${isoToTime(a.timestamp)}` }))} />}
        {activeTab === 'snapshots' && <PanelList items={snapshots.map((s) => ({ title: s.id, subtitle: isoToTime(s.created_at) }))} />}
        {activeTab === 'docs' && (
          <div className="space-y-2">
            {documents.length === 0 && <Empty text="No documents indexed" />}
            {documents.map((d) => (
              <div key={d.document_id} className="rounded-lg border border-border p-3">
                <div className="text-[12px] text-foreground truncate font-medium">{d.file_name}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{d.relative_path || d.absolute_path || ''}</div>
                {d.summary && <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{d.summary}</div>}
                {!d.summary && d.text_excerpt && <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2 italic">{d.text_excerpt}</div>}
                {d.access_mode && <div className="mt-1 text-[9px] text-muted-foreground/60 uppercase tracking-wide">{d.access_mode}</div>}
              </div>
            ))}
          </div>
        )}
        {activeTab === 'ingest' && <PanelList items={ingestJobs.map((j) => ({ title: j.source_kind, subtitle: `${j.status} • ${j.documents_indexed ?? 0} indexed` }))} />}
        {activeTab === 'secrets' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Stored Secrets</span>
              <button
                onClick={async () => {
                  const next = !showSecrets;
                  setShowSecrets(next);
                  if (next) {
                    api.secrets.list(false).then(setSecrets).catch(() => {});
                  } else {
                    api.secrets.list(true).then(setSecrets).catch(() => {});
                  }
                }}
                className="p-1.5 rounded hover:bg-secondary transition-colors"
                title={showSecrets ? "Hide values" : "Show values"}
              >
                {showSecrets ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
            {secrets.length === 0 && <Empty text="Nothing here yet" />}
            {secrets.map((s, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3">
                <div className="text-[12px] text-foreground break-words">{s.key}</div>
                <div className="text-[10px] text-muted-foreground break-words font-mono">
                  {showSecrets ? String(s.value) : '••••••••'}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'approvals' && (
          <div className="space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <div className="text-[12px] text-foreground">{a.summary || a.approval_type}</div>
                <div className="text-[10px] text-muted-foreground mb-2">{isoToTime(a.created_at)}</div>
                <div className="flex gap-2">
                  <button onClick={async ()=>{ await api.approvals.approve(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-success/10 text-success text-[11px]">Approve</button>
                  <button onClick={async ()=>{ await api.approvals.reject(projectName!, a.id); await refresh(); }} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-[11px]">Reject</button>
                </div>
              </div>
            ))}
            {approvals.length===0 && <Empty text="No pending approvals" />}
          </div>
        )}
        {activeTab === 'sources' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground">Linked sources are managed from New Project and Source Link actions.</div></div>}
        {activeTab === 'analysis' && <div className="space-y-2 text-[11px] text-muted-foreground"><div>Select files in the Files tab, then use the header tools.</div>{selectedPaths.length>0 && <div className="bg-surface rounded-lg p-2 text-foreground">Selected: {selectedPaths.join(', ')}</div>}</div>}
        {activeTab === 'media' && (
          <div className="space-y-3">
            <input
              ref={mediaFileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.mp4,.mov,.mkv,.avi,.webm,.m4v"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !projectName) return;
                setMediaTranscribing(true);
                setMediaError(null);
                setMediaTranscript(null);
                try {
                  const result = await api.media.transcribeUpload(projectName, file);
                  setMediaTranscript(result.text || result.transcript || JSON.stringify(result, null, 2));
                } catch (err: any) {
                  setMediaError(err?.message || 'Transcription failed');
                } finally {
                  setMediaTranscribing(false);
                  if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
                }
              }}
            />
            <div className="text-[11px] text-muted-foreground">Pick a media file and transcribe it using Whisper.</div>
            <button
              onClick={() => mediaFileInputRef.current?.click()}
              disabled={mediaTranscribing}
              className="w-full py-2 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mediaTranscribing
                ? <><span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin inline-block" />Transcribing…</>
                : <><Mic className="w-3.5 h-3.5" />Pick Media File &amp; Transcribe</>
              }
            </button>
            {mediaError && <div className="text-[11px] text-destructive break-words">{mediaError}</div>}
            {mediaTranscript && (
              <div className="rounded-lg border border-border p-3 bg-surface">
                <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Transcript</div>
                <div className="text-[12px] text-foreground break-words whitespace-pre-wrap">{mediaTranscript}</div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'github' && <div className="space-y-2"><div className="text-[11px] text-muted-foreground break-words">{gitStatus?.git_status?.stderr || gitStatus?.git_status?.stdout || 'No git data yet.'}</div></div>}
      </div>
    </aside>
  );
}

function PanelList({ items }: { items: { title: string; subtitle?: string }[] }) {
  if (!items.length) return <Empty text="Nothing here yet" />;
  return <div className="space-y-2">{items.map((item, idx) => <div key={idx} className="rounded-lg border border-border p-3"><div className="text-[12px] text-foreground break-words">{item.title}</div>{item.subtitle && <div className="text-[10px] text-muted-foreground break-words">{item.subtitle}</div>}</div>)}</div>;
}
function Empty({ text }: { text: string }) { return <div className="text-[11px] text-muted-foreground">{text}</div>; }
