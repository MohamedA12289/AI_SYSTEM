import { useState, useEffect, useRef } from "react";
import { Command as LucideCommand, X } from "lucide-react";
import { CommandRegistry, Command } from "@/services/CommandRegistry";
import { KeybindingRegistry } from "@/services/KeybindingRegistry";

interface CommandPaletteProps {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    updateCommands("");
  }, []);

  const updateCommands = (searchQuery: string) => {
    if (searchQuery.trim()) {
      setCommands(CommandRegistry.search(searchQuery));
    } else {
      setCommands(CommandRegistry.getAll().slice(0, 20));
    }
    setSelectedIndex(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    updateCommands(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (commands[selectedIndex]) {
        CommandRegistry.execute(commands[selectedIndex].id);
        onClose();
      }
    }
  };

  const handleCommandClick = (command: Command) => {
    CommandRegistry.execute(command.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <LucideCommand className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {commands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            <div className="py-1">
              {commands.map((command, index) => {
                const keybinding = KeybindingRegistry.getForCommand(command.id);
                return (
                  <div
                    key={command.id}
                    onClick={() => handleCommandClick(command)}
                    className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="text-sm">
                        {command.category && (
                          <span className="text-muted-foreground mr-2">
                            {command.category}:
                          </span>
                        )}
                        <span>{command.label}</span>
                      </div>
                    </div>
                    {keybinding && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {KeybindingRegistry.formatKey(keybinding)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
