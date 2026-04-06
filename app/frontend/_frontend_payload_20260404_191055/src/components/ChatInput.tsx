import { useState, useRef } from "react";
import { Send, Plus, Square, Mic, MicOff, FileText, Image, FolderOpen, FileArchive, Link, Tag, Hammer, Play, ChevronDown } from "lucide-react";
import type { AssistantMode } from "@/types";

interface Props {
  placeholder?: string;
  onSend?: (msg: string) => void;
  isGenerating?: boolean;
  assistantMode?: AssistantMode;
  onModeChange?: (mode: AssistantMode) => void;
}

const attachmentTypes = [
  { icon: FileText, label: "Document", tag: "docs", color: "text-blue-400" },
  { icon: Image, label: "Image", tag: "images", color: "text-emerald-400" },
  { icon: FolderOpen, label: "Folder", tag: "folder", color: "text-amber-400" },
  { icon: FileArchive, label: "ZIP Archive", tag: "archive", color: "text-purple-400" },
  { icon: Link, label: "Link / URL", tag: "link", color: "text-cyan-400" },
  { icon: Tag, label: "Tagged File", tag: "tagged", color: "text-rose-400" },
];

export function ChatInput({ placeholder = "Type a message...", onSend, isGenerating, assistantMode, onModeChange }: Props) {
  const [value, setValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (value.trim()) {
      onSend?.(value.trim());
      setValue("");
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto relative">
        {/* Attachment button */}
        <div className="relative" ref={attachRef}>
          <button
            onClick={() => { setAttachOpen(!attachOpen); setModeOpen(false); }}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              attachOpen
                ? "bg-secondary text-foreground"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform duration-200 ${attachOpen ? "rotate-45" : ""}`} />
          </button>

          {attachOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-scale-in origin-bottom-left z-50">
              <div className="p-2 min-w-[200px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 block">
                  Attach
                </span>
                <div className="mt-1 space-y-0.5">
                  {attachmentTypes.map((type) => (
                    <button
                      key={type.tag}
                      onClick={() => setAttachOpen(false)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-foreground hover:bg-secondary/70 transition-colors"
                    >
                      <type.icon className={`w-3.5 h-3.5 ${type.color}`} />
                      <span>{type.label}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md font-mono">
                        {type.tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-lg bg-surface border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 transition-all"
        />

        {/* Build/Plan mode dropdown — between textarea and mic */}
        {assistantMode && onModeChange && (
          <div className="relative" ref={modeRef}>
            <button
              onClick={() => { setModeOpen(!modeOpen); setAttachOpen(false); }}
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-2 rounded-lg text-[11px] font-medium transition-all ${
                assistantMode === "build"
                  ? "bg-foreground/10 text-foreground hover:bg-foreground/15"
                  : "bg-info/10 text-info hover:bg-info/15"
              }`}
            >
              {assistantMode === "build" ? <Hammer className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{assistantMode === "build" ? "Build" : "Plan"}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${modeOpen ? "rotate-180" : ""}`} />
            </button>

            {modeOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-scale-in origin-bottom-right z-50 min-w-[200px]">
                <div className="p-1.5">
                  <button
                    onClick={() => { onModeChange("build"); setModeOpen(false); }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      assistantMode === "build" ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <Hammer className="w-4 h-4 text-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Build Mode</p>
                      <p className="text-[10px] text-muted-foreground">Plan, analyze, and execute actions</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { onModeChange("plan"); setModeOpen(false); }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      assistantMode === "plan" ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <Play className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Plan Mode</p>
                      <p className="text-[10px] text-muted-foreground">Analyze and plan only — no execution</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mic button */}
        <button
          onClick={toggleRecording}
          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
            isRecording
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "hover:bg-secondary text-muted-foreground hover:text-foreground"
          }`}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send / Stop */}
        {isGenerating ? (
          <button className="flex-shrink-0 p-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-all">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="flex-shrink-0 p-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
