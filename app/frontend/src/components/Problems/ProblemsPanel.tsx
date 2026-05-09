import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, X, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";

export type ProblemSeverity = "error" | "warning" | "info";

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  source: string;
  file: string;
  line: number;
  column: number;
  code?: string;
}

interface ProblemsPanelProps {
  problems: Problem[];
  onProblemClick?: (problem: Problem) => void;
  onClear?: () => void;
  onRefresh?: () => void;
}

export default function ProblemsPanel({ problems, onProblemClick, onClear, onRefresh }: ProblemsPanelProps) {
  const [filter, setFilter] = useState<ProblemSeverity | "all">("all");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const filteredProblems = filter === "all" 
    ? problems 
    : problems.filter(p => p.severity === filter);

  const groupedProblems: Record<string, Problem[]> = {};
  filteredProblems.forEach(problem => {
    if (!groupedProblems[problem.file]) {
      groupedProblems[problem.file] = [];
    }
    groupedProblems[problem.file].push(problem);
  });

  const errorCount = problems.filter(p => p.severity === "error").length;
  const warningCount = problems.filter(p => p.severity === "warning").length;
  const infoCount = problems.filter(p => p.severity === "info").length;

  const toggleFileExpanded = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  const getSeverityIcon = (severity: ProblemSeverity) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />;
      case "info":
        return <Info className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              filter === "all" ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            All ({problems.length})
          </button>
          <button
            onClick={() => setFilter("error")}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
              filter === "error" ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <AlertCircle className="w-3 h-3 text-red-500" />
            {errorCount}
          </button>
          <button
            onClick={() => setFilter("warning")}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
              filter === "warning" ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
            {warningCount}
          </button>
          <button
            onClick={() => setFilter("info")}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
              filter === "info" ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <Info className="w-3 h-3 text-gray-500" />
            {infoCount}
          </button>
        </div>
        {onClear && problems.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent/50 flex items-center gap-1"
            title="Clear All"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-accent/50 flex items-center gap-1"
            title="Refresh diagnostics"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredProblems.length === 0 && (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
            No problems detected
          </div>
        )}

        {Object.entries(groupedProblems).map(([file, fileProblems]) => {
          const isExpanded = expandedFiles.has(file);
          return (
            <div key={file}>
              <div
                onClick={() => toggleFileExpanded(file)}
                className="flex items-center gap-1 py-1 px-2 hover:bg-accent/50 cursor-pointer border-b border-border/50"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-[11px] text-foreground font-medium truncate">{file}</span>
                <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
                  {fileProblems.length}
                </span>
              </div>

              {isExpanded && (
                <div className="bg-surface/50">
                  {fileProblems.map((problem) => (
                    <div
                      key={problem.id}
                      onClick={() => onProblemClick?.(problem)}
                      className="flex items-start gap-2 py-1.5 px-3 hover:bg-accent/30 cursor-pointer border-b border-border/30"
                    >
                      {getSeverityIcon(problem.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-foreground">
                          {problem.message}
                          {problem.code && (
                            <span className="ml-1 text-muted-foreground">({problem.code})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          [{problem.line}:{problem.column}] {problem.source}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
