import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Upload, Link2, X, Folder, File, FileArchive } from "lucide-react";
import { api } from "@/services/api";

interface Props { onProjectCreated?: () => Promise<any>; }

export default function NewProjectPage({ onProjectCreated }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "new" | "import" | "link">("choose");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [accessMode, setAccessMode] = useState<"link_readonly" | "import">("link_readonly");
  const [importType, setImportType] = useState<"file" | "folder" | "zip">("folder");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "new_project";

  const handleCreate = async () => {
    setError(null); setLoading(true);
    try {
      const project_name = slugify(name);
      if (mode === 'new') {
        await api.projects.create({ project_name, display_name: name.trim(), description });
      } else if (mode === 'link') {
        await api.projects.importExisting({ project_name, display_name: name.trim(), description, source_path: sourcePath, access_mode: accessMode });
      } else if (mode === 'import') {
        await api.projects.create({ project_name, display_name: name.trim(), description });
        if (importType === 'file') await api.ingest.file(project_name, sourcePath);
        if (importType === 'folder') await api.ingest.folder(project_name, sourcePath);
        if (importType === 'zip') await api.ingest.zip(project_name, sourcePath);
      }
      await onProjectCreated?.();
      navigate(`/project/${project_name}`);
    } catch (e:any) { setError(e?.message || 'Could not create project.'); }
    finally { setLoading(false); }
  };

  if (mode === 'choose') {
    return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-lg animate-fade-in"><div className="text-center mb-8"><h1 className="text-lg font-semibold text-foreground mb-1">Create a Workspace</h1><p className="text-[12px] text-muted-foreground">Start fresh, import content, or link an existing source.</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><button onClick={()=>setMode('new')} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><FolderPlus className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">New Project</h3><p className="text-[11px] text-muted-foreground">Empty workspace</p></button><button onClick={()=>setMode('import')} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><Upload className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">Import</h3><p className="text-[11px] text-muted-foreground">Files, folders, or ZIP</p></button><button onClick={()=>setMode('link')} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><Link2 className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">Link Source</h3><p className="text-[11px] text-muted-foreground">Read-only or linked</p></button></div><button onClick={()=>navigate('/')} className="mx-auto mt-6 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button></div></div>;
  }

  return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-md bg-card border border-border rounded-xl p-6 animate-fade-in"><div className="flex items-center justify-between mb-5"><h2 className="text-sm font-semibold text-foreground">{mode === 'new' ? 'New Project' : mode === 'link' ? 'Link Source' : 'Import Project'}</h2><button onClick={()=>setMode('choose')} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button></div><div className="space-y-4">
  {mode === 'import' && <div><label className="text-[11px] font-medium text-muted-foreground mb-2 block">Import Type</label><div className="grid grid-cols-3 gap-2">{([{value:'file',label:'File',Icon:File},{value:'folder',label:'Folder',Icon:Folder},{value:'zip',label:'ZIP Archive',Icon:FileArchive}] as const).map(({value,label,Icon}) => <button key={value} onClick={()=>setImportType(value)} className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all text-[11px] ${importType===value?'border-foreground/30 bg-secondary':'border-border hover:border-foreground/15'}`}><Icon className="w-4 h-4 text-foreground" />{label}</button>)}</div></div>}
  {(mode === 'link' || mode === 'import') && <div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Source Path</label><input value={sourcePath} onChange={(e)=>setSourcePath(e.target.value)} placeholder="D:\path\to\source" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" /></div>}
  {mode === 'link' && <div><label className="text-[11px] font-medium text-muted-foreground mb-2 block">Access Mode</label><div className="grid grid-cols-2 gap-2"><button onClick={()=>setAccessMode('link_readonly')} className={`py-3 rounded-lg border transition-all text-[11px] ${accessMode==='link_readonly'?'border-foreground/30 bg-secondary':'border-border hover:border-foreground/15'}`}>Link Readonly</button><button onClick={()=>setAccessMode('import')} className={`py-3 rounded-lg border transition-all text-[11px] ${accessMode==='import'?'border-foreground/30 bg-secondary':'border-border hover:border-foreground/15'}`}>Import Copy</button></div></div>}
  <div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Project Name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="My Project" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" /></div>
  <div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Description</label><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="What is this project for?" rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none" /></div>
  {error && <div className="text-[11px] text-destructive">{error}</div>}
  <button onClick={handleCreate} disabled={!name.trim() || loading || ((mode==='link'||mode==='import') && !sourcePath.trim())} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30">{loading ? 'Working…' : mode === 'new' ? 'Create Workspace' : mode === 'link' ? 'Link & Create Workspace' : 'Import & Create Workspace'}</button>
</div></div></div>;
}
