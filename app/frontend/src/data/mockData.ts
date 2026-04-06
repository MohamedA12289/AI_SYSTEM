export interface Project {
  id: string;
  name: string;
  description: string;
  lastActive: string;
  filesCount: number;
  tasksCount: number;
  status: "active" | "archived";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "planning" | "approval" | "tool" | "status";
  content: string;
  timestamp: string;
  approvalType?: "file-edit" | "command" | "memory-update" | "fetch";
  approvalData?: any;
  toolType?: "command-output" | "file-change" | "ingest" | "snapshot" | "test-result";
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  group: "today" | "yesterday" | "older";
}

export const projects: Project[] = [
  {
    id: "passive-pilot",
    name: "Passive Pilot",
    description: "Automated income stream tracker and portfolio manager",
    lastActive: "2 hours ago",
    filesCount: 24,
    tasksCount: 5,
    status: "active",
  },
  {
    id: "personal-planner",
    name: "Personal Planner",
    description: "AI-powered daily planner with habit tracking",
    lastActive: "Yesterday",
    filesCount: 18,
    tasksCount: 3,
    status: "active",
  },
  {
    id: "code-review-bot",
    name: "Code Review Bot",
    description: "Automated PR review assistant with style enforcement",
    lastActive: "3 days ago",
    filesCount: 12,
    tasksCount: 8,
    status: "active",
  },
];

export const chatHistory: ChatHistoryItem[] = [
  { id: "h1", title: "React state management", preview: "Comparing Zustand vs Redux Toolkit...", timestamp: "10:32 AM", group: "today" },
  { id: "h2", title: "Python async patterns", preview: "How to handle concurrent API calls...", timestamp: "9:15 AM", group: "today" },
  { id: "h3", title: "Docker deployment", preview: "Setting up multi-stage builds...", timestamp: "Yesterday", group: "yesterday" },
  { id: "h4", title: "Database schema design", preview: "Normalizing the user-posts relation...", timestamp: "Yesterday", group: "yesterday" },
  { id: "h5", title: "CSS Grid deep dive", preview: "Complex responsive layouts...", timestamp: "3 days ago", group: "older" },
];

export const generalChatMessages: ChatMessage[] = [
  { id: "g1", role: "user", content: "What's the best way to handle state management in a large React app?", timestamp: "10:32 AM" },
  { id: "g2", role: "assistant", content: "For large React applications, I'd recommend considering these approaches based on your needs:\n\n**Zustand** — Minimal boilerplate, great DX, perfect for most apps.\n**Jotai** — Atomic state model, excellent for derived state.\n**Redux Toolkit** — When you need middleware, time-travel debugging, or have a large team.\n\nFor server state, **TanStack Query** is the gold standard. It handles caching, background refetching, and optimistic updates beautifully.\n\nWould you like me to set up any of these in one of your projects?", timestamp: "10:32 AM" },
  { id: "g3", role: "user", content: "Tell me more about Zustand. How does it compare to Redux Toolkit?", timestamp: "10:45 AM" },
  { id: "g4", role: "assistant", content: "Zustand is significantly simpler:\n\n```typescript\nconst useStore = create((set) => ({\n  count: 0,\n  increment: () => set((s) => ({ count: s.count + 1 })),\n}))\n```\n\nKey differences:\n- **Bundle size**: Zustand ~1KB vs RTK ~11KB\n- **Boilerplate**: Zustand needs no providers, reducers, or actions\n- **DevTools**: Both support Redux DevTools\n- **Middleware**: RTK has more built-in, Zustand is easily extensible\n\nFor most projects under 50 components, Zustand is the better choice.", timestamp: "10:45 AM" },
];

export const projectChatMessages: ChatMessage[] = [
  { id: "p1", role: "user", content: "Let's add a new dashboard page to Passive Pilot that shows portfolio performance over time.", timestamp: "2:15 PM" },
  { id: "p2", role: "planning", content: "I'll create a dashboard with:\n1. Portfolio value chart (line graph)\n2. Asset allocation breakdown (pie chart)\n3. Recent transactions table\n4. Performance metrics cards\n\nThis will require editing 3 files and creating 2 new ones.", timestamp: "2:15 PM" },
  {
    id: "p3", role: "approval", content: "I'd like to edit the following files to add the dashboard:",
    timestamp: "2:16 PM",
    approvalType: "file-edit",
    approvalData: {
      files: [
        { path: "src/pages/Dashboard.tsx", action: "create", additions: 142, deletions: 0 },
        { path: "src/components/PortfolioChart.tsx", action: "create", additions: 87, deletions: 0 },
        { path: "src/App.tsx", action: "modify", additions: 3, deletions: 1 },
      ],
      diff: `+ import Dashboard from './pages/Dashboard'\n  \n  <Route path="/dashboard" element={<Dashboard />} />\n- {/* TODO: add dashboard */}`,
    },
  },
  { id: "p4", role: "user", content: "Looks good, approved!", timestamp: "2:17 PM" },
  { id: "p5", role: "assistant", content: "Dashboard page created successfully.\n\nI've added:\n- `Dashboard.tsx` with responsive grid layout\n- `PortfolioChart.tsx` using Recharts\n- Updated routing in `App.tsx`\n\nThe dashboard now shows a line chart with mock portfolio data. Want me to connect it to real data next?", timestamp: "2:17 PM" },
  {
    id: "p6", role: "approval", content: "I need to run a command to install the recharts dependency:",
    timestamp: "2:18 PM",
    approvalType: "command",
    approvalData: { command: "npm install recharts@2.12.0" },
  },
  {
    id: "p7", role: "tool", content: "Successfully fetched documentation from recharts.org",
    timestamp: "2:18 PM",
    toolType: "command-output",
  },
  {
    id: "p8", role: "approval", content: "Updating project memory with the new dashboard architecture decisions:",
    timestamp: "2:19 PM",
    approvalType: "memory-update",
    approvalData: { key: "dashboard-architecture", value: "Using Recharts for visualization, responsive grid layout, dark theme compatible" },
  },
];

export const projectFiles = [
  { name: "src/App.tsx", size: "2.1 KB", modified: "2 hours ago", type: "tsx" },
  { name: "src/pages/Dashboard.tsx", size: "4.8 KB", modified: "2 hours ago", type: "tsx" },
  { name: "src/pages/Portfolio.tsx", size: "3.2 KB", modified: "Yesterday", type: "tsx" },
  { name: "src/components/PortfolioChart.tsx", size: "2.7 KB", modified: "2 hours ago", type: "tsx" },
  { name: "src/components/TransactionTable.tsx", size: "1.9 KB", modified: "3 days ago", type: "tsx" },
  { name: "src/hooks/usePortfolio.ts", size: "1.1 KB", modified: "Yesterday", type: "ts" },
  { name: "src/utils/formatCurrency.ts", size: "0.4 KB", modified: "Last week", type: "ts" },
  { name: "package.json", size: "1.2 KB", modified: "2 hours ago", type: "json" },
  { name: "tsconfig.json", size: "0.8 KB", modified: "Last week", type: "json" },
];

export const projectSecrets = [
  { key: "ALPHA_VANTAGE_API_KEY", value: "●●●●●●●●●●●●", lastUpdated: "3 days ago" },
  { key: "DATABASE_URL", value: "●●●●●●●●●●●●", lastUpdated: "Last week" },
  { key: "JWT_SECRET", value: "●●●●●●●●●●●●", lastUpdated: "2 weeks ago" },
];

export const projectMemory = [
  { id: "m1", key: "Tech Stack", value: "React + TypeScript + Tailwind + Recharts", pinned: true, timestamp: "Last week" },
  { id: "m2", key: "Architecture", value: "Feature-based folder structure with shared components", pinned: true, timestamp: "Last week" },
  { id: "m3", key: "Dashboard Design", value: "Using Recharts for visualization, responsive grid, dark theme", pinned: false, timestamp: "2 hours ago" },
  { id: "m4", key: "API Integration", value: "Alpha Vantage for stock data, custom REST API for portfolio", pinned: false, timestamp: "Yesterday" },
  { id: "m5", key: "Deployment", value: "Vercel with preview deployments on PR", pinned: false, timestamp: "3 days ago" },
];

export const projectTasks = [
  { id: "t1", title: "Add portfolio performance chart", status: "done" as const },
  { id: "t2", title: "Connect Alpha Vantage API", status: "in-progress" as const },
  { id: "t3", title: "Implement transaction history", status: "todo" as const },
  { id: "t4", title: "Add export to CSV feature", status: "todo" as const },
  { id: "t5", title: "Write unit tests for formatCurrency", status: "todo" as const },
];

export const projectNotes = [
  { id: "n1", content: "Consider using SWR instead of TanStack Query for simpler caching", timestamp: "Yesterday" },
  { id: "n2", content: "Portfolio chart should support 1D, 1W, 1M, 3M, 1Y, ALL timeframes", timestamp: "2 hours ago" },
  { id: "n3", content: "User requested dark mode as default — already implemented", timestamp: "3 days ago" },
];

export const activityLog = [
  { id: "a1", action: "File created", detail: "src/pages/Dashboard.tsx", timestamp: "2 hours ago", type: "file" as const },
  { id: "a2", action: "Command executed", detail: "npm install recharts", timestamp: "2 hours ago", type: "command" as const },
  { id: "a3", action: "Memory updated", detail: "dashboard-architecture", timestamp: "2 hours ago", type: "memory" as const },
  { id: "a4", action: "File modified", detail: "src/App.tsx", timestamp: "2 hours ago", type: "file" as const },
  { id: "a5", action: "Docs fetched", detail: "recharts.org/api/LineChart", timestamp: "2 hours ago", type: "fetch" as const },
  { id: "a6", action: "Snapshot created", detail: "Pre-dashboard backup", timestamp: "Yesterday", type: "snapshot" as const },
];

export const selfUpgradeFiles = [
  { name: "core/agent.py", size: "12.4 KB", modified: "1 hour ago", critical: true },
  { name: "core/planner.py", size: "8.1 KB", modified: "Yesterday", critical: true },
  { name: "core/memory.py", size: "5.3 KB", modified: "2 days ago", critical: true },
  { name: "core/tools.py", size: "6.7 KB", modified: "Last week", critical: false },
  { name: "config/models.yaml", size: "1.2 KB", modified: "3 days ago", critical: false },
  { name: "config/prompts.yaml", size: "3.8 KB", modified: "Yesterday", critical: false },
  { name: "logs/agent.log", size: "45.2 KB", modified: "Just now", critical: false },
  { name: "logs/errors.log", size: "2.1 KB", modified: "1 hour ago", critical: false },
];

export const selfUpgradeMessages: ChatMessage[] = [
  { id: "s1", role: "user", content: "Improve your context window management. You're losing track of earlier conversation context too quickly.", timestamp: "11:00 AM" },
  { id: "s2", role: "planning", content: "⚠ SELF-UPGRADE MODE\n\nI'll modify my own memory management system:\n1. Increase sliding window from 4K to 8K tokens\n2. Add importance-weighted summarization for older context\n3. Implement pinned context that persists across windows\n\nThis touches core agent files. Requesting approval.", timestamp: "11:01 AM" },
  {
    id: "s3", role: "approval", content: "I need to modify core agent files:",
    timestamp: "11:01 AM",
    approvalType: "file-edit",
    approvalData: {
      files: [
        { path: "core/memory.py", action: "modify", additions: 45, deletions: 12 },
        { path: "core/agent.py", action: "modify", additions: 8, deletions: 3 },
        { path: "config/models.yaml", action: "modify", additions: 2, deletions: 1 },
      ],
      diff: `  class MemoryManager:\n-     WINDOW_SIZE = 4096\n+     WINDOW_SIZE = 8192\n+     \n+     def summarize_old_context(self, messages):\n+         \"\"\"Weight messages by importance before summarizing\"\"\"\n+         scored = self._score_importance(messages)\n+         return self._compress(scored)`,
    },
  },
];

export const projectSnapshots = [
  { id: "snap1", note: "Pre-dashboard backup", timestamp: "Yesterday", size: "2.4 MB" },
  { id: "snap2", note: "Initial project setup", timestamp: "Last week", size: "1.1 MB" },
];

export const projectDocuments = [
  { id: "doc1", name: "API Reference.pdf", pages: 45, status: "indexed", timestamp: "2 days ago" },
  { id: "doc2", name: "Architecture Notes.md", pages: 12, status: "indexed", timestamp: "Yesterday" },
  { id: "doc3", name: "Requirements.docx", pages: 8, status: "processing", timestamp: "Just now" },
];
