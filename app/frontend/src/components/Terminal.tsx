import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { getApiBaseAsync } from "@/services/api";

interface TerminalProps {
  projectId: string;
  workingDir?: string;
}

export function Terminal({ projectId, workingDir }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#ffffff",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#888888",
        magenta: "#bc3fbc",
        cyan: "#888888",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#aaaaaa",
        brightMagenta: "#d670d6",
        brightCyan: "#aaaaaa",
        brightWhite: "#ffffff",
      },
      rows: 24,
      cols: 80,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    let disposed = false;

    getApiBaseAsync().then((apiBase) => {
      if (disposed) return;
      const wsProtocol = apiBase.startsWith("https:") ? "wss:" : "ws:";
      let wsHost: string;
      try {
        wsHost = new URL(apiBase).host;
      } catch {
        wsHost = window.location.host.replace(/:\d+/, ":8000");
      }

      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/terminal/${projectId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        xterm.writeln("\x1b[1;32mTerminal connected\x1b[0m");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ready") {
            if (workingDir) {
              ws.send(JSON.stringify({ type: "input", data: `cd ${workingDir}\r` }));
            }
            return;
          }
          if (msg.type === "output" && msg.data) {
            xterm.write(msg.data);
          } else if (msg.type === "error") {
            xterm.writeln(`\r\n\x1b[1;31m${msg.message || "Terminal error"}\x1b[0m`);
          }
        } catch {
          xterm.write(event.data);
        }
      };

      ws.onerror = () => {
        xterm.writeln("\r\n\x1b[1;31mTerminal connection error\x1b[0m");
      };

      ws.onclose = () => {
        xterm.writeln("\r\n\x1b[1;33mTerminal disconnected\x1b[0m");
      };
    }).catch((error) => {
      xterm.writeln(`\r\n\x1b[1;31mTerminal setup failed: ${error?.message || "unknown"}\x1b[0m`);
    });

    xterm.onData((data) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN && xtermRef.current) {
          ws.send(JSON.stringify({
            type: "resize",
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }));
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      isInitializedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [projectId, workingDir]);

  return (
    <div ref={terminalRef} className="w-full h-full bg-[#1e1e1e]" />
  );
}
