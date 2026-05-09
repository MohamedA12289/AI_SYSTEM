# CubOS Redesign — Final Implementation Roadmap (REFINED)

**Status**: Planning complete — ready for implementation
**Structure**: 3 coding gos + 1 packaging go
**Backend**: FastAPI + file-based storage (JSONL, JSON)
**Frontend**: React 18 + TypeScript + Vite + Electron + HashRouter
**Frontend Direction**: New frontend design is source of truth — build toward new design, not preserve old patterns

---

## Executive Summary

This redesign transforms CubOS into a ChatGPT-like multi-threaded conversation system with a robust VS Code-style Code Mode. The implementation is organized into 3 major coding gos plus a 4th packaging/stabilization go.

**CRITICAL**: The **new frontend design is the source of truth** for UI/UX direction. During implementation:
- Build toward the new frontend architecture and patterns
- Preserve old frontend components only when necessary for boot/integration during transition
- Do NOT lock deeper into old shell/layout/component assumptions
- Frontend work in Go 1 and beyond should align with new frontend direction

### Key Changes

1. **Multi-thread system** — ChatGPT-style threading (one project = many threads)
2. **Enhanced Code Mode** — folder-aware (VS Code feel) + project-aware (CubOS brain)
3. **Simplified UX** — remove visible Plan/Build mode, natural conversation
4. **Real terminal** — persistent PTY session, not just command runner
5. **Full git workflow** — two-way sync via system git (commit/push/pull/branch)
6. **Data migration** — preserve existing conversations (migrate to thread model)

---

## Current Architecture Audit

### Backend (FastAPI)
- **Framework**: FastAPI + Uvicorn
- **Storage**: File-based (JSONL for messages, JSON for projects/tasks/memory)
- **Key Files**:
  - `main.py` — FastAPI app, routes, endpoints
  - `server.py` — Uvicorn launcher
  - `chat_store.py` — message storage (JSONL append-only)
  - `project_registry.py` — project CRUD (JSON)
  - `memory.py` — tasks, notes, memory entries (JSON)
  - `config.py` — paths, settings
  - Routers: `wave1_router.py`, `wave2_routes.py`, `wave34_routes.py`, `hotfix_routes.py`, `code_agent_routes.py`, `advanced_routes.py`

### Storage Structure
```
AI_SYSTEM_BASE_PATH/
├── configs/
│   └── projects_registry.json          # All projects
├── memory/projects/{project_name}/
│   ├── messages.jsonl                  # One JSON per line
│   ├── chat.txt                        # Legacy format
│   ├── summary.json
│   ├── tasks.json
│   ├── notes.json
│   └── memory.json
└── workspaces/{project_name}/          # User files
```

### Frontend (React + Electron)
- **Pages**: `HomePage`, `ProjectWorkspacePage` (chat), `CodeModePage`, `SettingsPage`, `SelfUpgradePage`, `NewProjectPage`
- **Routing**: HashRouter (`/project/:projectId/chat`, `/project/:projectId/code`, `/self-upgrade/*`, `/settings`)
- **State**: Local state + React Query, no global state management yet
- **UI**: Radix UI + TailwindCSS + lucide-react icons

### Current Issues
1. **No thread support** — one conversation per project, all messages in single `messages.jsonl`
2. **Chat history sidebar** — shows recent messages across projects, not threads
3. **Plan/Build mode visible** — `AssistantMode` type, mode toggle in UI, affects AI behavior
4. **Code Mode incomplete** — no folder selection, no terminal, no git UI
5. **No migration strategy** — schema changes risk data loss

---

## Go 1: Thread System Foundation

**Goal**: Implement ChatGPT-style multi-thread support per project, migrate existing data, update Chat Mode UI.

### Backend Changes

#### 1. Thread Storage Model
**File**: `app/backend/chat_store.py` (major refactor)

**Current**:
- `messages.jsonl` — all messages for project in one file
- No thread concept

**New**:
- `threads.json` — thread metadata for project
- `threads/{thread_id}.jsonl` — messages for each thread

**New Storage Structure**:
```
memory/projects/{project_name}/
├── threads.json                # Thread list
├── threads/
│   ├── {thread_id}.jsonl       # Messages for thread
│   └── {thread_id}.jsonl
├── messages.jsonl              # Legacy (will migrate)
└── ...
```

**threads.json format**:
```json
{
  "threads": [
    {
      "thread_id": "uuid",
      "project_name": "proj",
      "title": "Auto-generated title",
      "created_at": "iso",
      "updated_at": "iso",
      "message_count": 12
    }
  ]
}
```

**Implementation**:
- Add `get_threads_path(project_name) -> Path` — returns `threads.json` path
- Add `get_thread_messages_path(project_name, thread_id) -> Path` — returns thread JSONL path
- Add `ensure_threads_store(project_name)` — creates `threads.json` and `threads/` dir
- Add `create_thread(project_name, title) -> dict` — creates new thread, returns thread object
- Add `list_threads(project_name) -> list[dict]` — reads `threads.json`, returns threads
- Add `get_thread(project_name, thread_id) -> dict` — gets single thread metadata
- Add `update_thread_title(project_name, thread_id, title)` — updates title in `threads.json`
- Add `delete_thread(project_name, thread_id)` — removes thread from list, deletes JSONL file
- Add `append_thread_message(project_name, thread_id, role, content, ...) -> dict` — appends to thread JSONL
- Add `read_thread_messages(project_name, thread_id) -> list[dict]` — reads thread JSONL
- Update message format to include `thread_id` field

**Lines affected**: ~150 lines of new code, refactor existing ~100 lines

#### 2. Auto-Title Generation
**File**: `app/backend/ai_client.py` (add function)

**Implementation**:
- Add `generate_thread_title(first_message_content: str) -> str`
- Use active AI provider (Ollama/Groq) to generate concise title (5-8 words)
- Prompt: "Generate a short title (5-8 words) for a conversation starting with: {first_message_content}"
- Fallback: truncate first message to 50 chars if AI fails
- Timeout: 5 seconds max

**Lines affected**: ~30 lines

#### 3. Thread API Endpoints
**File**: `app/backend/thread_routes.py` (new file)

**New Endpoints**:
```python
GET  /api/projects/{project_name}/threads          # List threads
POST /api/projects/{project_name}/threads          # Create thread (optional title)
GET  /api/threads/{thread_id}                      # Get thread (needs project context)
PUT  /api/threads/{thread_id}/title                # Update title
DELETE /api/threads/{thread_id}                    # Delete thread
GET  /api/threads/{thread_id}/messages             # Get messages (pagination)
POST /api/threads/{thread_id}/messages             # Send message
```

**Request/Response Models** (Pydantic):
```python
class ThreadCreateRequest(BaseModel):
    title: Optional[str] = None

class ThreadUpdateRequest(BaseModel):
    title: str

class ThreadMessageRequest(BaseModel):
    role: str
    content: str
```

**Implementation Notes**:
- Thread ID lookup requires reading `threads.json` from all projects (store project mapping in memory cache)
- Or: encode project_name in thread_id (e.g., `{project_name}_{uuid}`)
- Prefer encoded ID for simplicity: `thread_id = f"{project_name}_{uuid4()}"`, parse on lookup

**Lines affected**: ~200 lines

#### 4. Data Migration Script
**File**: `app/backend/migration_threads.py` (new file)

**Migration Logic**:
1. On backend startup, check if migration needed (flag in `configs/migration_status.json`)
2. For each project in `projects_registry.json`:
   - Check if `messages.jsonl` exists and `threads.json` doesn't
   - If yes: migrate
   - Read all messages from `messages.jsonl`
   - Create one thread with title from first user message (via `generate_thread_title`)
   - Write all messages to new thread JSONL with `thread_id` field added
   - Create `threads.json` with one thread entry
   - Backup old `messages.jsonl` to `messages.jsonl.backup`
3. Mark migration complete in `configs/migration_status.json`

**Backup Strategy**:
- Before migration, copy entire `memory/` to `memory_backup_{timestamp}/`
- Log migration steps to `logs/migration_threads.log`

**Error Handling**:
- If migration fails for a project, log error, skip that project, continue with others
- Provide manual migration command: `python migration_threads.py --project <name>`

**Lines affected**: ~150 lines

#### 5. Update Existing Chat Endpoints
**File**: `app/backend/main.py` (update existing endpoints)

**Changes**:
- Deprecate old `/api/chat` endpoint or update to require `thread_id`
- Update `/api/projects/{name}/messages` to redirect to thread-based endpoint
- Update any code that calls `append_message` to use `append_thread_message`

**Lines affected**: ~50 lines (minimal changes, mostly redirects)

### Frontend Changes

#### 1. Thread Types & API Client
**Files**: 
- `app/frontend/src/types/index.ts` (update)
- `app/frontend/src/services/api.ts` (update)

**Type Changes**:
```typescript
export interface Thread {
  thread_id: string;
  project_name: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  thread_id: string;      // NEW
  project_name: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  // ... existing fields
}
```

**API Methods**:
```typescript
api.threads = {
  list: (projectName: string) => Promise<Thread[]>,
  create: (projectName: string, title?: string) => Promise<Thread>,
  get: (threadId: string) => Promise<Thread>,
  updateTitle: (threadId: string, title: string) => Promise<Thread>,
  delete: (threadId: string) => Promise<void>,
  getMessages: (threadId: string, offset?: number, limit?: number) => Promise<{messages: ChatMessage[], has_more: boolean}>,
  sendMessage: (threadId: string, content: string) => Promise<ChatMessage>,
}
```

**Lines affected**: ~80 lines

#### 2. Thread List in Sidebar
**File**: `app/frontend/src/components/AppSidebar.tsx` (refactor)

**Current**: Shows projects + recent chat history

**New**: 
- When in a project's Chat Mode, show thread list for that project
- Thread list appears as expandable section under project name
- Compact thread item: `[icon] Title • 12 msgs • 2h ago`
- Active thread highlighted with accent color
- Click thread → navigate to `/project/:projectId/thread/:threadId`
- Right-click menu: "Rename", "Delete", "Pin to top" (pin deferred)

**New Components**:
- `ThreadList.tsx` — thread list UI
- `ThreadItem.tsx` — individual thread item

**State Management**:
- Load threads when project Chat Mode opened
- Store in React Query cache: `useQuery(['threads', projectId])`
- Optimistic updates for create/delete

**Lines affected**: ~200 lines (refactor + new components)

#### 3. Update ProjectWorkspacePage for Threads
**File**: `app/frontend/src/pages/ProjectWorkspacePage.tsx` (major refactor)

**Current**: Loads project messages directly

**New**:
- URL: `/project/:projectId/thread/:threadId` (thread ID required)
- If no thread ID: redirect to most recent thread or create first thread
- Load thread metadata + messages on mount
- Send messages to thread endpoint
- Show thread title in page header (editable on click)
- "New Thread" button in header
- Message list scoped to current thread only

**State**:
```typescript
const { threadId } = useParams();
const { data: thread } = useQuery(['thread', threadId], () => api.threads.get(threadId));
const { data: messages } = useQuery(['messages', threadId], () => api.threads.getMessages(threadId));
```

**Empty State**:
- No threads for project: "Start your first conversation" + auto-create first thread
- Thread created but no messages: Standard chat input, no special empty state

**Lines affected**: ~150 lines (refactor existing code)

#### 4. Thread Creation & Switching
**Files**: 
- `app/frontend/src/pages/ProjectWorkspacePage.tsx` (add handlers)
- `app/frontend/src/components/ThreadList.tsx` (add handlers)

**Thread Creation Flow**:
1. User clicks "New Thread" button
2. Call `api.threads.create(projectName)` (no title, will auto-generate on first message)
3. Navigate to `/project/:projectId/thread/:newThreadId`
4. Show empty message input
5. User sends first message
6. Backend generates title from first message
7. Frontend refetches thread list (title appears)

**Thread Switching**:
1. User clicks thread in sidebar
2. Navigate to `/project/:projectId/thread/:threadId`
3. Load thread messages
4. Scroll to bottom
5. Sidebar highlights active thread

**Thread Deletion**:
1. User right-clicks thread → "Delete"
2. Show confirmation dialog: "Delete this conversation? This cannot be undone."
3. If confirmed: call `api.threads.delete(threadId)`
4. If deleted thread was active: redirect to most recent thread or create new one
5. Refresh thread list

**Lines affected**: ~100 lines (handlers, dialogs)

#### 5. Update Routing
**File**: `app/frontend/src/App.tsx` (update routes)

**Current**:
```typescript
<Route path="/project/:projectId/chat" element={<ProjectChatLayout />} />
```

**New**:
```typescript
<Route path="/project/:projectId/chat" element={<Navigate to="thread/latest" replace />} />
<Route path="/project/:projectId/thread/:threadId" element={<ProjectChatLayout />} />
```

**Logic for "latest"**:
- Special handler in ProjectChatLayout: if `threadId === "latest"`, load most recent thread and redirect
- If no threads exist, create first thread and redirect

**Lines affected**: ~50 lines

### Testing & Validation

**Fresh Install**:
- [ ] Create project → auto-creates first thread → send message → works
- [ ] Thread title auto-generated from first message
- [ ] Thread appears in sidebar with correct title

**Migration**:
- [ ] Existing project with messages → backend migrates to thread model → all messages preserved
- [ ] Thread title generated from first user message in old conversation
- [ ] Old `messages.jsonl` backed up to `.backup` file

**Thread Operations**:
- [ ] Create thread → appears in sidebar
- [ ] Switch thread → messages load correctly
- [ ] Delete thread → thread removed, UI updates
- [ ] Send message → appears in thread, message count updates
- [ ] Edit thread title → title updates in sidebar and header

**Multi-Project**:
- [ ] Project A threads don't appear in Project B sidebar
- [ ] Switching projects loads correct thread list

### Deferred from Go 1
- Thread title editing UI (auto-generation only)
- Thread search/filter
- Thread archiving
- Thread export/share
- Thread pinning

---

## Go 2: Code Mode Overhaul

**Goal**: Build VS Code-style Code Mode with folder selection, real terminal (PTY), full git workflow, file tree, and AI chat integration.

### Backend Changes

#### 1. Workspace/Folder Model Enhancement
**File**: `app/backend/project_registry.py` (minor updates)

**Current**: Projects already have `workspace_root` field

**Enhancement**:
- Add `POST /api/projects/{name}/workspace` endpoint to update workspace_root
- Validate folder path exists before setting
- Return folder stats (file count, git status if repo)

**Lines affected**: ~40 lines

#### 2. Real Terminal Backend (PTY)
**File**: `app/backend/terminal_manager.py` (new), `app/backend/terminal_routes.py` (new)

**Implementation**:

**Terminal Session Manager**:
```python
import pty
import os
import subprocess
import select
from threading import Thread

class TerminalSession:
    def __init__(self, session_id: str, cwd: str, shell: str):
        self.session_id = session_id
        self.cwd = cwd
        self.shell = shell  # "powershell" on Windows, "bash" on Unix
        self.master_fd = None
        self.process = None
        self.output_buffer = []
        self.alive = True
    
    def start(self):
        # Fork PTY process
        # Start shell in cwd
        # Begin output reader thread
    
    def send_input(self, data: str):
        # Write to master_fd
    
    def read_output(self, timeout: float = 0.1) -> str:
        # Read from master_fd, return output
    
    def resize(self, rows: int, cols: int):
        # fcntl.ioctl to resize PTY
    
    def kill(self):
        # Terminate process, close FDs
```

**Session Store**:
```python
TERMINAL_SESSIONS: dict[str, TerminalSession] = {}

def create_terminal_session(project_name: str, cwd: str) -> str:
    session_id = str(uuid4())
    shell = detect_shell()  # powershell on Windows, bash/zsh on Unix
    session = TerminalSession(session_id, cwd, shell)
    session.start()
    TERMINAL_SESSIONS[session_id] = session
    return session_id
```

**FastAPI Routes**:
```python
POST   /api/terminal/sessions          # Create session
WS     /api/terminal/sessions/{id}/ws  # WebSocket for I/O
POST   /api/terminal/sessions/{id}/resize  # Resize PTY
DELETE /api/terminal/sessions/{id}     # Kill session
```

**WebSocket Handler**:
```python
@app.websocket("/api/terminal/sessions/{session_id}/ws")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = TERMINAL_SESSIONS.get(session_id)
    
    # Bi-directional:
    # - Receive from websocket → send to PTY
    # - Read from PTY → send to websocket
    
    # Use asyncio.gather for concurrent read/write
```

**Platform Support**:
- **Unix/Mac**: Use `pty` module directly
- **Windows**: Use `winpty` wrapper or `conpty` (Windows 10+)
  - Fallback: enhanced command runner if PTY unavailable

**Fallback Strategy** (if PTY fails):
- Detect PTY unavailability on startup
- If unavailable, use enhanced command runner:
  - Maintain session state (env vars, cwd)
  - Run commands via subprocess, return output
  - Simulate shell prompts
  - Not true PTY but better than nothing

**Lines affected**: ~400 lines (complex but critical)

#### 3. Git Integration Backend
**File**: `app/backend/git_tools.py` (new), `app/backend/git_routes.py` (new)

**Implementation**:

**Git Operations** (via subprocess + system git):
```python
def git_status(workspace_path: str) -> dict:
    # Run: git status --porcelain --branch
    # Parse output
    # Return: {branch, ahead, behind, modified, staged, untracked}

def git_diff(workspace_path: str, file_path: str = None) -> str:
    # Run: git diff [file_path]
    # Return raw diff

def git_add(workspace_path: str, files: list[str]) -> dict:
    # Run: git add <files>
    # Return success/error

def git_commit(workspace_path: str, message: str) -> dict:
    # Run: git commit -m "message"
    # Return commit hash

def git_push(workspace_path: str, remote: str = "origin", branch: str = None) -> dict:
    # Run: git push origin <branch>
    # Return success/error

def git_pull(workspace_path: str) -> dict:
    # Run: git pull
    # Return success/error

def git_branch_list(workspace_path: str) -> list[dict]:
    # Run: git branch -a
    # Parse output
    # Return: [{name, current, remote}]

def git_checkout(workspace_path: str, branch: str) -> dict:
    # Run: git checkout <branch>
    # Return success/error

def git_log(workspace_path: str, limit: int = 20) -> list[dict]:
    # Run: git log --pretty=format:"%H|%an|%ae|%ad|%s" -n <limit>
    # Parse output
    # Return commit list
```

**FastAPI Routes**:
```python
POST /api/git/status        # body: {workspace_path}
POST /api/git/diff          # body: {workspace_path, file_path?}
POST /api/git/add           # body: {workspace_path, files}
POST /api/git/commit        # body: {workspace_path, message}
POST /api/git/push          # body: {workspace_path}
POST /api/git/pull          # body: {workspace_path}
GET  /api/git/branches      # query: workspace_path
POST /api/git/checkout      # body: {workspace_path, branch}
GET  /api/git/log           # query: workspace_path, limit
```

**Error Handling**:
- Catch `subprocess.CalledProcessError` → return error with stderr output
- User-friendly messages: "No git repository found", "Uncommitted changes prevent checkout", etc.

**Lines affected**: ~350 lines

### Frontend Changes

#### 1. Folder/Workspace Selection UI
**File**: `app/frontend/src/pages/CodeModePage.tsx` (refactor)

**Current**: Code Mode exists but incomplete

**New**:
- On load: check if project has `workspace_root`
- If not: show "Open Folder" dialog (Electron IPC to native folder picker)
- If yes: load workspace and show file tree
- "Change Folder" in top-left menu (next to project name)
- Show workspace path in breadcrumb: `~/projects/my-app`

**Electron IPC for Folder Picker**:
```typescript
// In Electron main process
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

// In renderer
const folderPath = await window.electron.openDirectory();
```

**Lines affected**: ~100 lines (including Electron IPC setup)

#### 2. Code Mode Layout Structure
**File**: `app/frontend/src/pages/CodeModePage.tsx` (major refactor)

**New Layout** (using `react-resizable-panels`):
```
┌────────────────────────────────────────────────┐
│ Header: CubOS 🐻 | project-name | workspace path│
├──────────┬─────────────────────────┬────────────┤
│          │                         │            │
│  File    │   Editor / Output       │   AI Chat  │
│  Tree    │                         │   Panel    │
│          │                         │ (optional) │
│  (left)  │   (main, resizable)     │  (right)   │
│          │                         │            │
│          ├─────────────────────────┤            │
│          │ Terminal / Output       │            │
│          │ (bottom, collapsible)   │            │
└──────────┴─────────────────────────┴────────────┘
```

**Panels**:
- **Left**: File tree (Explorer), 200-400px wide, collapsible
- **Main**: Editor area (top) + Terminal/Output tabs (bottom), resizable
- **Right**: AI Chat panel, 300-500px wide, collapsible
- **Bottom**: Terminal/Output/Problems tabs, 200-400px tall, collapsible

**Panel State** (persist in localStorage):
```typescript
{
  leftPanelCollapsed: false,
  leftPanelWidth: 250,
  rightPanelCollapsed: true,
  rightPanelWidth: 400,
  bottomPanelCollapsed: false,
  bottomPanelHeight: 300,
}
```

**Lines affected**: ~200 lines (layout restructure)

#### 3. File Tree Component
**File**: `app/frontend/src/components/code/FileTree.tsx` (new)

**Features**:
- Tree view of workspace folder (recursive)
- Lazy-load directories on expand
- File icons by extension (use lucide-react icons + custom map)
- Git status indicators: `M` (modified), `A` (added), `?` (untracked)
- Click file → open in editor
- Right-click menu: "Open", "Rename", "Delete", "New File", "New Folder"
- Keyboard nav: arrow keys, Enter to open

**API**:
- Use existing `/api/files/list` endpoint (if exists) or create new one
- Load file tree incrementally (don't load entire tree upfront)

**State**:
```typescript
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  gitStatus?: 'modified' | 'staged' | 'untracked';
  expanded?: boolean;
}
```

**Lines affected**: ~300 lines

#### 4. Terminal Panel (Frontend)
**File**: `app/frontend/src/components/code/TerminalPanel.tsx` (new)

**Implementation**:
- Use `xterm.js` + `xterm-addon-fit` + `xterm-addon-web-links`
- Connect to backend WebSocket: `ws://localhost:8000/api/terminal/sessions/{id}/ws`
- Render terminal in `<div>` with xterm
- Send user input to WebSocket
- Receive output from WebSocket, write to xterm
- Handle terminal resize (fit addon)
- Multiple terminal tabs (create new terminal, close terminal)

**Terminal Tab Bar**:
```
[Terminal 1] [Terminal 2] [+]
```

**Terminal Session Management**:
```typescript
const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
const [activeTerminalId, setActiveTerminalId] = useState<string>();

interface TerminalInstance {
  id: string;
  sessionId: string;  // backend session ID
  terminal: Terminal; // xterm instance
  websocket: WebSocket;
  title: string;      // e.g., "bash", "powershell"
}

function createTerminal() {
  // Call API to create backend session
  // Open WebSocket
  // Create xterm instance
  // Connect input/output
  // Add to terminals list
}
```

**Lines affected**: ~250 lines

#### 5. Git Panel & Status Bar
**Files**:
- `app/frontend/src/components/code/GitPanel.tsx` (new)
- `app/frontend/src/components/code/StatusBar.tsx` (new)

**Status Bar** (bottom of Code Mode):
```
[main ↓1 ↑2] [3 modified] [AI Provider: Ollama] [workspace-path]
```
- Current branch (click → branch switcher)
- Modified file count (click → open Git panel)
- AI provider indicator
- Workspace path

**Git Panel** (overlay or left sidebar tab):

**Structure**:
```
Git Panel
├── Changes (3)
│   ├── M  src/App.tsx
│   ├── ?? src/NewFile.tsx
│   └── [Stage All] [Discard All]
├── Staged (1)
│   ├── M  src/index.ts
│   └── [Unstage All]
├── Commit
│   ├── [Message input]
│   └── [Commit] [Commit & Push]
└── Branches
    ├── * main
    ├── feature/threads
    └── [+ New Branch]
```

**Operations**:
- Click file → show diff in editor
- Click `+` next to file → stage
- Click `-` next to staged file → unstage
- Enter commit message → click "Commit"
- Click branch → checkout (with confirmation if uncommitted changes)

**Lines affected**: ~400 lines

#### 6. AI Chat Panel in Code Mode
**File**: `app/frontend/src/components/code/CodeAIPanel.tsx` (new)

**Features**:
- Right sidebar panel
- Same thread system as Chat Mode (show thread list, switch threads)
- Send messages to AI with Code Mode context
- AI can suggest edits, run commands, etc.
- Show bear icon in panel header (subtle)
- Collapsible

**Integration**:
- Use same thread API as Chat Mode
- Thread scoped to project
- Messages tagged with `context: "code_mode"`

**Lines affected**: ~200 lines (reuse Chat Mode components)

#### 7. Simple Editor (Monaco Deferred)
**File**: `app/frontend/src/components/code/SimpleEditor.tsx` (new)

**Implementation**:
- Use `<textarea>` with monospace font + line numbers
- Or lightweight editor like CodeMirror 6 (basic mode)
- Syntax highlighting via Prism.js (static, post-render)
- File operations: open, edit, save (via API)
- No advanced features (autocomplete, IntelliSense) yet

**Later**: Replace with Monaco editor when scope permits

**Lines affected**: ~150 lines

### Testing & Validation

**Code Mode Folder Selection**:
- [ ] Open Code Mode → select folder → file tree loads
- [ ] Change folder → file tree updates
- [ ] Folder path shown in breadcrumb/status bar

**Terminal**:
- [ ] Create terminal → shell prompt appears
- [ ] Type command → executes → output shown
- [ ] Multiple terminals → each has own session
- [ ] Close terminal → session killed on backend
- [ ] Resize terminal → PTY resizes correctly

**Git Integration**:
- [ ] Open git repo → status shows correctly (branch, modified files)
- [ ] Stage file → appears in Staged section
- [ ] Commit with message → commit created
- [ ] Push → changes pushed to remote
- [ ] Pull → changes pulled from remote
- [ ] Switch branch → file tree updates

**File Tree**:
- [ ] Expand directory → children load
- [ ] Click file → opens in editor
- [ ] Git status indicators appear on modified files
- [ ] Right-click menu works

**AI Chat in Code Mode**:
- [ ] Send message → AI responds
- [ ] Thread list works same as Chat Mode
- [ ] AI can reference code context

### Deferred from Go 2
- Monaco editor (using simple editor for now)
- Deep debugging panel
- Testing panel
- Multi-file editing (tabs)
- Git merge conflict resolution UI
- Git stash, rebase, cherry-pick
- Advanced git features

---

## Go 3: Polish, Cleanup & Integration

**Goal**: Remove Plan/Build mode from UX, refine Self-Upgrade, adjust branding, cross-mode consistency, performance optimization, error handling.

### Backend Changes

#### 1. Remove Plan/Build Mode
**Files**: 
- `app/backend/settings_store.py` (update)
- `app/backend/ai_client.py` (update prompts)
- `app/backend/main.py` (remove mode endpoints)

**Changes**:
- Remove `assistant_mode` from settings API response (or mark as hidden)
- Remove mode injection from AI prompts
- AI should respond naturally without rigid mode constraints
- Keep mode as internal hint only if useful for specific actions
- Remove `GET/POST /api/settings/assistant-mode` endpoints or return fixed value

**Lines affected**: ~80 lines (deletions + minimal updates)

#### 2. Self-Upgrade Workspace Enhancement
**Files**:
- `app/backend/project_registry.py` (update)
- `app/backend/file_tools.py` (update permissions)

**Changes**:
- Add `is_system: true` flag to Self-Upgrade project entry
- Update `get_project_root` to allow Self-Upgrade to access CubOS source files
- Add elevated permission check:
  - Self-Upgrade can read/write anywhere in `AI_SYSTEM_BASE_PATH`
  - Self-Upgrade can access backend source files (app/backend/, app/frontend/)
  - Self-Upgrade can read logs (logs/, backend_stdout.txt, etc.)
- Add audit logging:
  - Log all Self-Upgrade file operations to `logs/self_upgrade_audit.log`
  - Include timestamp, operation, file path, success/failure
- Add approval requirement for destructive operations:
  - Delete system files → requires approval
  - Modify backend/frontend source → requires approval
  - Run system commands → requires approval (already exists)

**Lines affected**: ~120 lines

#### 3. Performance Optimization
**Files**: Various

**Optimizations**:
- **Thread list caching**: Cache thread list in memory, invalidate on create/delete
- **Message pagination**: Already exists, ensure frontend uses it
- **Git status polling**: Debounce git status checks (max once per 2 seconds)
- **File tree lazy loading**: Already planned, ensure implemented
- **Response streaming**: Use SSE for AI responses (already exists?)

**Lines affected**: ~100 lines (various small optimizations)

#### 4. Error Handling & Logging
**Files**: Various

**Changes**:
- Consistent error response format:
  ```json
  {
    "error": "Error message",
    "detail": "Detailed explanation",
    "code": "ERROR_CODE"
  }
  ```
- User-friendly error messages (no raw stack traces to frontend)
- Log all errors to `logs/backend_errors.log` with stack traces
- Add structured logging (timestamp, level, module, message)

**Lines affected**: ~80 lines

### Frontend Changes

#### 1. Remove Plan/Build Mode Toggle
**Files**:
- `app/frontend/src/types/index.ts` (remove `AssistantMode`)
- `app/frontend/src/pages/ProjectWorkspacePage.tsx` (remove mode toggle)
- `app/frontend/src/pages/SettingsPage.tsx` (remove mode setting)
- `app/frontend/src/App.tsx` (remove mode state)

**Changes**:
- Remove `AssistantMode` type
- Remove mode toggle UI from Chat Mode header
- Remove mode display from status bar
- Remove `assistantMode` prop from all components
- Clean up mode-related state management

**Lines affected**: ~150 lines (deletions)

#### 2. Bear Branding Adjustments
**Files**: Various UI components

**Changes**:

**Chat Mode** (stronger branding):
- Empty state: large bear illustration + welcoming text
- Message bubbles: optional small bear avatar for assistant messages
- Placeholder text: personality-driven ("Ask me anything!", "How can I help?")
- Onboarding: bear illustrations in first-time experience

**Code Mode** (subtle branding):
- Title bar: small bear logo (16px) in top-left corner
- Empty state (no file open): medium bear + "Select a file to begin"
- AI chat panel: bear icon in header
- Status bar: no bear (keep utilitarian)
- Main workspace: no bear (IDE-like)

**Home Page** (strong branding):
- Large bear illustration
- Welcome message with personality
- "Create your first project" with bear mascot

**Guidelines**:
- Chat Mode: warm, friendly, conversational
- Code Mode: professional, focused, utilitarian
- Don't overdo it (avoid cartoonish)

**Lines affected**: ~100 lines (mostly asset updates + text changes)

#### 3. Self-Upgrade Page Refinement
**File**: `app/frontend/src/pages/SelfUpgradePage.tsx` (update)

**Changes**:
- Visual distinction: orange/red accent color (vs blue for normal projects)
- "System Workspace" badge in header
- Warning banner: "This workspace has elevated permissions and can modify CubOS itself"
- Show audit log in right panel (log of recent Self-Upgrade actions)
- Approval confirmations more prominent (modal instead of inline)
- Clear messaging throughout

**Lines affected**: ~100 lines

#### 4. Cross-Mode Consistency
**Files**: All page components

**Consistency Pass**:
- **Header layout**: Same height, same structure (logo + title + actions)
- **Sidebar behavior**: Same collapse/expand animation, same width
- **Keyboard shortcuts**: 
  - `Cmd+B` / `Ctrl+B` → toggle sidebar
  - `Cmd+\`` → toggle terminal (Code Mode)
  - `Cmd+K` → focus search/command palette (future)
- **Color scheme**: Same semantic colors (primary, secondary, accent, destructive)
- **Typography**: Same font sizes, weights, line heights
- **Spacing**: Same padding, margins (use design tokens)
- **Loading states**: Same spinner component
- **Error states**: Same error message component
- **Animations**: Same transition timing (150ms fast, 300ms normal)

**Create Design Tokens File**:
```typescript
// app/frontend/src/lib/design-tokens.ts
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export const transitions = {
  fast: '150ms ease',
  normal: '300ms ease',
  slow: '500ms ease',
};

// etc.
```

**Lines affected**: ~200 lines (refactoring for consistency)

#### 5. Settings Page Updates
**File**: `app/frontend/src/pages/SettingsPage.tsx` (update)

**Changes**:
- Remove Plan/Build mode setting
- Update AI Provider section:
  - Clarify "Global for all modes"
  - Show current active model prominently
- Add new sections:
  - **Terminal Settings**: Default shell, font size, cursor style
  - **Git Settings**: User name, email, default remote (read from system git config, allow override)
  - **Editor Settings**: Font size, tab size, theme (for future Monaco)
  - **UI Preferences**: Theme (light/dark/system), sidebar position
- Better organization: group related settings
- Descriptions for each setting

**Lines affected**: ~150 lines

#### 6. Empty States & Onboarding
**Files**: Various pages

**Empty States**:
- **HomePage**: "Welcome to CubOS" + bear + "Create your first project" button
- **Chat Mode (no threads)**: "Start your first conversation" + auto-create thread
- **Code Mode (no folder)**: "Open a folder to begin coding" + folder picker
- **Settings**: No empty state (always has content)

**First-Run Onboarding** (simple):
- On first app launch, show welcome modal:
  - "Welcome to CubOS!"
  - Brief explanation (AI coding assistant, Chat + Code modes)
  - "Create your first project" button
  - Checkbox: "Don't show this again"
- Store in localStorage: `onboarding_completed: true`

**Lines affected**: ~150 lines

#### 7. Error Boundaries & Fallbacks
**Files**: 
- `app/frontend/src/components/ErrorBoundary.tsx` (new)
- `app/frontend/src/App.tsx` (wrap with error boundary)

**Error Boundary Component**:
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h1>Something went wrong</h1>
          <p>The application encountered an error.</p>
          <button onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usage**: Wrap entire app and major sections (each page, each panel)

**Lines affected**: ~80 lines

### Testing & Validation

**Plan/Build Mode Removal**:
- [ ] No mode toggle visible in UI
- [ ] AI responds naturally without mode constraints
- [ ] No references to mode in UI text

**Self-Upgrade**:
- [ ] Visual distinction clear (color, badge)
- [ ] Elevated permissions work (can modify CubOS files)
- [ ] Audit log visible in UI
- [ ] Approvals required for destructive operations

**Branding**:
- [ ] Bear present and appropriate in Chat Mode
- [ ] Bear subtle in Code Mode (logo, empty state, AI panel only)
- [ ] Bear prominent in Home Page

**Consistency**:
- [ ] All pages have similar header structure
- [ ] Sidebar behavior consistent (collapse, width, animation)
- [ ] Keyboard shortcuts work across modes
- [ ] Color scheme consistent

**Settings**:
- [ ] All settings work correctly
- [ ] Terminal settings apply to new terminal sessions
- [ ] Git settings read from system config

**Empty States**:
- [ ] All empty states show helpful UI
- [ ] No blank pages
- [ ] First-run onboarding shows once

**Error Handling**:
- [ ] Errors show friendly message, not crash
- [ ] Error boundary catches errors, shows fallback UI
- [ ] Console has detailed error logs for debugging

### Deferred from Go 3
- Advanced onboarding (multi-step tutorial)
- In-app help system
- Customizable keybindings
- Advanced theme customization

---

## Go 4: Packaging, Fresh Install & Stabilization

**Goal**: Build production-ready installer, ensure fresh install works flawlessly, fix packaging issues, final QA.

### Backend Packaging

#### 1. PyInstaller Build
**File**: `app/backend/cubos_backend.spec` (update)

**Ensure Included**:
- All Python dependencies
- Migration script (`migration_threads.py`)
- Config file templates
- Any data files (if applicable)

**Build Command**:
```bash
cd app/backend
pyinstaller cubos_backend.spec
```

**Test Standalone**:
```bash
cd dist
./cubos_backend.exe --port 8000
# Should start without errors
```

**Lines affected**: ~50 lines (spec file updates)

#### 2. Fresh Install Backend Setup
**File**: `app/backend/main.py` (add startup logic)

**On Backend Startup**:
1. Ensure base directories exist: `configs/`, `memory/`, `workspaces/`, `logs/`
2. Ensure `projects_registry.json` exists (create with Self-Upgrade project)
3. Run migration script if needed
4. Initialize settings if not exist
5. Log startup to `logs/backend_startup.log`

**Lines affected**: ~80 lines

### Frontend Packaging

#### 1. Vite Production Build
**File**: `app/frontend/package.json` (scripts already exist)

**Build Command**:
```bash
cd app/frontend
npm run build
```

**Verify**:
- `dist/` folder created
- `index.html` + bundled JS/CSS
- All assets included

**Lines affected**: No code changes (already configured)

#### 2. Electron Packaging
**File**: `app/frontend/electron-builder.yml` or `package.json` (config)

**Electron Builder Config**:
```json
{
  "build": {
    "appId": "com.cubos.app",
    "productName": "CubOS",
    "files": [
      "dist/**/*",
      "electron/**/*"
    ],
    "extraResources": [
      {
        "from": "../backend/dist/cubos_backend.exe",
        "to": "backend/cubos_backend.exe"
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

**Package Command**:
```bash
npm run package:win
```

**Lines affected**: ~100 lines (config + Electron main process updates)

### Fresh Install Testing

#### Test Scenarios

**Fresh Install on Clean Windows Machine**:
1. Run installer
2. Install to default location
3. Launch app
4. Backend starts automatically (via Electron spawn)
5. Frontend connects to backend
6. Home page loads
7. No errors in console

**First Use Flow**:
1. Create first project
2. Project appears in sidebar
3. Open Chat Mode → first thread auto-created
4. Send message → AI responds
5. Open Code Mode → folder picker appears
6. Select folder → file tree loads
7. Terminal works → commands execute
8. Close app → data persists

**Restart Flow**:
1. Close app
2. Reopen app
3. Projects/threads/messages still there
4. Resume conversation in thread
5. Code Mode remembers workspace folder

#### Common Fresh Install Issues to Fix

**Backend Issues**:
- [ ] Backend doesn't start (missing dependencies, paths wrong)
- [ ] Database/files don't initialize (directory permissions)
- [ ] Migration script doesn't run
- [ ] Port 8000 already in use (detect and use fallback port)
- [ ] Environment variables missing

**Frontend Issues**:
- [ ] Blank page on launch (routing issue, see Go 1 fixes)
- [ ] Backend connection fails (wrong URL, CORS)
- [ ] Electron IPC not working (main process issues)

**Data Issues**:
- [ ] Data not persisting (wrong AppData path)
- [ ] Projects lost after restart (registry not saving)
- [ ] Settings reset after restart

**Fix Strategy**:
1. Package app
2. Test on clean machine (VM recommended)
3. Document all errors
4. Fix errors
5. Rebuild and retest
6. Repeat until stable

### Final QA Checklist

#### Core Flows
- [ ] Create project → works
- [ ] Create thread → works
- [ ] Send message → AI responds
- [ ] Open folder in Code Mode → file tree loads
- [ ] Open file in editor → content shows
- [ ] Terminal → commands execute, output appears
- [ ] Git status → correct info
- [ ] Git commit/push → works
- [ ] Settings → all apply correctly
- [ ] Self-Upgrade → elevated permissions work

#### UI/UX
- [ ] All pages render without blank screens
- [ ] All buttons/actions work
- [ ] No console errors on normal flows
- [ ] Loading states show appropriately
- [ ] Error states show friendly messages
- [ ] Responsive layout (window resize works)
- [ ] Animations smooth (no jank)

#### Data Integrity
- [ ] Projects persist after restart
- [ ] Threads persist after restart
- [ ] Messages persist after restart
- [ ] Settings persist after restart
- [ ] Workspace folders remembered
- [ ] Terminal sessions cleared on exit (no orphan processes)

#### Performance
- [ ] App launches in <5 seconds
- [ ] Chat messages appear in <2 seconds
- [ ] File tree loads in <3 seconds (for folders <1000 files)
- [ ] No memory leaks (test 1-hour session)
- [ ] No CPU spikes during idle

#### Edge Cases
- [ ] Very long project name
- [ ] Very long message (>10k chars)
- [ ] Many threads (>100)
- [ ] Large workspace folder (>10k files)
- [ ] No internet connection (Ollama should work offline)
- [ ] Backend crash → frontend shows error, not blank page

### Installer Improvements

**Installer Features**:
- Clear app name: "CubOS AI Coding Assistant"
- App icon (bear logo)
- Version number displayed
- License agreement
- Install location choice (default: `C:\Program Files\CubOS`)
- Desktop shortcut option (default: yes)
- Start menu entry (default: yes)
- Auto-launch on install (default: yes)
- Uninstaller (via Control Panel → Programs)

**Installer Testing**:
- [ ] Install succeeds
- [ ] Desktop shortcut works
- [ ] Start menu entry works
- [ ] App launches from shortcuts
- [ ] Uninstall removes all files (except user data in AppData)

### Documentation

**Files to Create**:
- `README.md` — project overview, dev setup
- `INSTALLATION.md` — user installation guide
- `TROUBLESHOOTING.md` — common issues + fixes
- `CHANGELOG.md` — version history

**README Content**:
- What is CubOS
- Features (Chat Mode, Code Mode, threads, terminal, git)
- System requirements (Windows 10+, Ollama or Groq API)
- Installation instructions (download installer, run, launch)
- Basic usage (create project, chat, code)
- Development setup (for contributors)

**TROUBLESHOOTING Content**:
- Backend won't start → check port 8000, check logs
- Blank screen → check backend connection, refresh app
- AI not responding → check Ollama running, check API key
- Terminal not working → check system shell, check permissions
- Git not working → check git installed, check system git config

---

## Implementation Order Summary

### Go 1: Thread System (Foundation)
**Estimated Effort**: Medium (1-2 weeks)
**Risk**: Medium (data migration risk)

**Order**:
1. Backend thread storage model (chat_store.py)
2. Backend thread API endpoints (thread_routes.py)
3. Data migration script (migration_threads.py)
4. Frontend thread types and API client
5. Thread list in sidebar
6. Update ProjectWorkspacePage for threads
7. Thread creation/switching/deletion
8. Update routing
9. Test migration with real data
10. Final QA

**Deliverable**: Multi-thread Chat Mode with preserved data

---

### Go 2: Code Mode (Largest Go)
**Estimated Effort**: High (2-3 weeks)
**Risk**: High (PTY complexity, git integration)

**Order**:
1. Backend workspace/folder model updates
2. Backend terminal PTY manager (terminal_manager.py) — **CRITICAL, TEST EARLY**
3. Backend terminal WebSocket routes
4. Backend git integration (git_tools.py, git_routes.py)
5. Frontend Electron folder picker IPC
6. Frontend Code Mode layout restructure
7. Frontend file tree component
8. Frontend terminal panel with xterm.js
9. Frontend git panel + status bar
10. Frontend AI chat panel in Code Mode
11. Frontend simple editor
12. Test all Code Mode features
13. Final QA

**Sub-Phases** (for sanity):
- **2a**: Folder model + file tree (3-4 days)
- **2b**: Terminal backend + frontend (5-6 days)
- **2c**: Git backend + frontend (4-5 days)
- **2d**: AI chat panel + final integration (2-3 days)

**Deliverable**: Fully functional Code Mode with terminal, git, file tree

---

### Go 3: Polish & Cleanup (Refinement)
**Estimated Effort**: Low-Medium (1 week)
**Risk**: Low

**Order**:
1. Remove Plan/Build mode from backend
2. Remove Plan/Build mode from frontend
3. Self-Upgrade enhancements (permissions, audit log)
4. Bear branding pass (Chat vs Code)
5. Cross-mode consistency pass (headers, sidebar, keyboard shortcuts)
6. Settings page updates
7. Empty states + error boundaries
8. Performance optimization pass
9. Error handling improvements
10. Final QA

**Deliverable**: Polished, consistent, production-ready UI

---

### Go 4: Packaging & Stabilization (Final QA)
**Estimated Effort**: Medium (1 week)
**Risk**: Medium (fresh install issues)

**Order**:
1. Backend PyInstaller build + test standalone
2. Frontend Vite build
3. Electron packaging config
4. Package app (Windows installer)
5. **Test on clean machine** (VM or physical)
6. Document all bugs/issues
7. Fix bugs
8. Rebuild and retest
9. Repeat until stable (2-3 iterations expected)
10. Final QA checklist
11. Installer improvements (icon, shortcuts, uninstaller)
12. Documentation (README, TROUBLESHOOTING)
13. **Ship** 🚀

**Deliverable**: Production installer, stable fresh install, complete docs

---

## Roadmap Corrections (Based on User Feedback)

### 1. Storage Model ✓
**Corrected**: File-based storage (JSONL, JSON), not SQLite
- Thread storage uses `threads.json` + `threads/{id}.jsonl`
- Migration script reads/writes JSONL files
- No database dependencies

### 2. Backend Framework ✓
**Corrected**: FastAPI confirmed
- All routes use FastAPI decorators
- WebSocket for terminal uses FastAPI WebSocket
- Pydantic models for request/response validation

### 3. Terminal Target ✓
**Corrected**: Real PTY is primary target
- Implement full PTY backend with pty/winpty
- Fallback to enhanced command runner ONLY if PTY fails
- Document fallback strategy clearly
- Test PTY early in Go 2 to validate feasibility

### 4. Monaco Timeline ✓
**Corrected**: Simple editor first, Monaco later
- Use `<textarea>` or lightweight CodeMirror for Go 2
- Monaco integration deferred to post-redesign enhancement
- Keeps Go 2 scope manageable

### 5. Git Workflow ✓
**Corrected**: Practical single-repo workflow
- System git config (no OAuth complexity)
- Focus on: status, branch, commit, push, pull, stage/unstage
- Defer advanced features: merge conflicts, rebase, stash, submodules

### 6. Frontend Design Alignment ✓
**Confirmed**: New frontend design is the source of truth
- Build toward new frontend architecture, not preserve old patterns
- Use existing tech stack as foundation (React 18, TypeScript, Vite, Radix UI + Tailwind, HashRouter)
- Transition away from legacy shells/layouts during implementation
- Old components preserved only when necessary for boot-time integration during transition phases
- Each Go should move frontend closer to new design target, not entrench old patterns

---

## The Actual First Implementation Step

**Task**: Implement backend thread storage model

**Exact Files to Touch**:
1. `app/backend/chat_store.py` — refactor for thread support

**Exact Changes**:
1. Add imports: `from pathlib import Path`, `from uuid import uuid4`
2. Add constants:
   ```python
   THREADS_FILENAME = "threads.json"
   THREADS_DIR_NAME = "threads"
   ```
3. Add functions:
   - `get_threads_path(project_name: str) -> Path`
   - `get_threads_dir(project_name: str) -> Path`
   - `get_thread_messages_path(project_name: str, thread_id: str) -> Path`
   - `ensure_threads_store(project_name: str) -> Path`
   - `create_thread(project_name: str, title: str = "New Conversation") -> dict`
   - `list_threads(project_name: str) -> list[dict]`
   - `get_thread(project_name: str, thread_id: str) -> dict`
   - `update_thread_title(project_name: str, thread_id: str, title: str) -> dict`
   - `delete_thread(project_name: str, thread_id: str) -> dict`
   - `append_thread_message(project_name: str, thread_id: str, role: str, content: str, ...) -> dict`
   - `read_thread_messages(project_name: str, thread_id: str) -> list[dict]`
   - `read_thread_messages_page(project_name: str, thread_id: str, offset: int, limit: int) -> dict`
4. Update message format to include `thread_id` field
5. Write unit tests (optional but recommended)

**Why This First**:
1. **Foundation for entire Go 1**: All other thread work depends on this
2. **Validates storage approach**: Confirms file-based storage works for threads
3. **No frontend dependency**: Can be tested standalone with Python scripts
4. **Highest risk item first**: Data migration depends on this being correct
5. **Enables parallel work**: Once complete, frontend and API work can proceed in parallel

**What Success Looks Like**:
- `create_thread()` creates `threads.json` and returns thread object
- `list_threads()` returns all threads for a project
- `append_thread_message()` appends to correct thread JSONL file
- `read_thread_messages()` reads messages from thread JSONL file
- Thread IDs are unique and parseable (format: `{project_name}_{uuid}`)
- Manual testing via Python REPL confirms all operations work

**Estimated Time**: 1-2 days

**Next Step After This**: Backend auto-title generation (`ai_client.py`)

---

## Final Concerns & Risks

### High-Risk Areas

**1. Terminal PTY Backend (Go 2)**
- **Risk**: Cross-platform PTY is complex, especially Windows
- **Mitigation**: Use existing libraries (`pty`, `winpty`, or `node-pty`), test early
- **Fallback**: Enhanced command runner with session state
- **Action**: Build PTY backend first in Go 2, validate feasibility within 2-3 days

**2. Data Migration (Go 1)**
- **Risk**: Migration script corrupts data or loses messages
- **Mitigation**: Backup entire `memory/` before migration, extensive testing
- **Fallback**: Manual migration tool if auto-migration fails
- **Action**: Test migration with real project data before rolling out

**3. Fresh Install Stability (Go 4)**
- **Risk**: Packaged app fails on clean machine (missing deps, path issues)
- **Mitigation**: Test on multiple clean VMs, fix incrementally
- **Fallback**: Document manual setup steps if installer fails
- **Action**: Allocate full week for Go 4 with multiple test iterations

### Potentially Overloaded Areas

**Go 2 is the Largest**:
- Terminal + Git + File Tree + Layout = significant scope
- **Mitigation**: Break into sub-phases (2a, 2b, 2c, 2d), each with deliverable
- **Validation**: Test each sub-phase before moving to next
- **Schedule**: Allow 2-3 weeks for Go 2, don't rush

### What Should Not Be Combined

**Confirmed Separation**:
- ✓ Thread migration (Go 1) separate from UX cleanup (Go 3)
- ✓ Terminal backend (Go 2b) separate from Git backend (Go 2c) — stagger within Go 2
- ✓ Monaco integration deferred (not in any go)
- ✓ Self-Upgrade changes (Go 3) isolated from core system changes

### Final Validation Before Starting

**Confirm**:
- [ ] Storage model understood (JSONL + JSON files)
- [ ] FastAPI patterns clear
- [ ] PTY target confirmed (with fallback)
- [ ] Monaco deferred confirmed
- [ ] Git workflow scope confirmed
- [ ] Frontend structure understood

**Ready to Begin**: Yes, all blockers resolved

---

## Summary

**The Plan**:
- **Go 1**: Thread system (1-2 weeks)
- **Go 2**: Code Mode with terminal + git (2-3 weeks)
- **Go 3**: Polish + cleanup (1 week)
- **Go 4**: Packaging + stabilization (1 week)

**Total Estimated Time**: 5-7 weeks

**First Implementation Task**: Backend thread storage model in `chat_store.py`

**Highest Risks**: Terminal PTY (Go 2), data migration (Go 1), fresh install stability (Go 4)

**Deferred Features**: Monaco, advanced git, debugging panel, testing panel, thread advanced features

**Ready to Start**: Yes, proceed with Go 1 backend thread storage implementation.

---

**Awaiting your approval to begin implementation.**
