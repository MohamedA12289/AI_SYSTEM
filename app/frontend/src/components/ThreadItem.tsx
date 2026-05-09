import { MessageCircle, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Thread } from "@/types";

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onRename?: () => void;
}

export function ThreadItem({ thread, isActive, onClick, onDelete, onRename }: ThreadItemProps) {
  const timeAgo = formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true });

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors group ${
        isActive 
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
      }`}
    >
      <MessageCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="truncate text-left">{thread.title}</div>
        <div className="text-[10px] text-muted-foreground">
          {thread.message_count} msgs • {timeAgo}
        </div>
      </div>
      {(onDelete || onRename) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sidebar-accent transition-opacity"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      )}
    </button>
  );
}
