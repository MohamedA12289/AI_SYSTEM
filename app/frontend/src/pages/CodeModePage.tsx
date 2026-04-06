import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor, { DiffEditor } from "@monaco-editor/react";
import {
  X, Save, MessageSquare, Code2, ChevronRight, Loader2, Send,
  PanelLeft, Search, GitBranch, Play, CheckCircle2, XCircle, AlertCircle,
  FileCode, RefreshCw, Terminal, Map, Target, Zap, HelpCircle, GitCommit,
  Trash2, ShieldCheck, Database, Filter, BookOpen, Plus,
} from "lucide-react";
import { FileTree } from "@/components/FileTree";
import { useProjectBrain } from "@/contexts/ProjectBrainContext";
import { getSessionAiMessages, setSessionAiMessages } from "@/contexts/ProjectBrainContext";
import type { AiMessage } from "@/contexts/ProjectBrainContext";
import { api } from "@/services/api";
import type { AssistantMode } from "@/types";

interface Props {
  assistantMode: AssistantMode;
  isSelfUpgrade?: boolean;
}

type RightPanelTab = "chat" | "diffs" | "approvals" | "git" | "run" | "intel";

interface PendingDiff {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  explanation: string;
  language: string;
  batchId?: string;
}

interface RunOutput {
  id: string;
  label: string;
  output: string;
  status: "running" | "success" | "error";
  errorText?: string;
}

function getLanguage(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java", cs: "csharp",
    cpp: "cpp", c: "c", h: "c", json: "json", yaml: "yaml", yml: "yaml",
    md: "markdown", html: "html", css: "css", scss: "scss", sh: "shell",
    toml: "toml", xml: "xml", sql: "sql", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

function cleanText(input?: string) {
  return String(input ?? "").replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").replace(/\r/g, "").trim();
}

function extractCodeBlocks(text: string): { lang: string; code: string; filePath?: string }[] {
  const blocks: { lang: string; code: string; filePath?: string }[] = [];
  const re = /(?:\/\/\s*File:\s*(.+?)\n)?```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ filePath: m[1]?.trim(), lang: m[2] || "plaintext", code: m[3] });
  }
  return blocks;
}

function StructuredJsonCard({ data, title }: { data: any; title: string }) {
  if (!data || typeof data !== "object") return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2 space-y-1.5 text-[10px]">
      <p className="font-semibold text-foreground">{title}</p>
      {Object.entries(data).map(([k, v]) => {
        if (Array.isArray(v) && v.length === 0) return null;
        if (v === null || v === undefined || v === "") return null;
        return (
          <div key={k}>
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}: </span>
            {Array.isArray(v)
              ? <span className="text-foreground">{(v as any[]).join(", ")}</span>
              : <span className="text-foreground">{String(v)}</span>
            }
          </div>
        );
      })}
    </div>
  );
}

export default function CodeModePage({ assistantMode, isSelfUpgrade }: Props) {
  const { projectId: _routeProjectId } = useParams();
  const brain = useProjectBrain();
  const navigate = useNavigate();
  const {
    projectId, project, openTabs, activeTabPath, openFile, saveFile,
    closeTab, updateTabContent, setActiveTabPath, selectedPaths, setSelectedPaths,
    pendingApprovals, refresh: brainRefresh,
  } = brain;

  const setOpenTabs = brain.setOpenTabs;

  const [treeOpen, setTreeOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightPanelTab>("chat");
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessagesState] = useState<AiMessage[]>(() => getSessionAiMessages(projectId));
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const setAiMessages = useCallback((updater: AiMessage[] | ((prev: AiMessage[]) => AiMessage[])) => {
    setAiMessagesState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSessionAiMessages(projectId, next);
      return next;
    });
  }, [projectId]);

  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([]);
  const [activeDiffId, setActiveDiffId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ path: string; snippet?: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [gitStatus, setGitStatus] = useState<any>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);

  const [tests, setTests] = useState<any[]>([]);
  const [runOutputs, setRunOutputs] = useState<RunOutput[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [cmdRunning, setCmdRunning] = useState(false);

  const [intelMode, setIntelMode] = useState<"map" | "targets" | "wiring" | "contracts" | "state" | "cleanup" | "memory" | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResult, setIntelResult] = useState<any>(null);
  const [intelInput, setIntelInput] = useState("");
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);
  const [memInput, setMemInput] = useState("");
  const [memSaving, setMemSaving] = useState(false);

  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const activeDiff = pendingDiffs.find((d) => d.id === activeDiffId);
  const displayName = project?.display_name || project?.project_name || projectId;
  const isPlanMode = assistantMode === "plan";

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);
  useEffect(() => { if (rightTab === "git" && !gitStatus) loadGitStatus(); }, [rightTab]);
  useEffect(() => { if (rightTab === "run" && tests.length === 0) loadTests(); }, [rightTab]);
  useEffect(() => { if (!searchOpen) return; setTimeout(() => searchInputRef.current?.focus(), 50); }, [searchOpen]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const refreshTree = () => setTreeRefreshKey((v) => v + 1);

  const loadGitStatus = async () => {
    setGitLoading(true);
    try { setGitStatus(await api.github.status(projectId)); }
    catch (e: any) { setGitStatus({ error: cleanText(e?.message || "Git not available") }); }
    finally { setGitLoading(false); }
  };

  const loadTests = async () => {
    setTestsLoading(true);
    try { const res = await api.tests.list(projectId); setTests(res?.tests ?? res?.items ?? []); }
    catch { setTests([]); }
    finally { setTestsLoading(false); }
  };

  const handleSaveActive = async () => {
    if (!activeTab || activeTab.content === undefined) return;
    try { await saveFile(activeTab.path, activeTab.content!); refreshTree(); } catch {}
  };

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
  }, [setSelectedPaths]);

  const buildFileContext = () => {
    const parts: string[] = [];
    if (activeTab) parts.push(`Current file: ${activeTab.path}\n\`\`\`\n${(activeTab.content ?? "").slice(0, 3000)}\n\`\`\``);
    if (selectedPaths.length > 0) parts.push(`Selected files: ${selectedPaths.join(", ")}`);
    if (openTabs.length > 1) parts.push(`Other open: ${openTabs.filter((t) => t.path !== activeTabPath).map((t) => t.path).join(", ")}`);
    return parts.length ? "\n\n" + parts.join("\n\n") : "";
  };

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userText = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", text: userText }]);
    setAiLoading(true);
    try {
      const modeTag = isPlanMode ? "[Plan Mode - structured analysis, no writes]" : "[Build Mode]";
      const ctx = buildFileContext();
      const planExtra = isPlanMode
        ? "\n\nRespond with a structured plan: list impacted files, implementation steps, risks, test plan, recommended next action."
        : "";
      const prompt = `${modeTag} [Code Mode] ${userText}${ctx}${planExtra}`;
      const res = await api.chat.send(projectId, prompt, assistantMode);
      const text = cleanText(res?.assistant_message || res?.response || res?.tool_execution?.message || "Done.");

      if (isPlanMode) {
        setAiMessages((prev) => [...prev, { role: "ai", text }]);
        return;
      }

      const codeBlocks = extractCodeBlocks(text);
      if (codeBlocks.length > 0 && activeTab) {
        const batchId = `batch-${Date.now()}`;
        const newDiffs: PendingDiff[] = [];

        for (let i = 0; i < codeBlocks.length; i++) {
          const block = codeBlocks[i];
          const targetPath = block.filePath || activeTab.path;
          const targetTab = openTabs.find((t) => t.path === targetPath);
          const originalContent = targetTab?.content ?? (block.filePath ? "" : (activeTab.content ?? ""));
          newDiffs.push({
            id: `${batchId}-${i}`,
            filePath: targetPath,
            originalContent,
            proposedContent: block.code,
            explanation: text.replace(/```[\s\S]*?```/g, "").trim().slice(0, 400),
            language: block.lang || getLanguage(targetPath),
            batchId: codeBlocks.length > 1 ? batchId : undefined,
          });
        }

        setPendingDiffs((prev) => [...prev, ...newDiffs]);
        setAiMessages((prev) => [...prev, { role: "ai", text, hasDiff: true, diffId: newDiffs[0].id }]);
        setActiveDiffId(newDiffs[0].id);
        setRightTab("diffs");

        try {
          const memKey = `pattern:${activeTab.path.split("/").pop()}`;
          const memVal = text.replace(/```[\s\S]*?```/g, "").trim().slice(0, 300);
          if (memVal.length > 20) {
            await api.codeAgent.codingMemory(projectId, "write", memKey, memVal, false);
          }
        } catch {}
      } else {
        setAiMessages((prev) => [...prev, { role: "ai", text }]);
      }
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: "ai", text: cleanText(e?.message || "Request failed.") }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyDiff = async (diff: PendingDiff) => {
    if (isPlanMode) return;
    try {
      if (isSelfUpgrade) {
        try { await api.snapshots.create(projectId, `Pre-apply snapshot: ${diff.filePath}`); } catch {}
      }
      await saveFile(diff.filePath, diff.proposedContent);
      setOpenTabs((prev: any) => prev.map((t: any) =>
        t.path === diff.filePath ? { ...t, content: diff.proposedContent, isDirty: false } : t
      ));
      setPendingDiffs((prev) => prev.filter((d) => d.id !== diff.id));
      if (activeDiffId === diff.id) setActiveDiffId(null);
      setAiMessages((prev) => [...prev, { role: "ai", text: `✓ Applied to ${diff.filePath}${isSelfUpgrade ? " (snapshot saved for rollback)" : ""}` }]);
      refreshTree();
      setRightTab("chat");
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: "ai", text: `✗ Apply failed: ${cleanText(e?.message)}` }]);
    }
  };

  const handleApplyBatch = async (batchId: string) => {
    if (isSelfUpgrade) {
      try { await api.snapshots.create(projectId, `Pre-batch snapshot`); } catch {}
    }
    const batch = pendingDiffs.filter((d) => d.batchId === batchId);
    for (const diff of batch) await handleApplyDiff(diff);
  };

  const handleRejectDiff = (diffId: string) => {
    setPendingDiffs((prev) => prev.filter((d) => d.id !== diffId));
    if (activeDiffId === diffId) setActiveDiffId(null);
  };

  const handleRejectBatch = (batchId: string) => {
    setPendingDiffs((prev) => prev.filter((d) => d.batchId !== batchId));
    setActiveDiffId(null);
  };

  const handleApproveBackend = async (approvalId: string) => {
    try { await api.approvals.approve(projectId, approvalId); await brainRefresh(); } catch {}
  };

  const handleRejectBackend = async (approvalId: string) => {
    try { await api.approvals.reject(projectId, approvalId); await brainRefresh(); } catch {}
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.projectSearch.query(projectId, searchQuery.trim());
      setSearchResults(res.results ?? []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  };

  const handleRunTest = async (test: any) => {
    const outId = `run-${Date.now()}`;
    setRunOutputs((prev) => [...prev, { id: outId, label: test.title, output: "Running…", status: "running" }]);
    try {
      const res = await api.tests.run(projectId, test.id);
      const output = cleanText(res?.output || res?.stdout || res?.result || "Done.");
      const success = res?.exit_code === 0 || res?.status === "passed" || res?.passed === true;
      setRunOutputs((prev) => prev.map((r) => r.id === outId
        ? { ...r, output, status: success ? "success" : "error", errorText: success ? undefined : output }
        : r
      ));
    } catch (e: any) {
      const errorText = cleanText(e?.message || "Failed");
      setRunOutputs((prev) => prev.map((r) => r.id === outId ? { ...r, output: errorText, status: "error", errorText } : r));
    }
  };

  const handleWhyFailing = async (errorText: string) => {
    setAiLoading(true);
    setRightTab("chat");
    setAiMessages((prev) => [...prev, { role: "user", text: `Why is this failing?\n${errorText.slice(0, 300)}` }]);
    try {
      const res = await api.codeAgent.whyFailing(projectId, errorText, activeTab ? [activeTab.path] : []);
      const diag = res?.diagnosis;
      const text = diag
        ? `Likely cause: ${diag.likely_cause || "unknown"}\nFiles: ${(diag.likely_files || []).join(", ") || "unknown"}\nFix: ${diag.suggested_fix || "N/A"}\nSteps: ${(diag.debug_steps || []).join(" → ")}`
        : cleanText(res?.raw || "No diagnosis available.");
      setAiMessages((prev) => [...prev, { role: "ai", text }]);
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: "ai", text: cleanText(e?.message || "Diagnosis failed") }]);
    } finally { setAiLoading(false); }
  };

  const handleRunCommand = () => {
    const raw = cmdInput.trim();
    if (!raw || cmdRunning) return;
    const parts = raw.split(/\s+/);
    setCmdRunning(true);
    const outId = `cmd-${Date.now()}`;
    setRunOutputs((prev) => [...prev, { id: outId, label: raw, output: "", status: "running" }]);
    setCmdInput("");

    api.command.stream(
      projectId,
      parts,
      (line) => {
        setRunOutputs((prev) => prev.map((r) => r.id === outId ? { ...r, output: r.output + line + "\n" } : r));
      },
      (exitCode) => {
        const success = exitCode === 0;
        setRunOutputs((prev) => prev.map((r) => {
          if (r.id !== outId) return r;
          const output = r.output || "Done.";
          return { ...r, output, status: success ? "success" : "error", errorText: success ? undefined : output };
        }));
        if (!success) {
          setRunOutputs((prev) => {
            const r = prev.find((x) => x.id === outId);
            if (r) {
              setAiMessages((msgs) => [...msgs, {
                role: "ai",
                text: `Command "${raw}" failed (exit ${exitCode}). Use "Why failing?" to diagnose.`
              }]);
            }
            return prev;
          });
        }
        setCmdRunning(false);
      },
      (err) => {
        setRunOutputs((prev) => prev.map((r) => r.id === outId ? { ...r, output: cleanText(err), status: "error", errorText: cleanText(err) } : r));
        setCmdRunning(false);
      }
    );
  };

  const handleCommit = async () => {
    if (!commitMsg.trim() || committing) return;
    setCommitting(true);
    try {
      await api.github.commit(projectId, commitMsg.trim());
      setCommitMsg("");
      await loadGitStatus();
      setAiMessages((prev) => [...prev, { role: "ai", text: `✓ Committed: "${commitMsg.trim()}"` }]);
    } catch (e: any) {
      setAiMessages((prev) => [...prev, { role: "ai", text: `✗ Commit failed: ${cleanText(e?.message)}` }]);
    } finally { setCommitting(false); }
  };

  const handleIntel = async (mode: typeof intelMode) => {
    setIntelMode(mode);
    setIntelLoading(true);
    setIntelResult(null);
    try {
      let res: any;
      if (mode === "map") res = await api.codeAgent.workspaceMap(projectId, intelInput);
      else if (mode === "targets") res = await api.codeAgent.fileTargets(projectId, intelInput || "Analyze this project", activeTab ? [activeTab.path] : []);
      else if (mode === "wiring") res = await api.codeAgent.wiringTrace(projectId, intelInput || "main feature", activeTab?.path ?? "");
      else if (mode === "contracts") res = await api.codeAgent.apiContracts(projectId);
      else if (mode === "state") res = await api.codeAgent.projectState(projectId, intelInput);
      else if (mode === "cleanup") res = await api.codeAgent.cleanupScan(projectId);
      else if (mode === "memory") {
        const r = await api.codeAgent.codingMemory(projectId, "read");
        setMemoryEntries(r.entries ?? []);
        res = r;
      }
      setIntelResult(res);
    } catch (e: any) {
      setIntelResult({ error: cleanText(e?.message || "Failed") });
    } finally { setIntelLoading(false); }
  };

  const handleReIndex = async () => {
    try {
      await api.index.trigger(projectId);
      setAiMessages((prev) => [...prev, { role: "ai", text: "Re-indexing started in background." }]);
    } catch {}
  };

  const handleDeleteJunk = async (path: string) => {
    setDeletingPath(path);
    try {
      await api.files.delete(projectId, path);
      setIntelResult((prev: any) => ({
        ...prev,
        junk_items: (prev?.junk_items ?? []).filter((item: any) => item.path !== path),
        count: Math.max(0, (prev?.count ?? 1) - 1),
      }));
      refreshTree();
    } catch { } finally { setDeletingPath(null); }
  };

  const handleMemorySave = async () => {
    if (!memInput.trim()) return;
    setMemSaving(true);
    try {
      const key = `mem_${Date.now()}`;
      await api.codeAgent.codingMemory(projectId, "write", key, memInput.trim(), false);
      setMemInput("");
      const r = await api.codeAgent.codingMemory(projectId, "read");
      setMemoryEntries(r.entries ?? []);
    } catch { } finally { setMemSaving(false); }
  };

  const switchToChat = () => {
    if (isSelfUpgrade) navigate("/self-upgrade/chat");
    else navigate(`/project/${projectId}/chat`);
  };

  const batchIds = [...new Set(pendingDiffs.filter((d) => d.batchId).map((d) => d.batchId!))];
  const singleDiffs = pendingDiffs.filter((d) => !d.batchId);

  const RIGHT_TABS: { id: RightPanelTab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "diffs", label: `Diffs${pendingDiffs.length ? ` (${pendingDiffs.length})` : ""}` },
    { id: "approvals", label: `Approvals${pendingApprovals.length ? ` (${pendingApprovals.length})` : ""}` },
    { id: "git", label: "Git" },
    { id: "run", label: "Run" },
    { id: "intel", label: "Intel" },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {searchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="Search files and content… (Enter)"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {searchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {searchResults.length === 0 && !searchLoading && searchQuery && (
                <p className="text-[12px] text-muted-foreground px-4 py-3">No results.</p>
              )}
              {searchResults.map((r, i) => (
                <div key={i} onClick={() => { openFile(r.path, r.path.split("/").pop()!); setSearchOpen(false); }}
                  className="flex flex-col px-4 py-2.5 cursor-pointer hover:bg-secondary border-b border-border/50 last:border-0">
                  <span className="text-[12px] text-foreground font-mono">{r.path}</span>
                  {r.snippet && <span className="text-[11px] text-muted-foreground truncate mt-0.5">{r.snippet}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-background shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setTreeOpen((v) => !v)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><PanelLeft className="w-4 h-4" /></button>
          <Code2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">— Code Mode</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isPlanMode ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"}`}>
            {isPlanMode ? "PLAN" : "BUILD"}
          </span>
          {selectedPaths.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{selectedPaths.length} selected</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={refreshTree} className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Refresh file tree"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => setSearchOpen(true)} className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Search (Ctrl+P)"><Search className="w-3.5 h-3.5" /></button>
          {activeTab?.isDirty && (
            <button onClick={handleSaveActive} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary/10 text-primary hover:bg-primary/20">
              <Save className="w-3 h-3" /> Save
            </button>
          )}
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-[11px]">
            <button onClick={switchToChat} className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground hover:bg-secondary">
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-foreground font-medium">
              <Code2 className="w-3 h-3" /> Code
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {treeOpen && (
          <div className="w-52 border-r border-border bg-background flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explorer</span>
              {selectedPaths.length > 0 && (
                <button onClick={() => setSelectedPaths([])} className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-secondary">Clear</button>
              )}
            </div>
            <FileTree key={treeRefreshKey} projectId={projectId} onOpenFile={openFile} activeTabPath={activeTabPath} selectedPaths={selectedPaths} onToggleSelect={handleToggleSelect} />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {openTabs.length > 0 && (
            <div className="flex items-center border-b border-border bg-background overflow-x-auto scrollbar-thin shrink-0">
              {openTabs.map((tab) => (
                <div key={tab.path} onClick={() => setActiveTabPath(tab.path)}
                  className={`flex items-center gap-2 px-3 py-1.5 border-r border-border cursor-pointer shrink-0 group text-[12px] ${activeTabPath === tab.path ? "bg-card text-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                  <span className="truncate max-w-[120px]">{tab.name}</span>
                  {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }} className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {activeDiff ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-amber-500/5 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-mono text-foreground">{activeDiff.filePath}</span>
                    <span className="text-[10px] text-amber-400">diff preview</span>
                    {activeDiff.batchId && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">batch</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setActiveDiffId(null)} className="text-[11px] px-2 py-0.5 rounded hover:bg-secondary text-muted-foreground">← Editor</button>
                    {!isPlanMode && (
                      <>
                        <button onClick={() => handleApplyDiff(activeDiff)} className="text-[11px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />Apply
                        </button>
                        {activeDiff.batchId && (
                          <button onClick={() => handleApplyBatch(activeDiff.batchId!)} className="text-[11px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30">
                            Apply All
                          </button>
                        )}
                        <button onClick={() => handleRejectDiff(activeDiff.id)} className="text-[11px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">
                          <XCircle className="w-3 h-3 inline mr-1" />Reject
                        </button>
                      </>
                    )}
                    {isPlanMode && <span className="text-[10px] text-amber-400">Plan mode — apply disabled</span>}
                  </div>
                </div>
                {activeDiff.explanation && (
                  <div className="px-3 py-1 border-b border-border bg-muted/20 shrink-0">
                    <p className="text-[10px] text-muted-foreground">{activeDiff.explanation.slice(0, 200)}</p>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <DiffEditor height="100%" original={activeDiff.originalContent} modified={activeDiff.proposedContent} language={activeDiff.language} theme="vs-dark"
                    options={{ fontSize: 12, minimap: { enabled: false }, scrollBeyondLastLine: false, readOnly: true, renderSideBySide: true }} />
                </div>
              </div>
            ) : activeTab ? (
              <Editor height="100%" language={getLanguage(activeTab.path)} value={activeTab.content ?? ""} theme="vs-dark"
                onChange={(value) => updateTabContent(activeTab.path, value ?? "")}
                options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false, renderWhitespace: "none", padding: { top: 12 }, automaticLayout: true }} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Code2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-[13px]">Open a file from the explorer</p>
                  <p className="text-[11px] mt-1 opacity-60">Ctrl+Click to multi-select · Ctrl+P to search</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {aiPanelOpen && (
          <div className="w-80 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
              <div className="flex gap-0.5 overflow-x-auto scrollbar-thin flex-wrap">
                {RIGHT_TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setRightTab(tab.id)}
                    className={`px-2 py-0.5 text-[10px] rounded font-medium whitespace-nowrap transition-colors ${rightTab === tab.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setAiPanelOpen(false)} className="p-0.5 rounded hover:bg-secondary text-muted-foreground shrink-0">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {rightTab === "chat" && (
              <>
                {(activeTab || selectedPaths.length > 0) && (
                  <div className="px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
                    {activeTab && <p className="text-[10px] text-muted-foreground truncate">Active: <span className="text-foreground font-mono">{activeTab.name}</span></p>}
                    {selectedPaths.length > 0 && <p className="text-[10px] text-muted-foreground">Selected: <span className="text-foreground">{selectedPaths.length} file(s)</span></p>}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                  {aiMessages.length === 0 && (
                    <div className="space-y-1.5 py-2">
                      <p className="text-[11px] text-muted-foreground text-center">{isPlanMode ? "Plan mode: structured analysis only." : "Ask AI to explain, plan, or propose patches."}</p>
                      {["Explain this file", "Propose a patch", "What should I fix?", "Analyze selected files"].map((s) => (
                        <button key={s} onClick={() => setAiInput(s)} className="w-full text-left text-[10px] px-2 py-1.5 rounded border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                  {aiMessages.map((m, i) => (
                    <div key={i} className={`rounded-lg p-2 text-[11px] ${m.role === "user" ? "bg-primary/10 text-foreground ml-4" : "bg-secondary text-foreground mr-4"}`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      {m.hasDiff && m.diffId && pendingDiffs.find((d) => d.id === m.diffId) && (
                        <button onClick={() => { setActiveDiffId(m.diffId!); setRightTab("diffs"); }} className="mt-1.5 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25">View Diff →</button>
                      )}
                    </div>
                  ))}
                  {aiLoading && <div className="bg-secondary rounded-lg p-2 mr-4"><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /></div>}
                  <div ref={aiEndRef} />
                </div>
                <div className="p-2 border-t border-border shrink-0">
                  {aiMessages.length > 0 && (
                    <button onClick={() => setAiMessages([])} className="w-full text-[9px] text-muted-foreground hover:text-foreground mb-1 text-right">Clear history</button>
                  )}
                  <div className="flex gap-1">
                    <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
                      placeholder={isPlanMode ? "Ask AI to analyze or plan…" : "Ask AI to explain, edit, or patch…"} rows={2}
                      className="flex-1 resize-none bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
                    <button onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()} className="self-end p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {rightTab === "diffs" && (
              <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                {pendingDiffs.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">No pending diffs.</p>}

                {batchIds.map((batchId) => {
                  const batch = pendingDiffs.filter((d) => d.batchId === batchId);
                  return (
                    <div key={batchId} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-amber-400">Batch ({batch.length} files)</span>
                        {!isPlanMode && (
                          <div className="flex gap-1">
                            <button onClick={() => handleApplyBatch(batchId)} className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25">Apply All</button>
                            <button onClick={() => handleRejectBatch(batchId)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">Reject All</button>
                          </div>
                        )}
                      </div>
                      {batch.map((diff) => (
                        <div key={diff.id} className="rounded border border-border p-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-foreground truncate">{diff.filePath.split("/").pop()}</span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setActiveDiffId(diff.id); }} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-foreground">Preview</button>
                            {!isPlanMode && <button onClick={() => handleApplyDiff(diff)} className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">Apply</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {singleDiffs.map((diff) => (
                  <div key={diff.id} className={`rounded-lg border p-2 space-y-1.5 ${activeDiffId === diff.id ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-foreground truncate">{diff.filePath.split("/").pop()}</span>
                    </div>
                    {diff.explanation && <p className="text-[10px] text-muted-foreground line-clamp-2">{diff.explanation}</p>}
                    <div className="flex gap-1.5">
                      <button onClick={() => setActiveDiffId(activeDiffId === diff.id ? null : diff.id)} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground">{activeDiffId === diff.id ? "Hide" : "Preview"}</button>
                      {!isPlanMode && (
                        <>
                          <button onClick={() => handleApplyDiff(diff)} className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25">Apply</button>
                          <button onClick={() => handleRejectDiff(diff.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "approvals" && (
              <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Backend approvals</span>
                  <button onClick={brainRefresh} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><RefreshCw className="w-3 h-3" /></button>
                </div>
                {pendingApprovals.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">No pending approvals.</p>}
                {pendingApprovals.map((a) => {
                  const type = a.approval_type || "approval";
                  const typeColor = type.includes("write") || type.includes("file") ? "text-amber-400" : type.includes("command") ? "text-red-400" : type.includes("snapshot") ? "text-blue-400" : "text-muted-foreground";
                  return (
                    <div key={a.id} className="rounded-lg border border-border p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`w-3.5 h-3.5 ${typeColor} shrink-0`} />
                        <span className={`text-[11px] font-medium ${typeColor} capitalize`}>{type.replace(/_/g, " ")}</span>
                      </div>
                      {(a as any).description && <p className="text-[10px] text-muted-foreground">{(a as any).description}</p>}
                      {(a as any).payload?.path && <p className="text-[10px] text-muted-foreground font-mono">{(a as any).payload.path}</p>}
                      {(a as any).payload?.command && <p className="text-[10px] text-muted-foreground font-mono">{Array.isArray((a as any).payload.command) ? (a as any).payload.command.join(" ") : (a as any).payload.command}</p>}
                      <div className="flex gap-1.5">
                        <button onClick={() => handleApproveBackend(a.id)} disabled={isPlanMode} className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-40">Approve</button>
                        <button onClick={() => handleRejectBackend(a.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {rightTab === "git" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                  <div className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Git Status</span></div>
                  <button onClick={loadGitStatus} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><RefreshCw className={`w-3 h-3 ${gitLoading ? "animate-spin" : ""}`} /></button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                  {gitLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto mt-4" />}
                  {gitStatus?.error && <div className="rounded-lg border border-border p-2"><p className="text-[11px] text-muted-foreground">{gitStatus.error}</p></div>}
                  {gitStatus && !gitStatus.error && (
                    <div className="space-y-2">
                      {gitStatus.branch && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <GitBranch className="w-3.5 h-3.5 text-primary" />
                          <span className="text-foreground font-mono">{gitStatus.branch}</span>
                        </div>
                      )}
                      {gitStatus.is_dirty !== undefined && (
                        <div className={`text-[10px] px-2 py-1 rounded ${gitStatus.is_dirty ? "bg-amber-500/10 text-amber-400" : "bg-green-500/10 text-green-400"}`}>
                          {gitStatus.is_dirty ? "Uncommitted changes" : "Working tree clean"}
                        </div>
                      )}
                      {gitStatus.changed_files?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-semibold">Changed:</p>
                          {gitStatus.changed_files.map((f: string, i: number) => (
                            <div key={i} className="text-[10px] font-mono text-amber-300/80 truncate">{f}</div>
                          ))}
                        </div>
                      )}
                      {gitStatus.last_commit && (
                        <div className="rounded border border-border p-2">
                          <p className="text-[10px] text-muted-foreground">Last commit:</p>
                          <p className="text-[10px] text-foreground font-mono truncate">{gitStatus.last_commit.message || gitStatus.last_commit}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!isPlanMode && (
                  <div className="p-2 border-t border-border shrink-0 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-semibold">Commit</p>
                    <input value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); }}
                      placeholder="Commit message…"
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
                    <button onClick={handleCommit} disabled={!commitMsg.trim() || committing}
                      className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 text-[11px] disabled:opacity-40">
                      {committing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCommit className="w-3 h-3" />}
                      Commit
                    </button>
                  </div>
                )}
              </div>
            )}

            {rightTab === "run" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
                  <span className="text-[10px] text-muted-foreground">Tests & Commands</span>
                  <button onClick={loadTests} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><RefreshCw className={`w-3 h-3 ${testsLoading ? "animate-spin" : ""}`} /></button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                  {testsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto mt-4" />}
                  {!testsLoading && tests.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-2">No tests defined.</p>}
                  {tests.map((test) => (
                    <div key={test.id} className="rounded-lg border border-border p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground">{test.title}</span>
                        <button onClick={() => handleRunTest(test)} disabled={isPlanMode}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40">
                          <Play className="w-3 h-3" /> Run
                        </button>
                      </div>
                      {test.command && <p className="text-[10px] font-mono text-muted-foreground">{Array.isArray(test.command) ? test.command.join(" ") : test.command}</p>}
                    </div>
                  ))}

                  {runOutputs.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-semibold">Output</p>
                        <button onClick={() => setRunOutputs([])} className="text-[9px] text-muted-foreground hover:text-foreground">Clear</button>
                      </div>
                      {runOutputs.map((r) => (
                        <div key={r.id} className={`rounded border p-1.5 ${r.status === "success" ? "border-green-500/30 bg-green-500/5" : r.status === "error" ? "border-red-500/30 bg-red-500/5" : "border-border"}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {r.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            {r.status === "success" && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                            {r.status === "error" && <XCircle className="w-3 h-3 text-red-400" />}
                            <span className="text-[10px] text-foreground truncate">{r.label}</span>
                          </div>
                          <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto scrollbar-thin">{r.output}</pre>
                          {r.status === "error" && r.errorText && (
                            <button onClick={() => handleWhyFailing(r.errorText!)} className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25">Why failing? →</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!isPlanMode && (
                  <div className="p-2 border-t border-border shrink-0 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Terminal className="w-3 h-3" /> Ad-hoc command</p>
                    <div className="flex gap-1">
                      <input value={cmdInput} onChange={(e) => setCmdInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRunCommand(); }}
                        placeholder="python manage.py …"
                        className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
                      <button onClick={handleRunCommand} disabled={!cmdInput.trim() || cmdRunning} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40">
                        {cmdRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground">Allowed: {["python", "node", "npm", "npx", "git", "pytest"].join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            {rightTab === "intel" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-2 py-1.5 border-b border-border shrink-0">
                  <p className="text-[10px] text-muted-foreground font-semibold mb-1.5">Workspace Intelligence</p>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { id: "map", icon: Map, label: "Map" },
                      { id: "targets", icon: Target, label: "Targets" },
                      { id: "wiring", icon: Zap, label: "Wiring" },
                      { id: "contracts", icon: ShieldCheck, label: "Contracts" },
                      { id: "state", icon: Database, label: "State" },
                      { id: "cleanup", icon: Trash2, label: "Cleanup" },
                      { id: "memory", icon: BookOpen, label: "Memory" },
                    ] as const).map(({ id, icon: Icon, label }) => (
                      <button key={id} onClick={() => handleIntel(id as any)}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded border text-[10px] transition-colors ${intelMode === id ? "border-primary/50 bg-primary/10 text-primary" : "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                  {(intelMode === "map" || intelMode === "targets" || intelMode === "wiring" || intelMode === "state" || intelMode === "memory") && (
                    <input value={intelInput} onChange={(e) => setIntelInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleIntel(intelMode); }}
                      placeholder={intelMode === "map" ? "Focus area (optional)…" : intelMode === "targets" ? "Task description…" : intelMode === "wiring" ? "Feature to trace…" : "Focus (optional)…"}
                      className="mt-1.5 w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
                  )}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                  {intelLoading && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!intelLoading && intelResult && (
                    <>
                      {intelResult.error && <p className="text-[11px] text-red-400">{intelResult.error}</p>}
                      {intelMode === "map" && intelResult.analysis && <StructuredJsonCard data={intelResult.analysis} title="Workspace Map" />}
                      {intelMode === "targets" && intelResult.targets && <StructuredJsonCard data={intelResult.targets} title="File Targets" />}
                      {intelMode === "wiring" && intelResult.trace && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-foreground">Wiring trace: {intelResult.feature}</p>
                          {(intelResult.trace.chain || []).map((step: any, i: number) => (
                            <div key={i} className="rounded border border-border p-1.5">
                              <p className="text-[10px] font-mono text-primary">{step.layer}</p>
                              <p className="text-[10px] text-foreground">{step.file} — {step.symbol}</p>
                              {step.notes && <p className="text-[9px] text-muted-foreground">{step.notes}</p>}
                            </div>
                          ))}
                          {intelResult.trace.gaps?.length > 0 && (
                            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5">
                              <p className="text-[10px] text-amber-400 font-semibold">Gaps:</p>
                              {intelResult.trace.gaps.map((g: string, i: number) => <p key={i} className="text-[10px] text-muted-foreground">{g}</p>)}
                            </div>
                          )}
                        </div>
                      )}
                      {intelMode === "contracts" && intelResult.analysis && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-muted-foreground">{intelResult.analysis.summary}</p>
                          {(intelResult.analysis.issues || []).map((issue: any, i: number) => (
                            <div key={i} className={`rounded border p-1.5 ${issue.severity === "high" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                              <p className={`text-[10px] font-semibold ${issue.severity === "high" ? "text-red-400" : "text-amber-400"}`}>{issue.type}</p>
                              <p className="text-[10px] text-muted-foreground">{issue.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {intelMode === "state" && intelResult.state && <StructuredJsonCard data={intelResult.state} title="Project State" />}
                      {intelMode === "cleanup" && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-muted-foreground">{intelResult.count} junk item(s) found</p>
                          {(intelResult.junk_items || []).map((item: any, i: number) => (
                            <div key={i} className="rounded border border-border p-1.5 flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="text-[10px] font-mono text-amber-300/80 truncate">{item.path}</p>
                                <p className="text-[9px] text-muted-foreground">{item.type} · {item.size > 0 ? `${(item.size / 1024).toFixed(1)}kb` : "dir"}</p>
                              </div>
                              <button onClick={() => handleDeleteJunk(item.path)} disabled={deletingPath === item.path}
                                className="shrink-0 p-0.5 rounded hover:bg-red-500/20 text-red-400/70 hover:text-red-400 disabled:opacity-40">
                                {deletingPath === item.path ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              </button>
                            </div>
                          ))}
                          {intelResult.note && <p className="text-[9px] text-muted-foreground italic">{intelResult.note}</p>}
                        </div>
                      )}
                      {intelMode === "memory" && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground font-semibold">Coding Memory — {memoryEntries.length} entries</p>
                          {memoryEntries.length === 0 && <p className="text-[11px] text-muted-foreground">No memory entries yet.</p>}
                          {memoryEntries.map((entry: any, i: number) => (
                            <div key={i} className="rounded border border-border p-1.5">
                              <p className="text-[10px] font-mono text-primary/80 truncate">{entry.key}</p>
                              <p className="text-[10px] text-foreground whitespace-pre-wrap">{entry.value}</p>
                              {entry.pinned && <span className="text-[9px] text-amber-400">pinned</span>}
                            </div>
                          ))}
                          <div className="flex gap-1 pt-1">
                            <input value={memInput} onChange={(e) => setMemInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleMemorySave(); }}
                              placeholder="Add memory note…"
                              className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30" />
                            <button onClick={handleMemorySave} disabled={!memInput.trim() || memSaving}
                              className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40">
                              {memSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!intelLoading && !intelResult && (
                    <div className="py-4 text-center space-y-2">
                      <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground/30" />
                      <p className="text-[11px] text-muted-foreground">Select an intelligence tool above.</p>
                      <div className="text-[10px] text-muted-foreground space-y-1 text-left">
                        <p><span className="text-foreground">Map</span> — analyze project structure</p>
                        <p><span className="text-foreground">Targets</span> — which files to touch for a task</p>
                        <p><span className="text-foreground">Wiring</span> — trace a feature front→back</p>
                        <p><span className="text-foreground">Contracts</span> — detect API mismatches</p>
                        <p><span className="text-foreground">State</span> — current project state summary</p>
                        <p><span className="text-foreground">Cleanup</span> — find junk/backup files</p>
                        <p><span className="text-foreground">Memory</span> — persistent coding notes</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!aiPanelOpen && (
          <button onClick={() => setAiPanelOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground transition-colors z-10">
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
