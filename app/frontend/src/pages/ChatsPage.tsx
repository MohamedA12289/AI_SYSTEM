import { useEffect, useRef, useState } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ModelSelector } from "@/components/ModelSelector";
import { getApiBase } from "@/services/api";
import type { ChatMessage as ChatMessageType } from "@/types";

const STORAGE_KEY = "cubos_standalone_chats";

function loadMessages(): ChatMessageType[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessageType[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-200)));
  } catch {}
}

export default function ChatsPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>(loadMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (content: string) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessageType = { id: `u-${Date.now()}`, role: "user", content, timestamp: now };
    const streamId = `a-${Date.now()}`;
    const assistantMsg: ChatMessageType = { id: streamId, role: "assistant", content: "▋", timestamp: now };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const base = getApiBase();
    const ctrl = new AbortController();
    cancelRef.current = () => ctrl.abort();

    fetch(`${base}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: "self_upgrade", prompt: content }),
      signal: ctrl.signal,
    }).then(async (res) => {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setIsStreaming(false); return; }
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            setIsStreaming(false);
            cancelRef.current = null;
            return;
          }
          try {
            const obj = JSON.parse(data);
            if (obj.token) {
              setMessages((prev) => prev.map((m) =>
                m.id === streamId ? { ...m, content: (m.content === "▋" ? "" : m.content) + obj.token } : m
              ));
            }
            if (obj.error) {
              setMessages((prev) => prev.map((m) =>
                m.id === streamId ? { ...m, content: obj.error } : m
              ));
              setIsStreaming(false);
              return;
            }
          } catch {}
        }
      }
      setIsStreaming(false);
    }).catch((err) => {
      if (err?.name !== "AbortError") {
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: String(err?.message || "Request failed.") } : m
        ));
      }
      setIsStreaming(false);
      cancelRef.current = null;
    });
  };

  const handleStop = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setIsStreaming(false);
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Chats</span>
          {messages.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
              {messages.filter(m => m.role === "user").length} messages
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector compact />
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Start a conversation</p>
              <p className="text-[12px] text-muted-foreground mt-1">Chat with your local AI model without a project workspace</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {["Explain this code", "Write a function", "Debug my error", "Help me plan"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-[11px] px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2">
        <ChatInput
          onSend={handleSend}
          isGenerating={isStreaming}
          onStop={handleStop}
          placeholder="Message CubOS…"
        />
      </div>
    </div>
  );
}