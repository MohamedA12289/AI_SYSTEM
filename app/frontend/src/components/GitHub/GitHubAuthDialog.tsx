import { useState } from "react";
import { getApiBase } from "@/services/api";

interface GitHubAuthDialogProps {
  onClose: () => void;
  onAuthenticated: (username: string, state: string) => void;
}

export function GitHubAuthDialog({ onClose, onAuthenticated }: GitHubAuthDialogProps) {
  const [activeTab, setActiveTab] = useState<"oauth" | "pat">("oauth");
  const [patToken, setPatToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/github/auth/initiate`);
      const data = await response.json();
      
      setAuthState(data.state);
      
      window.cubosDesktop.openExternal(data.auth_url);
      
      startPolling(data.state);
    } catch (err: any) {
      setError(err.message || "Failed to initiate OAuth");
      setLoading(false);
    }
  };

  const startPolling = (state: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${getApiBase()}/api/github/auth/status?state=${state}`);
        const data = await response.json();
        
        if (data.authenticated && data.username) {
          clearInterval(pollInterval);
          setLoading(false);
          onAuthenticated(data.username, state);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      setLoading(false);
      setError("Authentication timeout. Please try again.");
    }, 120000);
  };

  const handlePATAuth = async () => {
    if (!patToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiBase()}/api/github/auth/pat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patToken }),
      });
      
      if (!response.ok) {
        throw new Error("Invalid token");
      }
      
      const data = await response.json();
      onAuthenticated(data.username, data.state);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div style={{
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
    }}>
      <div style={{
        backgroundColor: "#1e1e1e",
        border: "1px solid #3c3c3c",
        borderRadius: "4px",
        width: "500px",
        maxHeight: "600px",
        display: "flex",
        flexDirection: "column",
        color: "#CCCCCC",
        fontFamily: "Consolas, monospace"
      }}>
        <div style={{
          padding: "16px",
          borderBottom: "1px solid #3c3c3c",
          fontWeight: "bold",
          fontSize: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>GitHub Authentication</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#CCCCCC",
              fontSize: "18px",
              cursor: "pointer",
              padding: "0 4px"
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          display: "flex",
          borderBottom: "1px solid #3c3c3c"
        }}>
          <button
            onClick={() => setActiveTab("oauth")}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: activeTab === "oauth" ? "#252526" : "#1e1e1e",
              color: activeTab === "oauth" ? "#FFFFFF" : "#CCCCCC",
              border: "none",
              borderBottom: activeTab === "oauth" ? "2px solid #6b6b6b" : "none",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            OAuth
          </button>
          <button
            onClick={() => setActiveTab("pat")}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: activeTab === "pat" ? "#252526" : "#1e1e1e",
              color: activeTab === "pat" ? "#FFFFFF" : "#CCCCCC",
              border: "none",
              borderBottom: activeTab === "pat" ? "2px solid #6b6b6b" : "none",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Personal Access Token
          </button>
        </div>

        <div style={{ padding: "20px", flex: 1 }}>
          {activeTab === "oauth" ? (
            <div>
              <p style={{ marginBottom: "16px", fontSize: "13px", lineHeight: "1.5" }}>
                Sign in with your GitHub account to enable repository cloning and push/pull operations.
              </p>
              <button
                onClick={handleOAuthSignIn}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#28a745",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? "Waiting for authentication..." : "Sign in with GitHub"}
              </button>
              {loading && (
                <p style={{ marginTop: "12px", fontSize: "12px", color: "#808080", textAlign: "center" }}>
                  A browser window should open. Please authorize the app and return here.
                </p>
              )}
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: "16px", fontSize: "13px", lineHeight: "1.5" }}>
                Enter a GitHub Personal Access Token with <code style={{ backgroundColor: "#3c3c3c", padding: "2px 4px" }}>repo</code> scope.
              </p>
              <input
                type="password"
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#3c3c3c",
                  color: "#CCCCCC",
                  border: "1px solid #555555",
                  borderRadius: "4px",
                  fontFamily: "Consolas, monospace",
                  fontSize: "13px",
                  marginBottom: "12px"
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePATAuth();
                  }
                }}
              />
              <button
                onClick={handlePATAuth}
                disabled={!patToken.trim() || loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#6b6b6b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: !patToken.trim() || loading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  opacity: !patToken.trim() || loading ? 0.6 : 1
                }}
              >
                Authenticate
              </button>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: "12px",
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
        </div>
      </div>
    </div>
  );
}
