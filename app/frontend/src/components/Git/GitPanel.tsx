import { useState, useEffect } from "react";
import {
  GitBranch, GitCommit, GitPullRequest, GitMerge,
  RefreshCw, Upload, Download, Plus, Check, X,
  ChevronRight, ChevronDown, Github
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { GitHubAuthDialog } from "@/components/GitHub/GitHubAuthDialog";

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  staged: string[];
}

interface GitPanelProps {
  projectId: string;
}

export default function GitPanel({ projectId }: GitPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showChanges, setShowChanges] = useState(true);
  const [showStaged, setShowStaged] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [authState, setAuthState] = useState<string | null>(() => localStorage.getItem("github_auth_state"));
  const [ghUsername, setGhUsername] = useState<string | null>(() => localStorage.getItem("github_username"));
  const [publishName, setPublishName] = useState("");
  const [publishPrivate, setPublishPrivate] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    loadStatus();
    loadBranches();
  }, [projectId]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const result = await api.git.status(projectId);
      setStatus({
        branch: result.branch || 'main',
        ahead: result.ahead || 0,
        behind: result.behind || 0,
        modified: result.modified || [],
        untracked: result.untracked || [],
        staged: result.staged || []
      });
    } catch (error) {
      console.error('Failed to load git status:', error);
      setStatus({
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        untracked: [],
        staged: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const result = await api.git.branches(projectId);
      setBranches(result.branches || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message');
      return;
    }

    try {
      const filesToCommit = selectedFiles.size > 0
        ? Array.from(selectedFiles)
        : undefined;

      await api.git.commit(projectId, commitMessage, filesToCommit);
      setCommitMessage("");
      setSelectedFiles(new Set());
      loadStatus();
      toast.success('Changes committed successfully');
    } catch (error) {
      toast.error('Failed to commit: ' + (error as Error).message);
    }
  };

  const handlePush = async () => {
    try {
      await api.git.push(projectId);
      loadStatus();
      toast.success('Changes pushed successfully');
    } catch (error) {
      toast.error('Failed to push: ' + (error as Error).message);
    }
  };

  const handlePull = async () => {
    try {
      await api.git.pull(projectId);
      loadStatus();
      toast.success('Changes pulled successfully');
    } catch (error) {
      toast.error('Failed to pull: ' + (error as Error).message);
    }
  };

  const handlePublishClick = () => {
    if (!authState || !ghUsername) {
      setShowAuthDialog(true);
    } else {
      setPublishName(projectId);
      setShowPublishDialog(true);
    }
  };

  const handleAuthenticated = (username: string, state: string) => {
    setGhUsername(username);
    setAuthState(state);
    localStorage.setItem("github_username", username);
    localStorage.setItem("github_auth_state", state);
    setShowAuthDialog(false);
    setPublishName(projectId);
    setShowPublishDialog(true);
    toast.success(`Signed in as ${username}`);
  };

  const handleCreateRepo = async () => {
    if (!authState || !publishName.trim()) return;
    setPublishing(true);
    try {
      let projectPath: string | undefined;
      try {
        const proj: any = await api.projects.get(projectId);
        projectPath = proj?.workspace_root || proj?.project_path || proj?.path;
      } catch {}
      const result = await api.github.createRepo({
        name: publishName.trim(),
        private: publishPrivate,
        project_path: projectPath,
        state: authState,
        push: !!projectPath,
      });
      toast.success(`Published to ${result?.repo?.full_name || publishName}`);
      setShowPublishDialog(false);
      loadStatus();
    } catch (error: any) {
      const msg = error?.message || 'Failed to publish';
      if (msg.toLowerCase().includes('not authenticated') || msg.includes('401')) {
        setAuthState(null);
        setGhUsername(null);
        localStorage.removeItem("github_auth_state");
        localStorage.removeItem("github_username");
        setShowPublishDialog(false);
        setShowAuthDialog(true);
      }
      toast.error('Publish failed: ' + msg);
    } finally {
      setPublishing(false);
    }
  };

  const toggleFileSelection = (file: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file)) {
      newSelected.delete(file);
    } else {
      newSelected.add(file);
    }
    setSelectedFiles(newSelected);
  };

  const allChangedFiles = [
    ...(status?.modified || []),
    ...(status?.untracked || [])
  ];

  const changedCount = allChangedFiles.length;
  const stagedCount = status?.staged.length || 0;

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground">
              {status?.branch || 'main'}
            </span>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
          {status && (
            <>
              {status.ahead > 0 && (
                <span className="flex items-center gap-0.5">
                  <Upload className="w-3 h-3" />
                  {status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="flex items-center gap-0.5">
                  <Download className="w-3 h-3" />
                  {status.behind}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex gap-1">
          <button
            onClick={handlePull}
            disabled={loading}
            className="flex-1 px-2 py-1 text-[10px] bg-surface border border-border rounded hover:bg-accent disabled:opacity-50"
            title="Pull"
          >
            Pull
          </button>
          <button
            onClick={handlePush}
            disabled={loading}
            className="flex-1 px-2 py-1 text-[10px] bg-surface border border-border rounded hover:bg-accent disabled:opacity-50"
            title="Push"
          >
            Push
          </button>
        </div>
        <button
          onClick={handlePublishClick}
          disabled={loading || publishing}
          className="w-full mt-1 px-2 py-1 text-[10px] bg-surface border border-border rounded hover:bg-accent disabled:opacity-50 flex items-center justify-center gap-1"
          title={ghUsername ? `Publish to GitHub as ${ghUsername}` : "Publish to GitHub"}
        >
          <Github className="w-3 h-3" />
          {ghUsername ? `Publish to GitHub (${ghUsername})` : "Publish to GitHub"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1">
          <div
            onClick={() => setShowChanges(!showChanges)}
            className="flex items-center gap-1 py-1 px-1.5 hover:bg-accent rounded cursor-pointer group mb-1"
          >
            {showChanges ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Changes
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">{changedCount}</span>
          </div>

          {showChanges && allChangedFiles.map((file) => (
            <div
              key={file}
              onClick={() => toggleFileSelection(file)}
              className="flex items-center gap-2 py-1 px-2 ml-4 hover:bg-accent rounded cursor-pointer group"
            >
              <div className={`w-3 h-3 rounded border ${
                selectedFiles.has(file)
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground'
              } flex items-center justify-center`}>
                {selectedFiles.has(file) && (
                  <Check className="w-2 h-2 text-primary-foreground" />
                )}
              </div>
              <span className="text-[11px] text-foreground truncate">{file}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {status?.modified.includes(file) ? 'M' : 'U'}
              </span>
            </div>
          ))}

          {showChanges && changedCount === 0 && (
            <div className="text-[10px] text-muted-foreground py-2 px-2 ml-4">
              No changes
            </div>
          )}
        </div>

        {stagedCount > 0 && (
          <div className="px-2 py-1">
            <div
              onClick={() => setShowStaged(!showStaged)}
              className="flex items-center gap-1 py-1 px-1.5 hover:bg-accent rounded cursor-pointer group mb-1"
            >
              {showStaged ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Staged Changes
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">{stagedCount}</span>
            </div>

            {showStaged && status?.staged.map((file) => (
              <div
                key={file}
                className="flex items-center gap-2 py-1 px-2 ml-4 rounded"
              >
                <Check className="w-3 h-3 text-green-500" />
                <span className="text-[11px] text-foreground truncate">{file}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full px-2 py-1.5 text-[11px] bg-surface border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 resize-none"
          rows={3}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || loading}
          className="w-full mt-2 px-2 py-1.5 text-[10px] bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <GitCommit className="w-3 h-3" />
          Commit {selectedFiles.size > 0 && `(${selectedFiles.size} files)`}
        </button>
      </div>

      {showAuthDialog && (
        <GitHubAuthDialog
          onClose={() => setShowAuthDialog(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {showPublishDialog && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "#1e1e1e", border: "1px solid #3c3c3c",
            borderRadius: 4, width: 460, color: "#CCCCCC",
            fontFamily: "Consolas, monospace",
          }}>
            <div style={{ padding: 16, borderBottom: "1px solid #3c3c3c", fontWeight: "bold", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Publish to GitHub</span>
              <button onClick={() => setShowPublishDialog(false)} style={{ background: "none", border: "none", color: "#CCCCCC", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: "#9b9b9b", marginBottom: 12 }}>
                Signed in as <strong style={{ color: "#fff" }}>{ghUsername}</strong>
              </p>
              <label style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Repository name</label>
              <input
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="my-project"
                style={{ width: "100%", padding: 8, backgroundColor: "#3c3c3c", color: "#CCCCCC", border: "1px solid #555", borderRadius: 4, fontSize: 13, fontFamily: "Consolas, monospace", marginBottom: 12 }}
              />
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <input type="checkbox" checked={publishPrivate} onChange={(e) => setPublishPrivate(e.target.checked)} />
                Private repository
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowPublishDialog(false)}
                  disabled={publishing}
                  style={{ flex: 1, padding: 10, backgroundColor: "#3c3c3c", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRepo}
                  disabled={publishing || !publishName.trim()}
                  style={{ flex: 1, padding: 10, backgroundColor: "#28a745", color: "#fff", border: "none", borderRadius: 4, cursor: publishing || !publishName.trim() ? "not-allowed" : "pointer", fontSize: 13, fontWeight: "bold", opacity: publishing || !publishName.trim() ? 0.6 : 1 }}
                >
                  {publishing ? "Publishing..." : "Create & Push"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}