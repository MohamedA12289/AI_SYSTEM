import { useState } from "react";
import { getApiBase } from "@/services/api";

interface CloneRepositoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CloneRepositoryDialog({ isOpen, onClose }: CloneRepositoryDialogProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [cloning, setCloning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    try {
      const result = await window.cubosDesktop.showOpenDialog({
        properties: ["openDirectory"]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setTargetPath(result.filePaths[0]);
      }
    } catch (err) {
      console.error("Failed to open folder picker:", err);
    }
  };

  const handleClone = async () => {
    if (!repoUrl.trim() || !targetPath.trim()) return;

    setCloning(true);
    setProgress([]);
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/api/git/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: repoUrl,
          target_path: targetPath
        })
      });

      if (!response.ok) {
        throw new Error("Clone failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.substring(6);
              if (data === "CLONE_COMPLETE") {
                setCloning(false);
                onClose();
                return;
              } else if (data.startsWith("CLONE_FAILED")) {
                setError("Clone failed. Please check the URL and try again.");
                setCloning(false);
                return;
              } else {
                setProgress(prev => [...prev, data].slice(-10));
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Clone failed");
      setCloning(false);
    }
  };

  return (
    <div
      className="clone-dialog-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        className="clone-dialog"
        style={{
          backgroundColor: "#1e1e1e",
          border: "1px solid #3c3c3c",
          borderRadius: "4px",
          width: "600px",
          maxHeight: "700px",
          display: "flex",
          flexDirection: "column",
          color: "#CCCCCC",
          fontFamily: "Consolas, monospace"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: "16px",
          borderBottom: "1px solid #3c3c3c",
          fontWeight: "bold",
          fontSize: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>Clone Repository</span>
          <button
            onClick={onClose}
            disabled={cloning}
            style={{
              background: "none",
              border: "none",
              color: "#CCCCCC",
              fontSize: "18px",
              cursor: cloning ? "not-allowed" : "pointer",
              padding: "0 4px"
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              disabled={cloning}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#3c3c3c",
                color: "#CCCCCC",
                border: "1px solid #555555",
                borderRadius: "4px",
                fontFamily: "Consolas, monospace",
                fontSize: "13px"
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
              Destination Folder
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={targetPath}
                readOnly
                placeholder="Select a folder..."
                style={{
                  flex: 1,
                  padding: "8px",
                  backgroundColor: "#3c3c3c",
                  color: "#CCCCCC",
                  border: "1px solid #555555",
                  borderRadius: "4px",
                  fontFamily: "Consolas, monospace",
                  fontSize: "13px"
                }}
              />
              <button
                onClick={handleBrowse}
                disabled={cloning}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#3c3c3c",
                  color: "#CCCCCC",
                  border: "1px solid #555555",
                  borderRadius: "4px",
                  cursor: cloning ? "not-allowed" : "pointer",
                  fontSize: "13px"
                }}
              >
                Browse
              </button>
            </div>
          </div>

          {cloning && progress.length > 0 && (
            <div style={{
              marginBottom: "16px",
              padding: "12px",
              backgroundColor: "#252526",
              border: "1px solid #3c3c3c",
              borderRadius: "4px",
              maxHeight: "200px",
              overflowY: "auto"
            }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>
                Progress:
              </div>
              {progress.map((line, idx) => (
                <div key={idx} style={{ fontSize: "11px", color: "#808080", marginBottom: "2px" }}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{
              marginBottom: "16px",
              padding: "10px",
              backgroundColor: "#5a1d1d",
              border: "1px solid #be1100",
              borderRadius: "4px",
              color: "#f48771",
              fontSize: "12px"
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleClone}
            disabled={!repoUrl.trim() || !targetPath.trim() || cloning}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#6b6b6b",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              cursor: !repoUrl.trim() || !targetPath.trim() || cloning ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              opacity: !repoUrl.trim() || !targetPath.trim() || cloning ? 0.6 : 1
            }}
          >
            {cloning ? "Cloning..." : "Clone"}
          </button>
        </div>
      </div>
    </div>
  );
}
