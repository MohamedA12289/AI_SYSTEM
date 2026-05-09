export interface Terminal {
  id: string;
  name: string;
  cwd: string;
}

class TerminalManagerImpl {
  private terminals: Terminal[] = [];
  private activeTerminalId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    const defaultTerminal: Terminal = {
      id: 'terminal-1',
      name: 'Terminal 1',
      cwd: ''
    };
    this.terminals = [defaultTerminal];
    this.activeTerminalId = 'terminal-1';
  }

  getTerminals(): Terminal[] {
    return [...this.terminals];
  }

  getActiveTerminal(): Terminal | null {
    if (!this.activeTerminalId) return null;
    return this.terminals.find(t => t.id === this.activeTerminalId) || null;
  }

  getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  setActiveTerminal(terminalId: string): void {
    const terminal = this.terminals.find(t => t.id === terminalId);
    if (terminal) {
      this.activeTerminalId = terminalId;
      this.notifyListeners();
    }
  }

  createTerminal(name?: string, cwd?: string): string {
    const newId = `terminal-${Date.now()}`;
    const newTerminal: Terminal = {
      id: newId,
      name: name || `Terminal ${this.terminals.length + 1}`,
      cwd: cwd || ''
    };

    this.terminals.push(newTerminal);
    this.activeTerminalId = newId;
    this.notifyListeners();

    return newId;
  }

  closeTerminal(terminalId: string): void {
    if (this.terminals.length === 1) return;

    const index = this.terminals.findIndex(t => t.id === terminalId);
    if (index === -1) return;

    this.terminals.splice(index, 1);

    if (this.activeTerminalId === terminalId) {
      this.activeTerminalId = this.terminals[Math.min(index, this.terminals.length - 1)]?.id || null;
    }

    this.notifyListeners();
  }

  renameTerminal(terminalId: string, newName: string): void {
    const terminal = this.terminals.find(t => t.id === terminalId);
    if (terminal) {
      terminal.name = newName;
      this.notifyListeners();
    }
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }
}

export const TerminalManager = new TerminalManagerImpl();
