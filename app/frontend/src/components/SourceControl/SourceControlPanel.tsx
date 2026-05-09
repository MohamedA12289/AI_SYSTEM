import { useState, useEffect } from "react";
import { getApiBase } from "@/services/api";

interface GitFile {
  file: string;
  status: string;
}

interface GitStatus {
  branch: string;
  staged: GitFile[];
  unstaged: GitFile[];
  ahead: number;
  behind: number;
}

interface SourceControlPanelProps {
  projectPath: string;
}

export function SourceControlPanel({ projectPath }: SourceControlPanelProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGitStatus();
  }, [projectPath]);

  const loadGitStatus = async () => {
    try {
      const response = await fetch(`${getApiBase()}/api/git/status?project_path=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const data = await response.json();
        setGitStatus(data);
      }
    } catch (error) {
      console.error("Failed to load git status:", error);
    }
  };

  const stageFile = async (file: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/git/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath, files: [file] }),
      });
      if (response.ok) {
        await loadGitStatus();
      }
    } catch (error) {
      console.error("Failed to stage file:", error);
    }
    setLoading(false);
  };

  const unstageFile = async (file: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/git/unstage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath, files: [file] }),
      });
      if (response.ok) {
        await loadGitStatus();
      }
    } catch (error) {
      console.error("Failed to unstage file:", error);
    }
    setLoading(false);
  };

  const commit = async () => {
    if (!commitMessage.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/git/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath, message: commitMessage }),
      });
      if (response.ok) {
        setCommitMessage("");
        await loadGitStatus();
      }
    } catch (error) {
      console.error("Failed to commit:", error);
    }
    setLoading(false);
  };

  const push = async () => {
    setLoading(true);
    try {
      await fetch(`${getApiBase()}/api/git/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath }),
      });
      await loadGitStatus();
    } catch (error) {
      console.error("Failed to push:", error);
    }
    setLoading(false);
  };

  const pull = async () => {
    setLoading(true);
    try {
      await fetch(`${getApiBase()}/api/git/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_path: projectPath }),
      });
      await loadGitStatus();
    } catch (error) {
      console.error("Failed to pull:", error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "M": return "#E2C08D";
      case "A": return "#73C991";
      case "D": return "#F48771";
      case "U": return "#73C991";
      default: return "#CCCCCC";
    }
  };

  if (!gitStatus) {
    return (
      <div style={{
        padding: "20px",
        color: "#CCCCCC",
        fontSize: "14px",
        fontFamily: "Consolas, monospace"
      }}>
        Not a git repository
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      backgroundColor: "#1e1e1e",
      color: "#CCCCCC",
      fontFamily: "Consolas, monospace",
      fontSize: "13px"
    }}>
      <div style={{
        padding: "10px",
        borderBottom: "1px solid #2d2d2d",
        fontWeight: "bold"
      }}>
        Source Control
      </div>

      <div style={{
        padding: "10px",
        borderBottom: "1px solid #2d2d2d"
      }}>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message (Ctrl+Enter to commit)"
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "Enter") {
              commit();
            }
          }}
          style={{
            width: "100%",
            minHeight: "60px",
            backgroundColor: "#3c3c3c",
            color: "#CCCCCC",
            border: "1px solid #555555",
            padding: "8px",
            fontFamily: "Consolas, monospace",
            fontSize: "13px",
            resize: "vertical"
          }}
        />
        <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
          <button
            onClick={commit}
            disabled={!commitMessage.trim() || gitStatus.staged.length === 0 || loading}
            style={{
              flex: 1,
              padding: "6px 12px",
              backgroundColor: "#6b6b6b",
              color: "#ffffff",
              border: "none",
              cursor: gitStatus.staged.length === 0 || !commitMessage.trim() ? "not-allowed" : "pointer",
              opacity: gitStatus.staged.length === 0 || !commitMessage.trim() ? 0.5 : 1
            }}
          >
            Commit
          </button>
          <button
            onClick={push}
            disabled={loading}
            style={{
              padding: "6px 12px",
              backgroundColor: "#3c3c3c",
              color: "#CCCCCC",
              border: "1px solid #555555",
              cursor: "pointer"
            }}
          >
            Push
          </button>
          <button
            onClick={pull}
            disabled={loading}
            style={{
              padding: "6px 12px",
              backgroundColor: "#3c3c3c",
              color: "#CCCCCC",
              border: "1px solid #555555",
              cursor: "pointer"
            }}
          >
            Pull
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {gitStatus.staged.length > 0 && (
          <div>
            <div style={{
              padding: "8px 10px",
              fontWeight: "bold",
              backgroundColor: "#252526"
            }}>
              Staged Changes ({gitStatus.staged.length})
            </div>
            {gitStatus.staged.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "4px 10px",
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2a2d2e"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <span style={{ color: getStatusColor(item.status), marginRight: "8px", fontWeight: "bold" }}>
                  {item.status}
                </span>
                <span style={{ flex: 1 }}>{item.file}</span>
                <button
                  onClick={() => unstageFile(item.file)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#CCCCCC",
                    cursor: "pointer",
                    padding: "2px 6px"
                  }}
                >
                  -
                </button>
              </div>
            ))}
          </div>
        )}

        {gitStatus.unstaged.length > 0 && (
          <div>
            <div style={{
              padding: "8px 10px",
              fontWeight: "bold",
              backgroundColor: "#252526",
              marginTop: gitStatus.staged.length > 0 ? "10px" : "0"
            }}>
              Changes ({gitStatus.unstaged.length})
            </div>
            {gitStatus.unstaged.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "4px 10px",
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2a2d2e"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <span style={{ color: getStatusColor(item.status), marginRight: "8px", fontWeight: "bold" }}>
                  {item.status}
                </span>
                <span style={{ flex: 1 }}>{item.file}</span>
                <button
                  onClick={() => stageFile(item.file)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#CCCCCC",
                    cursor: "pointer",
                    padding: "2px 6px"
                  }}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}

        {gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0 && (
          <div style={{
            padding: "20px",
            textAlign: "center",
            color: "#808080"
          }}>
            No changes
          </div>
        )}
      </div>

      <div style={{
        padding: "8px 10px",
        borderTop: "1px solid #2d2d2d",
        fontSize: "12px",
        color: "#808080"
      }}>
        Branch: {gitStatus.branch}
        {gitStatus.ahead > 0 && ` ↑${gitStatus.ahead}`}
        {gitStatus.behind > 0 && ` ↓${gitStatus.behind}`}
      </div>
    </div>
  );
}
