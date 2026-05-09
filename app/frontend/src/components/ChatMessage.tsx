import { Bot, User, Brain, AlertTriangle, Terminal, Loader2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";
import { ApprovalCard } from "./ApprovalCard";
import { ToolResultCard } from "./ToolResultCard";

interface Props {
  message: ChatMessageType;
  isSelfUpgrade?: boolean;
  projectName?: string;
  onApprovalResolved?: () => void;
}

const richToolTypes = [
  "review_result", "plan_result", "refactor_result", "cowork_result",
  "research_result", "scaffold_result", "data_summary", "transcript_result",
  "voice_result", "analysis_result",
];

function cleanDisplayText(input?: string) {
  const text = String(input ?? "");
  return text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\[[0-9]+[A-Za-z]\](?:\[K\])?/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r/g, "")
    .trim();
}

function stripSystemPromptArtifacts(content: string): string {
  if (!content) return content;
  let text = content;

  // Pull out the user's own message if framed with [USER MESSAGE]:
  const userMsgMatch = text.match(/\[USER MESSAGE\]:\s*([\s\S]*?)(?:\n\n\[(?:AVAILABLE FILES IN PROJECT|Project File Contents|FILE CONTENT|CONTEXT|ATTACHED FILE)[\s\S]*)?$/);
  if (userMsgMatch) {
    text = userMsgMatch[1];
  }

  // Inline edit prompts: keep just the Instruction line.
  const inlineMatch = text.match(/\[INLINE EDIT REQUEST\][\s\S]*?Instruction:\s*([\s\S]*?)(?:\n\nReplace|\n\nRespond|$)/);
  if (inlineMatch) {
    text = `(inline edit) ${inlineMatch[1].trim()}`;
  }

  // Strip remaining bracketed system blocks and any code fences that follow them.
  text = text
    .replace(/\[CONTEXT:[^\]]*\][^\n]*\n?/g, "")
    .replace(/\[FILE CONTENT OF [^\]]+\]:[\s\S]*?```[\s\S]*?```\s*/g, "")
    .replace(/\[Project File Contents\][\s\S]*$/g, "")
    .replace(/\[AVAILABLE FILES IN PROJECT\]:[^\n]*\n?/g, "")
    .replace(/\[ATTACHED FILE:[^\]]+\]\s*/g, "")
    .replace(/^\s*\n+/, "")
    .replace(/\n{3,}/g, "\n\n");

  return text.trim() || content.trim();
}

export function ChatMessage({ message, isSelfUpgrade, projectName, onApprovalResolved }: Props) {
  const rawContent = cleanDisplayText(message.content);
  const displayContent = message.role === "user" ? stripSystemPromptArtifacts(rawContent) : rawContent;
  const safeMessage = { ...message, content: displayContent };

  if (safeMessage.role === "approval") {
    return <ApprovalCard message={safeMessage} isSelfUpgrade={isSelfUpgrade} projectName={projectName} onResolved={onApprovalResolved} />;
  }

  if (safeMessage.role === "tool" && safeMessage.toolType && richToolTypes.includes(safeMessage.toolType)) {
    return <ToolResultCard message={safeMessage} />;
  }

  const isUser = safeMessage.role === "user";
  const isPlanning = safeMessage.role === "planning";
  const isTool = safeMessage.role === "tool";
  const isStatus = safeMessage.role === "status";

  if (isTool) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-muted-foreground animate-fade-in">
        <Terminal className="w-3.5 h-3.5" />
        <span className="whitespace-pre-wrap break-words">{safeMessage.content}</span>
        <span className="ml-auto text-[10px]">{safeMessage.timestamp}</span>
      </div>
    );
  }

  if (isStatus) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground animate-fade-in">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{safeMessage.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
          isPlanning
            ? isSelfUpgrade ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
            : "bg-secondary text-foreground"
        }`}>
          {isPlanning ? (isSelfUpgrade ? <AlertTriangle className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />) : <Bot className="w-3.5 h-3.5" />}
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? "order-first" : ""}`}>
        {isPlanning && (
          <span className={`text-[10px] font-medium mb-1 block ${isSelfUpgrade ? "text-warning" : "text-muted-foreground"}`}>
            {isSelfUpgrade ? "Planning (Self-Upgrade)" : "Planning"}
          </span>
        )}
        <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-foreground text-background"
            : isPlanning
              ? isSelfUpgrade ? "bg-warning/5 border border-warning/15 text-foreground" : "bg-secondary/60 border border-border text-foreground"
              : "bg-card border border-border text-card-foreground"
        }`}>
          <pre className="whitespace-pre-wrap font-sans break-words">{safeMessage.content || "(empty)"}</pre>
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 block">{safeMessage.timestamp}</span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-secondary flex items-center justify-center mt-0.5">
          <User className="w-3.5 h-3.5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
