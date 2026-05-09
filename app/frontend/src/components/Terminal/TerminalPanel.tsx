import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Plus, Maximize2, ChevronDown, X, Terminal as TerminalIcon } from 'lucide-react';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
  projectName: string;
  onClose?: () => void;
}

interface TerminalInstance {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket;
}

async function getBackendUrl() {
  if (typeof window !== 'undefined' && (window as any).cubosDesktop?.getBackendPort) {
    try {
      const result = await (window as any).cubosDesktop.getBackendPort();
      if (result.ok && result.port) {
        return `ws://127.0.0.1:${result.port}`;
      }
    } catch (error) {
      console.warn('[Terminal] Failed to get backend port, using default');
    }
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
}

export default function TerminalPanel({ projectName, onClose }: TerminalPanelProps) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [showViewsMenu, setShowViewsMenu] = useState(false);

  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const createNewTerminal = async () => {
    if (!terminalContainerRef.current) return;

    const terminalId = `terminal-${Date.now()}`;
    const terminalName = `PowerShell ${terminals.length + 1}`;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#888888',
        magenta: '#bc3fbc',
        cyan: '#888888',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#aaaaaa',
        brightMagenta: '#d670d6',
        brightCyan: '#aaaaaa',
        brightWhite: '#e5e5e5'
      },
      convertEol: true
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const terminalDiv = document.createElement('div');
    terminalDiv.style.width = '100%';
    terminalDiv.style.height = '100%';
    terminalDiv.style.display = 'none';
    terminalDiv.id = terminalId;
    terminalContainerRef.current.appendChild(terminalDiv);

    terminal.open(terminalDiv);
    setTimeout(() => fitAddon.fit(), 50);

    const backendUrl = await getBackendUrl();
    const ws = new WebSocket(`${backendUrl}/ws/terminal/${projectName}`);

    ws.onopen = () => {
      terminal.writeln('\x1b[32mTerminal connected.\x1b[0m');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output') {
          terminal.write(message.data);
        } else if (message.type === 'error') {
          terminal.writeln(`\r\n\x1b[31mError: ${message.data}\x1b[0m`);
        }
      } catch {
        terminal.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      terminal.writeln('\r\n\x1b[31mWebSocket connection error\x1b[0m');
    };

    ws.onclose = () => {
      terminal.writeln('\r\n\x1b[33mTerminal disconnected\x1b[0m');
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    const newTerminal: TerminalInstance = {
      id: terminalId,
      name: terminalName,
      terminal,
      fitAddon,
      ws
    };

    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(terminalId);
  };

  const closeTerminal = (terminalId: string) => {
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      terminal.ws.close();
      terminal.terminal.dispose();
      const elem = document.getElementById(terminalId);
      if (elem) elem.remove();

      const remaining = terminals.filter(t => t.id !== terminalId);
      setTerminals(remaining);

      if (activeTerminalId === terminalId && remaining.length > 0) {
        setActiveTerminalId(remaining[0].id);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (terminals.length === 0) {
      // Defer terminal creation slightly to avoid mount-flash on rapid route switches
      const timer = setTimeout(() => {
        if (!cancelled) createNewTerminal();
      }, 100);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      terminals.forEach(t => {
        try { t.ws.close(); } catch {}
        try { t.terminal.dispose(); } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    terminals.forEach(t => {
      const elem = document.getElementById(t.id);
      if (elem) {
        elem.style.display = t.id === activeTerminalId ? 'block' : 'none';
      }
    });
  }, [activeTerminalId, terminals]);



  return (
    <div className="h-full bg-[#1e1e1e] border-t border-border flex flex-col">
      <div className="flex items-center bg-sidebar border-b border-border">
        <div className="flex items-center gap-1 px-2 flex-1 min-w-0 overflow-x-auto">
          {terminals.length > 0 ? (
            terminals.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer ${
                  activeTerminalId === t.id ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5'
                }`}
                onClick={() => setActiveTerminalId(t.id)}
              >
                <TerminalIcon className="w-3 h-3" />
                <span>{t.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(t.id);
                  }}
                  className="hover:text-white"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground px-2">Starting terminal…</span>
          )}
        </div>

        <div className="flex items-center gap-1 px-2">
          <button
            onClick={createNewTerminal}
            className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
            title="New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
            title="Maximize"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowViewsMenu(!showViewsMenu)}
              className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
              title="Views and More Actions"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showViewsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowViewsMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[#2d2d2d] border border-border rounded shadow-lg z-20 min-w-[180px] text-xs">
                  <button className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-white">Clear</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-white">Split Terminal</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-white">Scroll to Top</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-white">Scroll to Bottom</button>
                </div>
              </>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
        <div ref={terminalContainerRef} className="h-full w-full bg-[#1e1e1e]" />
      </div>
    </div>
  );
}
