import { useState } from "react";
import { FileCode, Terminal, Globe, Brain, Check, X, ChevronDown, ChevronUp, Camera, Key, GitCommit, Hammer } from "lucide-react";
import type { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage;
  isSelfUpgrade?: boolean;
}

export function ApprovalCard({ message, isSelfUpgrade }: Props) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [showDiff, setShowDiff] = useState(false);
  const { approvalType, approvalData } = message;

  const iconMap: Record<string, any> = {
    file_edit: FileCode,
    command: Terminal,
    fetch: Globe,
    memory_update: Brain,
    snapshot: Camera,
    secret: Key,
    commit: GitCommit,
    scaffold: Hammer,
  };
  const Icon = iconMap[approvalType!] || FileCode;

  const labelMap: Record<string, string> = {
    file_edit: "File Edit Request",
    command: "Command Execution",
    fetch: "External Fetch",
    memory_update: "Memory Update",
    snapshot: "Snapshot Action",
    secret: "Secret Change",
    commit: "Git Commit",
    scaffold: "Scaffold Action",
  };

  const borderClass = status === "approved"
    ? "border-success/30"
    : status === "rejected"
      ? "border-destructive/30"
      : isSelfUpgrade
        ? "border-warning/25"
        : "border-border";

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
        isSelfUpgrade ? "bg-warning/15 text-warning" : "bg-secondary text-foreground"
      }`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className={`flex-1 max-w-[80%] rounded-xl border ${borderClass} bg-card p-4 transition-colors`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            isSelfUpgrade ? "text-warning" : "text-muted-foreground"
          }`}>
            {labelMap[approvalType!] || "Approval Required"}
          </span>
          {status !== "pending" && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
              {status === "approved" ? "Approved" : "Rejected"}
            </span>
          )}
        </div>

        <p className="text-[13px] text-foreground mb-3">{message.content}</p>

        {approvalType === "file_edit" && approvalData?.files && (
          <div className="space-y-1 mb-3">
            {approvalData.files.map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[12px] bg-surface rounded-lg px-3 py-2">
                <FileCode className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-foreground flex-1 truncate">{f.path}</span>
                <span className={`font-medium text-[10px] ${f.action === "create" ? "text-success" : "text-info"}`}>
                  {f.action}
                </span>
                <span className="text-success text-[10px]">+{f.additions}</span>
                {f.deletions > 0 && <span className="text-destructive text-[10px]">-{f.deletions}</span>}
              </div>
            ))}
            {approvalData.diff && (
              <button onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors">
                {showDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showDiff ? "Hide diff" : "Show diff preview"}
              </button>
            )}
            {showDiff && approvalData.diff && (
              <pre className="text-[11px] font-mono bg-surface rounded-lg p-3 mt-1 overflow-x-auto text-muted-foreground whitespace-pre-wrap">
                {approvalData.diff}
              </pre>
            )}
          </div>
        )}

        {approvalType === "command" && approvalData?.command && (
          <div className="bg-surface rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <Terminal className="w-3 h-3 text-muted-foreground" />
            <code className="text-[12px] font-mono text-foreground">{approvalData.command}</code>
          </div>
        )}

        {approvalType === "memory_update" && approvalData && (
          <div className="bg-surface rounded-lg px-3 py-2 mb-3 space-y-1">
            <div className="text-[12px]"><span className="text-muted-foreground">Key:</span> <span className="font-mono text-foreground">{approvalData.key}</span></div>
            <div className="text-[12px]"><span className="text-muted-foreground">Value:</span> <span className="text-foreground">{approvalData.value}</span></div>
          </div>
        )}

        {approvalType === "commit" && approvalData && (
          <div className="bg-surface rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <GitCommit className="w-3 h-3 text-muted-foreground" />
            <span className="text-[12px] font-mono text-foreground">{approvalData.message || "Commit changes"}</span>
          </div>
        )}

        {approvalType === "snapshot" && approvalData && (
          <div className="bg-surface rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
            <Camera className="w-3 h-3 text-muted-foreground" />
            <span className="text-[12px] text-foreground">{approvalData.note || "Create snapshot"}</span>
          </div>
        )}

        {status === "pending" && (
          <div className="flex gap-2">
            <button onClick={() => setStatus("approved")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-[12px] font-medium transition-colors">
              <Check className="w-3 h-3" /> Approve
            </button>
            <button onClick={() => setStatus("rejected")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-[12px] font-medium transition-colors">
              <X className="w-3 h-3" /> Reject
            </button>
          </div>
        )}

        <span className="text-[10px] text-muted-foreground mt-2 block">{message.timestamp}</span>
      </div>
    </div>
  );
}
