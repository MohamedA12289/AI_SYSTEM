import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Upload, Link2, X, GitBranch, Loader2 } from "lucide-react";
import { api } from "@/services/api";

interface Props { onProjectCreated?: () => Promise<any>; }

export default function NewProjectPage({ onProjectCreated }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "new" | "import" | "link">("choose");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [cloneProgress, setCloneProgress] = useState<string | null>(null);
  const [browserFolderPath, setBrowserFolderPath] = useState("");

  const slugify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "new_project";

  const handleCreate = async () => {
    setError(null); setLoading(true);
    try {
      const project_name = slugify(name);
      if (mode === 'new') {
        await api.projects.create({ project_name, display_name: name.trim(), description });
        await onProjectCreated?.();
        navigate(`/project/${project_name}/thread/latest`);
      }
    } catch (e:any) { setError(e?.message || 'Could not create project.'); }
    finally { setLoading(false); }
  };

  const handleImport = async () => {
    const hasDesktop = !!(window as any).cubosDesktop?.showOpenDialog;
    if (hasDesktop) {
      try {
        const result = await (window as any).cubosDesktop.showOpenDialog({
          properties: ['openDirectory', 'createDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          const folderPath = result.filePaths[0];
          setLoading(true);
          try {
            const data = await api.projects.importExisting({ path: folderPath, display_name: '', description: '' });
            await onProjectCreated?.();
            navigate(`/project/${data.project.project_name}/thread/latest`);
          } catch (error: any) {
            if (error?.status !== 409) throw error;
            const projectName = error?.detail?.project_name || error?.body?.project_name;
            await onProjectCreated?.();
            if (projectName) {
              navigate(`/project/${projectName}/thread/latest`);
            } else {
              setError('Project already exists.');
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to import folder');
        setLoading(false);
      }
    } else {
      setMode('import');
    }
  };

  const handleBrowserImport = async () => {
    if (!browserFolderPath.trim()) return;
    setError(null); setLoading(true);
    try {
      try {
        const data = await api.projects.importExisting({ path: browserFolderPath.trim(), display_name: '', description: '' });
        await onProjectCreated?.();
        navigate(`/project/${data.project.project_name}/thread/latest`);
      } catch (error: any) {
        if (error?.status !== 409) throw error;
        const projectName = error?.detail?.project_name || error?.body?.project_name;
        await onProjectCreated?.();
        if (projectName) {
          navigate(`/project/${projectName}/thread/latest`);
        } else {
          setError('Project already exists.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import folder');
    } finally { setLoading(false); }
  };

  const handleCloneGit = async () => {
    if (!repoUrl.trim()) { setError("Please enter a repository URL"); return; }
    setError(null); setLoading(true);
    setCloneProgress("Cloning repository...");
    try {
      const result = await api.git.cloneProject(repoUrl.trim(), repoName.trim() || undefined);
      setCloneProgress("Done!");
      await onProjectCreated?.();
      navigate(`/project/${result.project.project_name}/thread/latest`);
    } catch (e: any) {
      setError(e?.message || 'Clone failed.');
      setCloneProgress(null);
    } finally { setLoading(false); }
  };

  const deriveNameFromUrl = (url: string) => {
    const parts = url.replace(/\/$/, '').split('/');
    const last = parts[parts.length - 1]?.replace(/\.git$/, '') || '';
    setRepoName(last);
  };

  if (mode === 'choose') {
    return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-lg animate-fade-in"><div className="text-center mb-8"><h1 className="text-lg font-semibold text-foreground mb-1">Create a Workspace</h1><p className="text-[12px] text-muted-foreground">Start fresh, import content, or link an existing source.</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><button onClick={()=>setMode('new')} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><FolderPlus className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">New Project</h3><p className="text-[11px] text-muted-foreground">Empty workspace</p></button><button onClick={()=>handleImport()} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><Upload className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">Import Project</h3><p className="text-[11px] text-muted-foreground">Link existing folder</p></button><button onClick={()=>setMode('link')} className="bg-card border border-border rounded-xl p-5 text-left hover:border-foreground/20 transition-all group"><Link2 className="w-5 h-5 text-foreground mb-3" /><h3 className="text-sm font-medium text-foreground mb-1">Link Source</h3><p className="text-[11px] text-muted-foreground">Connect to Git repo</p></button></div>{error && <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">{error}</div>}<button onClick={()=>navigate('/')} className="mx-auto mt-6 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">Cancel</button></div></div>;
  }

  if (mode === 'import') {
    return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-md bg-card border border-border rounded-xl p-6 animate-fade-in"><div className="flex items-center justify-between mb-5"><h2 className="text-sm font-semibold text-foreground">Import Project Folder</h2><button onClick={()=>setMode('choose')} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button></div><div className="space-y-4"><div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Folder Path</label><input value={browserFolderPath} onChange={(e)=>setBrowserFolderPath(e.target.value)} placeholder="C:\Users\you\my-project or /home/you/my-project" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" onKeyDown={(e)=>{if(e.key==='Enter')handleBrowserImport();}} /></div>{error && <div className="text-[11px] text-destructive">{error}</div>}<button onClick={handleBrowserImport} disabled={!browserFolderPath.trim()||loading} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30">{loading?<span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Importing…</span>:'Import Folder'}</button></div></div></div>;
  }

  if (mode === 'link') {
    return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-md bg-card border border-border rounded-xl p-6 animate-fade-in"><div className="flex items-center justify-between mb-5"><div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-foreground" /><h2 className="text-sm font-semibold text-foreground">Clone Git Repository</h2></div><button onClick={()=>{setMode('choose');setError(null);setCloneProgress(null);}} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button></div><div className="space-y-4"><div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Repository URL</label><input value={repoUrl} onChange={(e)=>{setRepoUrl(e.target.value);deriveNameFromUrl(e.target.value);}} placeholder="https://github.com/user/repo.git" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" /></div><div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Project Name <span className="text-muted-foreground/60">(optional)</span></label><input value={repoName} onChange={(e)=>setRepoName(e.target.value)} placeholder="Auto-derived from URL" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" /></div>{cloneProgress && <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />{cloneProgress}</div>}{error && <div className="text-[11px] text-destructive">{error}</div>}<button onClick={handleCloneGit} disabled={!repoUrl.trim()||loading} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30">{loading?<span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Cloning…</span>:'Clone Repository'}</button></div></div></div>;
  }

  return <div className="flex-1 flex items-center justify-center"><div className="w-full max-w-md bg-card border border-border rounded-xl p-6 animate-fade-in"><div className="flex items-center justify-between mb-5"><h2 className="text-sm font-semibold text-foreground">New Project</h2><button onClick={()=>setMode('choose')} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button></div><div className="space-y-4">
  <div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Project Name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="My Project" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" /></div>
  <div><label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Description</label><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="What is this project for?" rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none" /></div>
  {error && <div className="text-[11px] text-destructive">{error}</div>}
  <button onClick={handleCreate} disabled={!name.trim() || loading} className="w-full py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30">{loading ? 'Creating…' : 'Create Workspace'}</button>
</div></div></div>;
}
