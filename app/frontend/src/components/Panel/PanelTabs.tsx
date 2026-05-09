import { Terminal, AlertCircle, FileOutput, X } from "lucide-react";

export type PanelType = "terminal" | "problems" | "output";

interface PanelTabsProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  onClose?: () => void;
  problemCount?: number;
  outputCount?: number;
}

export default function PanelTabs({ 
  activePanel, 
  onPanelChange, 
  onClose,
  problemCount = 0,
  outputCount = 0
}: PanelTabsProps) {
  const tabs = [
    { id: "terminal" as PanelType, label: "Terminal", icon: Terminal, count: undefined },
    { id: "problems" as PanelType, label: "Problems", icon: AlertCircle, count: problemCount },
    { id: "output" as PanelType, label: "Output", icon: FileOutput, count: outputCount }
  ];

  return (
    <div className="flex items-center justify-between h-8 px-2 bg-panel border-b border-border">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onPanelChange(tab.id)}
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors ${
              activePanel === tab.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-0.5 px-1 py-0.5 text-[9px] rounded ${
                activePanel === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
