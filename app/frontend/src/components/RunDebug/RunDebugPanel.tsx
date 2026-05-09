export function RunDebugPanel() {
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
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}>
        <button
          disabled
          style={{
            padding: "4px 8px",
            backgroundColor: "#3c3c3c",
            color: "#808080",
            border: "1px solid #555555",
            cursor: "not-allowed",
            opacity: 0.5
          }}
        >
          ▶
        </button>
        <select
          disabled
          style={{
            padding: "4px 8px",
            backgroundColor: "#3c3c3c",
            color: "#808080",
            border: "1px solid #555555",
            cursor: "not-allowed",
            opacity: 0.5
          }}
        >
          <option>No configurations</option>
        </select>
      </div>

      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: "40px",
        textAlign: "center",
        color: "#808080"
      }}>
        <div style={{ marginBottom: "16px", fontSize: "14px" }}>
          To customize Run and Debug, create a launch.json file.
        </div>
        <button
          disabled
          style={{
            padding: "8px 16px",
            backgroundColor: "#3c3c3c",
            color: "#808080",
            border: "1px solid #555555",
            cursor: "not-allowed",
            opacity: 0.5
          }}
        >
          Create launch.json
        </button>
      </div>

      <div style={{ borderTop: "1px solid #2d2d2d", fontSize: "12px" }}>
        <div style={{ padding: "8px 10px", fontWeight: "bold" }}>Variables</div>
        <div style={{ padding: "8px 10px", color: "#808080" }}>Not available</div>
        
        <div style={{ padding: "8px 10px", fontWeight: "bold", marginTop: "10px" }}>Watch</div>
        <div style={{ padding: "8px 10px", color: "#808080" }}>Not available</div>
        
        <div style={{ padding: "8px 10px", fontWeight: "bold", marginTop: "10px" }}>Call Stack</div>
        <div style={{ padding: "8px 10px", color: "#808080" }}>Not available</div>
        
        <div style={{ padding: "8px 10px", fontWeight: "bold", marginTop: "10px" }}>Breakpoints</div>
        <div style={{ padding: "8px 10px", color: "#808080" }}>No breakpoints</div>
      </div>
    </div>
  );
}
