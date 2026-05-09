import { Plus, X } from "lucide-react";
import { Terminal } from "@/services/TerminalManager";

interface TerminalTabsProps {
  terminals: Terminal[];
  activeTerminalId: string | null;
  onTabClick: (terminalId: string) => void;
  onTabClose: (terminalId: string) => void;
  onNewTerminal: () => void;
}

export default function TerminalTabs({
  terminals,
  activeTerminalId,
  onTabClick,
  onTabClose,
  onNewTerminal
}: TerminalTabsProps) {
  return (
    <div className="flex items-center bg-sidebar border-b border-border h-[30px] px-2 gap-1">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-thin">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            onClick={() => onTabClick(terminal.id)}
            className={`
              flex items-center gap-2 px-2 py-1 rounded text-[11px] cursor-pointer
              transition-colors select-none min-w-max
              ${activeTerminalId === terminal.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <span>{terminal.name}</span>
            {terminals.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(terminal.id);
                }}
                className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <button
        onClick={onNewTerminal}
        className="flex items-center justify-center p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        title="New Terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
