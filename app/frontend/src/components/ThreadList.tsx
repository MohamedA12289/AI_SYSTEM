import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ThreadItem } from "./ThreadItem";
import { api } from "@/services/api";
import type { Thread } from "@/types";

interface ThreadListProps {
  projectId: string;
}

export function ThreadList({ projectId }: ThreadListProps) {
  const navigate = useNavigate();
  const { threadId: activeThreadId } = useParams();
  const [isOpen, setIsOpen] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ["threads", projectId],
    queryFn: async () => {
      const response = await api.threads.list(projectId);
      return response.threads || [];
    },
    enabled: !!projectId,
  });

  const threads: Thread[] = data || [];

  const handleCreateThread = async () => {
    try {
      const result = await api.threads.create(projectId);
      navigate(`/project/${projectId}/thread/${result.thread.id}`);
    } catch (err) {
      console.error("Failed to create thread:", err);
    }
  };

  return (
    <div className="pt-3">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground px-2.5 py-1"
      >
        <span>Threads</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>
      {isOpen && (
        <div className="mt-1 space-y-0.5">
          <button
            onClick={handleCreateThread}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <Plus className="w-3.5 h-3.5" />
            New Thread
          </button>
          {isLoading && (
            <div className="px-2.5 py-2 text-[12px] text-muted-foreground">Loading threads...</div>
          )}
          {error && (
            <div className="px-2.5 py-2 text-[12px] text-destructive">Failed to load threads</div>
          )}
          {threads.length === 0 && !isLoading && !error && (
            <div className="px-2.5 py-2 text-[12px] text-muted-foreground">No threads yet</div>
          )}
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => navigate(`/project/${projectId}/thread/${thread.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
