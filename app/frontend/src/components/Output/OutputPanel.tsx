import { useState, useRef, useEffect } from "react";
import { X, Copy, Trash2 } from "lucide-react";

export interface OutputEntry {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  type?: "stdout" | "stderr" | "info";
}

interface OutputPanelProps {
  entries: OutputEntry[];
  onClear?: () => void;
  autoScroll?: boolean;
}

export default function OutputPanel({ entries, onClear, autoScroll = true }: OutputPanelProps) {
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sources = Array.from(new Set(entries.map(e => e.source)));
  const filteredEntries = selectedSource === "all" 
    ? entries 
    : entries.filter(e => e.source === selectedSource);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleCopy = () => {
    const text = filteredEntries.map(e => `[${e.timestamp}] ${e.source}: ${e.content}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const getEntryColor = (type?: string) => {
    switch (type) {
      case "stderr":
        return "text-red-400";
      case "info":
        return "text-gray-400";
      default:
        return "text-foreground/90";
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Output
          </span>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="text-[10px] px-1.5 py-0.5 bg-surface border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
          >
            <option value="all">All Sources</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
            title="Copy Output"
          >
            <Copy className="w-3 h-3" />
          </button>
          {onClear && entries.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
              title="Clear Output"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1 font-mono">
        {filteredEntries.length === 0 && (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
            No output
          </div>
        )}
        {filteredEntries.map((entry) => (
          <div key={entry.id} className="text-[10px] py-0.5 hover:bg-accent/20">
            <span className="text-muted-foreground">[{entry.timestamp}]</span>
            <span className="text-muted-foreground ml-1">[{entry.source}]</span>
            <span className={`ml-1 ${getEntryColor(entry.type)}`}>{entry.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
