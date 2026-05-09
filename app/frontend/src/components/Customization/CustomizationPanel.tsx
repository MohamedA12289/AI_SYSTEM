import { useState } from "react";

interface CustomizationPanelProps {
  projectPath: string;
}

type TabType = "instructions" | "prompts" | "hooks" | "mcp" | "plugins" | "agents" | "skills";

export function CustomizationPanel({ projectPath }: CustomizationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("instructions");

  const tabs: { id: TabType; label: string }[] = [
    { id: "instructions", label: "Instructions" },
    { id: "prompts", label: "Prompts" },
    { id: "hooks", label: "Hooks" },
    { id: "mcp", label: "MCP Servers" },
    { id: "plugins", label: "Plugins" },
    { id: "agents", label: "Agents" },
    { id: "skills", label: "Skills" }
  ];

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
        Customization
      </div>

      <div style={{
        display: "flex",
        borderBottom: "1px solid #2d2d2d",
        overflowX: "auto"
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              backgroundColor: activeTab === tab.id ? "#252526" : "#1e1e1e",
              color: activeTab === tab.id ? "#FFFFFF" : "#CCCCCC",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #6b6b6b" : "none",
              cursor: "pointer",
              fontSize: "12px",
              whiteSpace: "nowrap"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {activeTab === "instructions" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Custom Instructions</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Add Instruction
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No instructions yet. Click "+ Add Instruction" to create one.
            </div>
          </div>
        )}

        {activeTab === "prompts" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Prompt Templates</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Add Prompt
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No prompts yet.
            </div>
          </div>
        )}

        {activeTab === "hooks" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Lifecycle Hooks</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Add Hook
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No hooks configured.
            </div>
          </div>
        )}

        {activeTab === "mcp" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>MCP Servers</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Add MCP Server
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No MCP servers configured.
            </div>
          </div>
        )}

        {activeTab === "plugins" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Installed Plugins</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Install Plugin
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No plugins installed.
            </div>
          </div>
        )}

        {activeTab === "agents" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Agent Configurations</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Configure Agent
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No custom agents configured.
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Reusable Skills</span>
              <button style={{
                padding: "6px 12px",
                backgroundColor: "#6b6b6b",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                fontSize: "12px"
              }}>
                + Add Skill
              </button>
            </div>
            <div style={{ color: "#808080", textAlign: "center", padding: "40px" }}>
              No skills defined.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
