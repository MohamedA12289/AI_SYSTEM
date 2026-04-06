export type AssistantMode = "build" | "plan";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "todo";

export interface Project {
  project_name: string;
  display_name: string;
  description: string;
  project_type?: string;
  workspace_root: string;
  memory_root?: string;
  scope_root?: string;
  archived?: boolean;
  created_at?: string;
}

export type MessageRole = "user" | "assistant" | "system" | "planning" | "approval" | "tool" | "status";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  approvalId?: string;
  approvalType?: string;
  approvalData?: Record<string, any>;
  toolType?: string;
  toolData?: Record<string, any>;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  group: "today" | "yesterday" | "older";
  projectId?: string;
}

export interface ProjectFile {
  name: string;
  path: string;
  type: string;
  size?: number | null;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  pinned?: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  created_at?: string;
}

export interface Note {
  id: string;
  content: string;
  created_at?: string;
}

export interface Secret {
  key: string;
  value: string;
}

export interface Snapshot {
  id: string;
  note?: string;
  created_at?: string;
  path?: string;
}

export interface Document {
  document_id: string;
  file_name: string;
  relative_path?: string;
  absolute_path?: string;
  extension?: string;
  access_mode?: string;
  indexed_at?: string;
  summary?: string | null;
  text_excerpt?: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  type: string;
  project_name?: string;
  metadata?: Record<string, any>;
}

export interface Approval {
  id: string;
  project_name: string;
  approval_type: string;
  status: ApprovalStatus;
  summary: string;
  payload: Record<string, any>;
  created_at: string;
  resolved_at?: string | null;
  resolution_note?: string;
}

export interface TestCase {
  id: string;
  title: string;
  command: string[];
  timeout_seconds?: number;
  created_at?: string;
}

export interface IngestJob {
  job_id: string;
  project_name: string;
  source_path: string;
  source_kind: string;
  access_mode: string;
  status: string;
  documents_indexed?: number;
  managed_root?: string;
  created_at?: string;
}

export interface AppSettings {
  approval_mode: {
    writes_require_approval: boolean;
    commands_require_approval: boolean;
  };
  models: {
    active_model: string;
  };
  assistant: {
    mode: AssistantMode;
  };
  ai_provider?: {
    active: "ollama" | "groq";
    groq_model?: string;
    fallback_to_ollama?: boolean;
  };
}

export interface DashboardSummary {
  project_name: string;
  path: string;
  rows: number;
  columns: number;
  column_names: string[];
  numeric_summary?: Record<string, any>;
  preview_rows?: any[];
  directory_snapshot?: ProjectFile[];
}

export interface SearchResult {
  kind: string;
  path: string;
  match: string;
}
