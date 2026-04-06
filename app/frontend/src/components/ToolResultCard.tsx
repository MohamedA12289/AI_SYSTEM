import {
  Search, ListTodo, Wand2, Star, FileText, Package,
  BarChart3, Mic, Terminal, FileCode, Camera, TestTube,
  Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage;
}

const toolIcons: Record<string, any> = {
  review_result: Search,
  plan_result: ListTodo,
  refactor_result: Wand2,
  cowork_result: Star,
  research_result: FileText,
  scaffold_result: Package,
  data_summary: BarChart3,
  transcript_result: Mic,
  voice_result: Mic,
  analysis_result: BarChart3,
  command_output: Terminal,
  file_change: FileCode,
  ingest: Package,
  snapshot: Camera,
  test_result: TestTube,
  search_result: Search,
  fetch_result: Globe,
};

const toolLabels: Record<string, string> = {
  review_result: "Code Review",
  plan_result: "Implementation Plan",
  refactor_result: "Refactor Preview",
  cowork_result: "Cowork Instructions",
  research_result: "Deep Research Report",
  scaffold_result: "Scaffold Result",
  data_summary: "Data Summary",
  transcript_result: "Transcript",
  voice_result: "Voice Response",
  analysis_result: "Workspace Analysis",
  command_output: "Command Output",
  file_change: "File Change",
  ingest: "Document Ingested",
  snapshot: "Snapshot Created",
  test_result: "Test Result",
  search_result: "Search Results",
  fetch_result: "Fetched Content",
};

export function ToolResultCard({ message }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { toolType, toolData } = message;
  const Icon = toolIcons[toolType!] || FileText;
  const label = toolLabels[toolType!] || "Tool Result";

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-secondary flex items-center justify-center mt-0.5">
        <Icon className="w-3.5 h-3.5 text-foreground" />
      </div>
      <div className="flex-1 max-w-[80%] rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-4 pb-3 space-y-2">
            {/* Review result */}
            {toolType === "review_result" && toolData && (
              <div className="space-y-2">
                {toolData.correctness?.length > 0 && <ResultSection title="Correctness" items={toolData.correctness} color="text-destructive" />}
                {toolData.maintainability?.length > 0 && <ResultSection title="Maintainability" items={toolData.maintainability} color="text-warning" />}
                {toolData.bugs?.length > 0 && <ResultSection title="Likely Bugs" items={toolData.bugs} color="text-destructive" />}
                {toolData.next_fixes?.length > 0 && <ResultSection title="Suggested Fixes" items={toolData.next_fixes} color="text-success" />}
              </div>
            )}

            {/* Plan result */}
            {toolType === "plan_result" && toolData && (
              <div className="space-y-2">
                {toolData.files_to_change?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Files to Change</p>
                    {toolData.files_to_change.map((f: string, i: number) => (
                      <p key={i} className="text-[11px] font-mono text-foreground">• {f}</p>
                    ))}
                  </div>
                )}
                {toolData.steps?.length > 0 && <ResultSection title="Steps" items={toolData.steps} color="text-foreground" />}
                {toolData.risks?.length > 0 && <ResultSection title="Risks" items={toolData.risks} color="text-warning" />}
                {toolData.recommendation && (
                  <div className="bg-surface rounded-lg px-3 py-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Recommendation</p>
                    <p className="text-[11px] text-foreground">{toolData.recommendation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Refactor preview */}
            {toolType === "refactor_result" && toolData && (
              <div className="space-y-2">
                {toolData.summary && <p className="text-[11px] text-foreground">{toolData.summary}</p>}
                {toolData.changes?.length > 0 && <ResultSection title="Changes" items={toolData.changes} color="text-info" />}
                {toolData.reasons?.length > 0 && <ResultSection title="Reasons" items={toolData.reasons} color="text-muted-foreground" />}
              </div>
            )}

            {/* Research report */}
            {toolType === "research_result" && toolData && (
              <div className="space-y-2">
                {toolData.title && <p className="text-[12px] font-medium text-foreground">{toolData.title}</p>}
                {toolData.sections?.map((s: any, i: number) => (
                  <div key={i}>
                    <p className="text-[10px] font-medium text-muted-foreground">{s.heading}</p>
                    <p className="text-[11px] text-foreground">{s.content}</p>
                  </div>
                ))}
                {toolData.sources?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Sources</p>
                    {toolData.sources.map((src: any, i: number) => (
                      <p key={i} className="text-[10px] text-info truncate">• {src.title || src.url}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scaffold result */}
            {toolType === "scaffold_result" && toolData && (
              <div className="space-y-1">
                <p className="text-[11px] text-foreground">Target: <span className="font-mono">{toolData.target_dir}</span></p>
                {toolData.created_files?.map((f: string, i: number) => (
                  <p key={i} className="text-[10px] font-mono text-success">+ {f}</p>
                ))}
              </div>
            )}

            {/* Transcript */}
            {toolType === "transcript_result" && toolData && (
              <div className="space-y-1">
                <p className="text-[11px] text-foreground">{toolData.text}</p>
                <div className="flex gap-3 text-[9px] text-muted-foreground">
                  <span>Language: {toolData.language}</span>
                  <span>Model: {toolData.model}</span>
                </div>
              </div>
            )}

            {/* Data summary */}
            {toolType === "data_summary" && toolData && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  {toolData.rows != null && <Stat label="Rows" value={toolData.rows} />}
                  {toolData.columns != null && <Stat label="Columns" value={toolData.columns} />}
                </div>
                {toolData.column_names && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Columns</p>
                    <p className="text-[10px] font-mono text-foreground">{toolData.column_names.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Generic fallback */}
            {!["review_result", "plan_result", "refactor_result", "research_result", "scaffold_result", "transcript_result", "data_summary"].includes(toolType!) && (
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap">{message.content}</pre>
            )}
          </div>
        )}

        <div className="px-4 py-1.5 border-t border-border">
          <span className="text-[9px] text-muted-foreground">{message.timestamp}</span>
        </div>
      </div>
    </div>
  );
}

function ResultSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{title}</p>
      {items.map((item, i) => (
        <p key={i} className={`text-[11px] ${color}`}>• {item}</p>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-surface rounded-lg px-2.5 py-1.5 text-center">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
