export function FileArtifactsPanel() {
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
        File Artifacts
      </div>

      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: "center",
        color: "#808080"
      }}>
        No artifacts available.
        <br />
        <span style={{ fontSize: "11px", marginTop: "8px", display: "block" }}>
          File artifacts from AI-generated code will appear here.
        </span>
      </div>
    </div>
  );
}
