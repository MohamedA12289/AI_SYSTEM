import { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu, Check } from "lucide-react";
import { useActiveModel } from "@/hooks/useActiveModel";

interface Props {
  className?: string;
  compact?: boolean;
}

export function ModelSelector({ className = "", compact = false }: Props) {
  const { models, activeModel, loading, switchModel } = useActiveModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayName = activeModel
    ? activeModel.split("/").pop()?.split(":")[0] ?? activeModel
    : loading ? "Loading..." : "No model";

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-colors text-foreground ${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"}`}
        title="Switch AI model"
      >
        <Cpu className={compact ? "w-3 h-3 text-muted-foreground" : "w-3.5 h-3.5 text-muted-foreground"} />
        <span className="truncate max-w-[140px] font-medium">{displayName}</span>
        <ChevronDown className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""} ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-64 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-scale-in origin-bottom-left">
          <div className="p-1.5">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI Model</div>
            {models.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-muted-foreground text-center">
                {loading ? "Loading models…" : "No models available. Check Settings → AI."}
              </div>
            )}
            <div className="max-h-60 overflow-y-auto scrollbar-thin mt-1 space-y-0.5">
              {models.map((m) => {
                const label = m.split("/").pop()?.split(":")[0] ?? m;
                const isActive = m === activeModel;
                return (
                  <button
                    key={m}
                    onClick={() => { switchModel(m); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] transition-colors text-left ${isActive ? "bg-secondary text-foreground font-medium" : "text-foreground hover:bg-secondary/70"}`}
                  >
                    <span className="flex-1 truncate">{label}</span>
                    {isActive && <Check className="w-3 h-3 text-foreground flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
