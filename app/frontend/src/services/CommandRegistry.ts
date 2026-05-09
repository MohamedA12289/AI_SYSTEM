export interface Command {
  id: string;
  label: string;
  category?: string;
  keybinding?: string;
  when?: () => boolean;
  handler: () => void | Promise<void>;
}

class CommandRegistryImpl {
  private commands = new Map<string, Command>();
  private listeners: Array<() => void> = [];

  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notifyListeners();
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
    this.notifyListeners();
  }

  execute(commandId: string): void {
    const command = this.commands.get(commandId);
    if (!command) {
      console.warn(`Command not found: ${commandId}`);
      return;
    }

    if (command.when && !command.when()) {
      console.log(`Command ${commandId} is disabled by when clause`);
      return;
    }

    command.handler();
  }

  getAll(): Command[] {
    return Array.from(this.commands.values()).filter(cmd => {
      if (cmd.when) {
        return cmd.when();
      }
      return true;
    });
  }

  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  search(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    const commands = this.getAll();

    return commands
      .filter(cmd => {
        const searchText = `${cmd.category || ''} ${cmd.label}`.toLowerCase();
        return searchText.includes(lowerQuery) || this.fuzzyMatch(lowerQuery, searchText);
      })
      .sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aStartsWith = aLabel.startsWith(lowerQuery);
        const bStartsWith = bLabel.startsWith(lowerQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return aLabel.localeCompare(bLabel);
      });
  }

  private fuzzyMatch(query: string, text: string): boolean {
    let queryIndex = 0;
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === query.length;
  }

  onChange(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const CommandRegistry = new CommandRegistryImpl();
