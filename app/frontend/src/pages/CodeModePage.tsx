import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  MessageCircle, Loader2,
  Files, Search, GitBranch, Bug, Puzzle, TestTube,
  Settings2, Plus, MoreHorizontal, X, Play, Square, CheckCircle2, XCircle, AlertCircle, RefreshCw, Cpu, Zap, FlaskConical, Terminal as TerminalIcon
} from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/ModeToggle";
import { ModelSelector } from "@/components/ModelSelector";
import MenuBar from "@/components/MenuBar/MenuBar";
import FileTree from "@/components/FileTree";
import SplitEditorView from "@/components/Editor/SplitEditorView";
import TerminalPanel from "@/components/Terminal/TerminalPanel";
import TerminalTabs from "@/components/Terminal/TerminalTabs";
import SearchPanel, { SearchOptions, SearchMatch } from "@/components/Search/SearchPanel";
import GitPanel from "@/components/Git/GitPanel";
import ProblemsPanel, { Problem } from "@/components/Problems/ProblemsPanel";
import OutputPanel, { OutputEntry } from "@/components/Output/OutputPanel";
import PanelTabs, { PanelType } from "@/components/Panel/PanelTabs";
import StatusBar from "@/components/StatusBar/StatusBar";
import { ChatMessage as ChatMessageComponent } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import CommandPalette from "@/components/CommandPalette/CommandPalette";
import QuickOpen from "@/components/QuickOpen/QuickOpen";
import GoToLine from "@/components/GoToLine/GoToLine";
import SymbolSearch from "@/components/SymbolSearch/SymbolSearch";
import BranchSwitcher from "@/components/BranchSwitcher/BranchSwitcher";
import ResizablePanel from "@/components/ResizablePanel/ResizablePanel";
import { api, isoToTime } from "@/services/api";
import { CommandRegistry } from "@/services/CommandRegistry";
import { KeybindingRegistry } from "@/services/KeybindingRegistry";
import { LayoutStateManager } from "@/services/LayoutStateManager";
import { EditorGroupManager } from "@/services/EditorGroupManager";
import { TerminalManager, Terminal } from "@/services/TerminalManager";
import { SettingsManager } from "@/services/SettingsManager";
import { ThemeManager } from "@/services/ThemeManager";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MenuActionsProvider } from "@/contexts/MenuActionsContext";
import { getActiveThreadId, setActiveThreadId } from "@/contexts/ProjectBrainContext";
import type { ChatMessage as ChatMessageType } from "@/types";

interface Props {
  isSelfUpgrade?: boolean;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

const activityBarItems = [
  { id: "explorer", icon: Files, label: "Explorer" },
  { id: "search", icon: Search, label: "Search" },
  { id: "git", icon: GitBranch, label: "Source Control" },
  { id: "debug", icon: Bug, label: "Run & Debug" },
  { id: "extensions", icon: Puzzle, label: "Extensions" },
  { id: "testing", icon: TestTube, label: "Testing" },
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

function stripUserContext(content: string): string {
  if (content.includes('[USER MESSAGE]:')) {
    const match = content.match(/\[USER MESSAGE\]:\s*([\s\S]*?)(?:\n\n\[AVAILABLE FILES IN PROJECT\][\s\S]*)?$/);
    if (match) return match[1].trim();
  }
  if (content.includes('[CONTEXT:') || content.includes('[AVAILABLE FILES IN PROJECT]')) {
    const parts = content.split('\n\n');
    const userParts = parts.filter(p => !p.startsWith('[CONTEXT:') && !p.startsWith('[FILE CONTENT') && !p.startsWith('[AVAILABLE FILES'));
    if (userParts.length > 0) return userParts.join('\n\n').trim();
  }
  return content;
}

function toChatMessages(items: any[]): ChatMessageType[] {
  return (items ?? []).map((m) => {
    const role = m.message_type === "approval"
      ? "approval"
      : m.message_type === "tool_result"
        ? "tool"
        : (m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user");

    const rawContent = m.content || "";
    const displayContent = role === "user" ? stripUserContext(rawContent) : rawContent;

    return {
      id: m.id,
      role,
      content: cleanDisplayText(displayContent),
      timestamp: isoToTime(m.timestamp),
      approvalId: m.metadata?.approval_id,
      approvalType: m.metadata?.approval_type,
      approvalData: m.metadata?.payload,
    } as ChatMessageType;
  });
}

export default function CodeModePage({ isSelfUpgrade }: Props) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = isSelfUpgrade ? "self_upgrade" : projectId || "unknown";

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [activeSidebar, setActiveSidebar] = useState<string>("explorer");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [terminalPanelOpen, setTerminalPanelOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [allThreads, setAllThreads] = useState<any[]>([]);
  const [threadListVisible, setThreadListVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [gitBranch, setGitBranch] = useState<string>("main");
  const [isSearching, setIsSearching] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [goToLineVisible, setGoToLineVisible] = useState(false);
  const [symbolSearchVisible, setSymbolSearchVisible] = useState(false);
  const [branchSwitcherVisible, setBranchSwitcherVisible] = useState(false);
  const [allFilePaths, setAllFilePaths] = useState<string[]>([]);

  const [terminals, setTerminals] = useState<Terminal[]>(TerminalManager.getTerminals());
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(TerminalManager.getActiveTerminalId());

  const [activePanel, setActivePanel] = useState<PanelType>("terminal");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [outputEntries, setOutputEntries] = useState<OutputEntry[]>([]);
  const [zoomLevel, setZoomLevel] = useState(SettingsManager.get('workbench.zoomLevel'));
  const [theme, setTheme] = useState(SettingsManager.get('workbench.colorTheme'));
  const [openFolderDialogVisible, setOpenFolderDialogVisible] = useState(false);
  const [openFolderPath, setOpenFolderPath] = useState('');
  const [openFolderLoading, setOpenFolderLoading] = useState(false);
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { passed: boolean; output: string }>>({});
  const [addTestVisible, setAddTestVisible] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestCommand, setNewTestCommand] = useState('');
  const [debugRunning, setDebugRunning] = useState(false);
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  const cancelDebugRef = useRef<(() => void) | null>(null);

  const [newFileDialogVisible, setNewFileDialogVisible] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderDialogVisible, setNewFolderDialogVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [inlineEditVisible, setInlineEditVisible] = useState(false);
  const [inlineEditQuery, setInlineEditQuery] = useState('');
  const [inlineEditLoading, setInlineEditLoading] = useState(false);
  const inlineEditRef = useRef<HTMLInputElement>(null);

  const layoutState = LayoutStateManager.load();
  const [sidebarWidth, setSidebarWidth] = useState(layoutState.sidebarWidth);
  const [panelHeight, setPanelHeight] = useState(layoutState.panelHeight);
  const [chatPanelWidth, setChatPanelWidth] = useState(layoutState.chatPanelWidth);

  const editorRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribeEditorGroup = EditorGroupManager.onChange(() => {
      const activeGroup = EditorGroupManager.getActiveGroup();
      if (activeGroup) {
        const mappedFiles: OpenFile[] = activeGroup.tabs.map(tab => {
          const existingFile = openFiles.find(f => f.path === tab.path);
          return existingFile || {
            path: tab.path,
            name: tab.name,
            content: '',
            isDirty: tab.isDirty
          };
        });
        setOpenFiles(mappedFiles);
        setActiveFilePath(activeGroup.activeTabPath);
      }
    });

    const unsubscribeTerminal = TerminalManager.onChange(() => {
      setTerminals(TerminalManager.getTerminals());
      setActiveTerminalId(TerminalManager.getActiveTerminalId());
    });

    return () => {
      unsubscribeEditorGroup();
      unsubscribeTerminal();
    };
  }, []);

  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}`;
    if (theme === 'light' || theme === 'dark' || theme === 'high-contrast') {
      ThemeManager.setTheme(theme);
    }

    const unsubscribeSettings = SettingsManager.onChange((settings) => {
      const newZoom = settings['workbench.zoomLevel'];
      if (newZoom !== undefined && newZoom !== zoomLevel) {
        setZoomLevel(newZoom);
        document.body.style.zoom = `${newZoom}`;
      }

      const newTheme = settings['workbench.colorTheme'];
      if (newTheme !== undefined && newTheme !== theme) {
        setTheme(newTheme);
        if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'high-contrast') {
          ThemeManager.setTheme(newTheme);
        }
      }
    });

    return () => {
      unsubscribeSettings();
    };
  }, [zoomLevel, theme]);

  useEffect(() => {
    const initThread = async () => {
      try {
        const res = await api.threads.list(currentProjectId);
        const threads = res.threads || [];
        setAllThreads(threads);
        const savedId = getActiveThreadId(currentProjectId);
        const savedThread = savedId ? threads.find((t: any) => t.id === savedId) : null;
        if (savedThread) {
          setThreadId(savedThread.id);
          const msgs = await api.threads.messages(savedThread.id, 0, 100);
          setMessages(toChatMessages(msgs.items));
        } else if (threads.length > 0) {
          const latest = threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
          setThreadId(latest.id);
          setActiveThreadId(currentProjectId, latest.id);
          const msgs = await api.threads.messages(latest.id, 0, 100);
          setMessages(toChatMessages(msgs.items));
        } else {
          const result = await api.threads.create(currentProjectId);
          setThreadId(result.thread.id);
          setActiveThreadId(currentProjectId, result.thread.id);
          setAllThreads([result.thread]);
        }
      } catch (error) {
        console.error('Failed to initialize thread:', error);
      }
    };
    initThread();
  }, [currentProjectId]);

  useEffect(() => {
    if (threadId) setActiveThreadId(currentProjectId, threadId);
  }, [threadId, currentProjectId]);

  useEffect(() => {
    const fetchGitBranch = async () => {
      try {
        const branchInfo = await api.git.currentBranch(currentProjectId);
        if (branchInfo?.branch) {
          setGitBranch(branchInfo.branch);
        }
      } catch (error) {
        console.log('Could not fetch git branch');
      }
    };
    fetchGitBranch();
  }, [currentProjectId]);

  const refreshDiagnostics = async () => {
    try {
      const result = await api.diagnostics.run(currentProjectId);
      setProblems(result.problems ?? []);
    } catch {
    }
  };

  const fetchTests = async () => {
    try {
      const res = await api.tests.list(currentProjectId);
      setTestCases(res.tests ?? []);
    } catch {}
  };

  const handleRunTest = async (testId: string) => {
    setRunningTestId(testId);
    try {
      const res = await api.tests.run(currentProjectId, testId);
      const passed = res.passed ?? res.exit_code === 0;
      const output = res.output ?? res.stdout ?? "";
      setTestResults(prev => ({ ...prev, [testId]: { passed, output } }));
      if (passed) toast.success("Test passed");
      else toast.error("Test failed");
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [testId]: { passed: false, output: e?.message ?? "Run failed" } }));
      toast.error("Test run failed");
    } finally {
      setRunningTestId(null);
    }
  };

  const handleAddTest = async () => {
    if (!newTestTitle.trim() || !newTestCommand.trim()) return;
    const cmd = newTestCommand.trim().split(/\s+/);
    try {
      await api.tests.create(currentProjectId, newTestTitle.trim(), cmd);
      toast.success("Test added");
      setNewTestTitle('');
      setNewTestCommand('');
      setAddTestVisible(false);
      await fetchTests();
    } catch (e: any) {
      toast.error("Failed to add test: " + (e?.message ?? ""));
    }
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      await api.tests.delete(currentProjectId, testId);
      await fetchTests();
    } catch {}
  };

  const handleRunDebug = (command: string) => {
    if (debugRunning && cancelDebugRef.current) {
      cancelDebugRef.current();
      cancelDebugRef.current = null;
      setDebugRunning(false);
      return;
    }
    const parts = command.trim().split(/\s+/);
    setDebugRunning(true);
    setDebugOutput([`$ ${command}`]);
    setTerminalPanelOpen(true);
    setActivePanel('terminal');
    cancelDebugRef.current = api.command.stream(
      currentProjectId,
      parts,
      (line) => setDebugOutput(prev => [...prev.slice(-200), line]),
      (exitCode) => {
        setDebugRunning(false);
        cancelDebugRef.current = null;
        setDebugOutput(prev => [...prev, `\nExited with code ${exitCode}`]);
        if (exitCode === 0) toast.success("Run completed");
        else toast.error(`Process exited with code ${exitCode}`);
      },
      (err) => {
        setDebugRunning(false);
        cancelDebugRef.current = null;
        toast.error("Run failed: " + err);
      }
    );
  };

  useEffect(() => {
    refreshDiagnostics();
    fetchTests();
  }, [currentProjectId]);

  useEffect(() => {
    CommandRegistry.register({
      id: 'workbench.action.showCommands',
      label: 'Show All Commands',
      category: 'View',
      keybinding: 'ctrl+shift+p',
      handler: () => setCommandPaletteOpen(true)
    });

    CommandRegistry.register({
      id: 'workbench.action.quickOpen',
      label: 'Go to File...',
      category: 'Go',
      keybinding: 'ctrl+p',
      handler: () => setQuickOpenVisible(true)
    });

    CommandRegistry.register({
      id: 'workbench.action.gotoLine',
      label: 'Go to Line...',
      category: 'Go',
      keybinding: 'ctrl+g',
      handler: () => setGoToLineVisible(true)
    });

    CommandRegistry.register({
      id: 'workbench.action.gotoSymbol',
      label: 'Go to Symbol in Editor...',
      category: 'Go',
      keybinding: 'ctrl+shift+o',
      handler: () => setSymbolSearchVisible(true)
    });

    CommandRegistry.register({
      id: 'workbench.action.toggleSidebarVisibility',
      label: 'Toggle Sidebar Visibility',
      category: 'View',
      keybinding: 'ctrl+b',
      handler: () => {
        setSidebarVisible(prev => !prev);
        LayoutStateManager.save({ sidebarVisible: !sidebarVisible });
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.togglePanel',
      label: 'Toggle Panel',
      category: 'View',
      keybinding: 'ctrl+j',
      handler: () => {
        setTerminalPanelOpen(prev => !prev);
        LayoutStateManager.save({ panelVisible: !terminalPanelOpen });
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.files.save',
      label: 'Save',
      category: 'File',
      keybinding: 'ctrl+s',
      when: () => activeFilePath !== null,
      handler: () => {
        if (activeFilePath) {
          const file = openFiles.find(f => f.path === activeFilePath);
          if (file) handleSave(activeFilePath, file.content);
        }
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.files.newFile',
      label: 'New File',
      category: 'File',
      keybinding: 'ctrl+n',
      handler: handleNewFile
    });

    CommandRegistry.register({
      id: 'workbench.action.closeActiveEditor',
      label: 'Close Editor',
      category: 'View',
      keybinding: 'ctrl+w',
      when: () => activeFilePath !== null,
      handler: () => {
        if (activeFilePath) handleTabClose(activeFilePath);
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.splitEditor',
      label: 'Split Editor',
      category: 'View',
      keybinding: 'ctrl+\\',
      handler: () => {
        EditorGroupManager.splitEditor('horizontal');
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.terminal.new',
      label: 'New Terminal',
      category: 'Terminal',
      keybinding: 'ctrl+shift+`',
      handler: handleNewTerminal
    });

    CommandRegistry.register({
      id: 'workbench.action.pinEditor',
      label: 'Pin Editor',
      category: 'View',
      when: () => {
        const activeGroup = EditorGroupManager.getActiveGroup();
        if (!activeGroup || !activeGroup.activeTabPath) return false;
        const tab = activeGroup.tabs.find(t => t.path === activeGroup.activeTabPath);
        return tab ? !tab.isPinned : false;
      },
      handler: () => {
        if (activeFilePath) EditorGroupManager.pinTab(activeFilePath);
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.unpinEditor',
      label: 'Unpin Editor',
      category: 'View',
      when: () => {
        const activeGroup = EditorGroupManager.getActiveGroup();
        if (!activeGroup || !activeGroup.activeTabPath) return false;
        const tab = activeGroup.tabs.find(t => t.path === activeGroup.activeTabPath);
        return tab ? tab.isPinned : false;
      },
      handler: () => {
        if (activeFilePath) EditorGroupManager.unpinTab(activeFilePath);
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.zoomIn',
      label: 'Zoom In',
      category: 'View',
      keybinding: 'ctrl+=',
      handler: () => {
        const currentZoom = SettingsManager.get('workbench.zoomLevel');
        const newZoom = Math.min(currentZoom + 0.1, 2);
        SettingsManager.set('workbench.zoomLevel', newZoom);
        setZoomLevel(newZoom);
        document.body.style.zoom = `${newZoom}`;
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.zoomOut',
      label: 'Zoom Out',
      category: 'View',
      keybinding: 'ctrl+-',
      handler: () => {
        const currentZoom = SettingsManager.get('workbench.zoomLevel');
        const newZoom = Math.max(currentZoom - 0.1, 0.5);
        SettingsManager.set('workbench.zoomLevel', newZoom);
        setZoomLevel(newZoom);
        document.body.style.zoom = `${newZoom}`;
      }
    });

    CommandRegistry.register({
      id: 'workbench.action.zoomReset',
      label: 'Reset Zoom',
      category: 'View',
      keybinding: 'ctrl+0',
      handler: () => {
        SettingsManager.set('workbench.zoomLevel', 1);
        setZoomLevel(1);
        document.body.style.zoom = '1';
      }
    });

    CommandRegistry.register({
      id: 'editor.action.inlineEdit',
      label: 'Inline AI Edit',
      category: 'AI',
      keybinding: 'ctrl+i',
      when: () => activeFilePath !== null,
      handler: () => {
        if (activeFilePath) {
          setInlineEditQuery('');
          setInlineEditVisible(true);
        }
      }
    });

    KeybindingRegistry.register({ key: 'ctrl+shift+p', command: 'workbench.action.showCommands' });
    KeybindingRegistry.register({ key: 'ctrl+p', command: 'workbench.action.quickOpen' });
    KeybindingRegistry.register({ key: 'ctrl+g', command: 'workbench.action.gotoLine' });
    KeybindingRegistry.register({ key: 'ctrl+shift+o', command: 'workbench.action.gotoSymbol' });
    KeybindingRegistry.register({ key: 'ctrl+b', command: 'workbench.action.toggleSidebarVisibility' });
    KeybindingRegistry.register({ key: 'ctrl+j', command: 'workbench.action.togglePanel' });
    KeybindingRegistry.register({ key: 'ctrl+s', command: 'workbench.action.files.save' });
    KeybindingRegistry.register({ key: 'ctrl+n', command: 'workbench.action.files.newFile' });
    KeybindingRegistry.register({ key: 'ctrl+w', command: 'workbench.action.closeActiveEditor' });
    KeybindingRegistry.register({ key: 'ctrl+\\', command: 'workbench.action.splitEditor' });
    KeybindingRegistry.register({ key: 'ctrl+shift+`', command: 'workbench.action.terminal.new' });
    KeybindingRegistry.register({ key: 'ctrl+=', command: 'workbench.action.zoomIn' });
    KeybindingRegistry.register({ key: 'ctrl+-', command: 'workbench.action.zoomOut' });
    KeybindingRegistry.register({ key: 'ctrl+0', command: 'workbench.action.zoomReset' });
    KeybindingRegistry.register({ key: 'ctrl+i', command: 'editor.action.inlineEdit' });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          return;
        }
      }
      KeybindingRegistry.handleKeyDown(e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFilePath, sidebarVisible, terminalPanelOpen]);

  useEffect(() => {
    const loadAllFiles = async () => {
      try {
        const response = await api.files.list(currentProjectId);
        const collectPaths = (items: any[]): string[] => {
          const paths: string[] = [];
          items.forEach(item => {
            if (item.type === 'file') {
              paths.push(item.path);
            }
          });
          return paths;
        };
        const paths = collectPaths(response.items);
        setAllFilePaths(paths);
      } catch (error) {
        console.error('Failed to load file list:', error);
      }
    };
    loadAllFiles();
  }, [currentProjectId]);

  useEffect(() => {
    LayoutStateManager.save({
      sidebarWidth,
      sidebarVisible,
      panelHeight,
      panelVisible: terminalPanelOpen,
      activeSidebar,
      chatPanelOpen,
      chatPanelWidth,
    });
  }, [sidebarWidth, sidebarVisible, panelHeight, terminalPanelOpen, activeSidebar, chatPanelOpen, chatPanelWidth]);

  const handleFileClick = async (path: string, isPreview: boolean = true) => {
    const fileName = path.split('/').pop() || path;
    try {
      const response = await api.files.read(currentProjectId, path);
      EditorGroupManager.openFile(path, fileName, undefined, { isPreview });

      const existingFile = openFiles.find(f => f.path === path);
      if (!existingFile) {
        const newFile: OpenFile = {
          path,
          name: fileName,
          content: response.content || '',
          isDirty: false
        };
        setOpenFiles([...openFiles, newFile]);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      EditorGroupManager.openFile(path, fileName, undefined, { isPreview });
      const newFile: OpenFile = {
        path,
        name: fileName,
        content: `// Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isDirty: false
      };
      setOpenFiles([...openFiles, newFile]);
    }
  };

  useEffect(() => {
    const openPath = (location.state as any)?.openFilePath;
    if (openPath && typeof openPath === 'string') {
      handleFileClick(openPath, false);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleTabClose = (path: string) => {
    EditorGroupManager.closeFile(path);
    const newOpenFiles = openFiles.filter(f => f.path !== path);
    setOpenFiles(newOpenFiles);
  };

  const handleContentChange = (path: string, content: string, isDirty: boolean) => {
    setOpenFiles(openFiles.map(f =>
      f.path === path ? { ...f, content, isDirty } : f
    ));
    EditorGroupManager.setTabDirty(path, isDirty);
  };

  const handleSave = async (path: string, content: string) => {
    try {
      let isNewFile = false;
      try {
        await api.files.overwrite(currentProjectId, path, content);
      } catch {
        await api.files.write(currentProjectId, path, content);
        isNewFile = true;
      }
      setOpenFiles(openFiles.map(f =>
        f.path === path ? { ...f, content, isDirty: false } : f
      ));
      EditorGroupManager.setTabDirty(path, false);
      toast.success(`Saved ${path.split('/').pop()}`);
      refreshDiagnostics();
      if (isNewFile) {
        setFileTreeRefreshKey(k => k + 1);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(`Failed to save file: ${(error as Error).message}`);
    }
  };

  const handleCursorPositionChange = (line: number, column: number) => {
    setCursorPosition({ line, column });
  };

  const handleSearch = async (query: string, options?: SearchOptions) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.files.search(currentProjectId, query);
      let processedResults: SearchMatch[] = (results.results || []).map((r: any, idx: number) => ({
        path: r.path || '',
        line: r.line || 0,
        lineNumber: r.line,
        content: r.content || r.match || '',
      }));

      if (options?.caseSensitive || options?.wholeWord || options?.useRegex) {
        processedResults = processedResults.filter(result => {
          let pattern = query;

          if (options.useRegex) {
            try {
              const regex = new RegExp(pattern, options.caseSensitive ? '' : 'i');
              return regex.test(result.content);
            } catch {
              return false;
            }
          }

          if (options.wholeWord) {
            pattern = `\\b${pattern}\\b`;
          }

          const regex = new RegExp(pattern, options.caseSensitive ? '' : 'i');
          return regex.test(result.content);
        });
      }

      setSearchResults(processedResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (path: string, line?: number) => {
    handleFileClick(path, false);
    if (line && editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
    }
  };

  const handleProblemClick = (problem: Problem) => {
    handleFileClick(problem.file, false);
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(problem.line);
      editorRef.current.setPosition({ lineNumber: problem.line, column: problem.column });
    }
  };

  const handleClearProblems = () => {
    setProblems([]);
  };

  const handleClearOutput = () => {
    setOutputEntries([]);
  };

  const handleNewFile = () => {
    setNewFileName('');
    setNewFileDialogVisible(true);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    try {
      await api.files.write(currentProjectId, newFileName.trim(), '');
      setNewFileDialogVisible(false);
      setNewFileName('');
      handleFileClick(newFileName.trim());
      setFileTreeRefreshKey(k => k + 1);
    } catch (error) {
      toast.error('Failed to create file: ' + (error as Error).message);
    }
  };

  const handleNewFolder = () => {
    setNewFolderName('');
    setNewFolderDialogVisible(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const placeholderPath = newFolderName.trim().replace(/\/$/, '') + '/.gitkeep';
      await api.files.write(currentProjectId, placeholderPath, '');
      setNewFolderDialogVisible(false);
      setNewFolderName('');
      setFileTreeRefreshKey(k => k + 1);
      toast.success(`Folder created: ${newFolderName.trim()}`);
    } catch (error) {
      toast.error('Failed to create folder: ' + (error as Error).message);
    }
  };

  const handleReplaceInFile = async (search: string, replace: string, filePath?: string) => {
    if (!filePath || !search) return;
    try {
      const fileData = await api.files.read(currentProjectId, filePath);
      const newContent = fileData.content.split(search).join(replace);
      await api.files.overwrite(currentProjectId, filePath, newContent);
      const openFile = openFiles.find(f => f.path === filePath);
      if (openFile) {
        setOpenFiles(prev => prev.map(f => f.path === filePath ? { ...f, content: newContent, isDirty: false } : f));
      }
      toast.success(`Replaced in ${filePath.split('/').pop()}`);
    } catch (error) {
      toast.error('Replace failed: ' + (error as Error).message);
    }
  };

  const handleReplaceAllInFiles = async (search: string, replace: string) => {
    if (!search || searchResults.length === 0) return;
    const uniquePaths = [...new Set(searchResults.map(r => r.path))];
    let replacedCount = 0;
    for (const filePath of uniquePaths) {
      try {
        const fileData = await api.files.read(currentProjectId, filePath);
        const newContent = fileData.content.split(search).join(replace);
        if (newContent !== fileData.content) {
          await api.files.overwrite(currentProjectId, filePath, newContent);
          const openFile = openFiles.find(f => f.path === filePath);
          if (openFile) {
            setOpenFiles(prev => prev.map(f => f.path === filePath ? { ...f, content: newContent, isDirty: false } : f));
          }
          replacedCount++;
        }
      } catch {}
    }
    toast.success(`Replaced in ${replacedCount} file${replacedCount !== 1 ? 's' : ''}`);
    handleSearch(search, searchOptions);
  };

  const handleInlineEdit = async () => {
    if (!inlineEditQuery.trim() || !threadId) return;
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    const selectedText = selection ? editor.getModel()?.getValueInRange(selection) : '';
    const activeFile = openFiles.find(f => f.path === activeFilePath);

    setInlineEditLoading(true);
    const prompt = selectedText
      ? `[INLINE EDIT REQUEST]\nFile: ${activeFilePath}\nSelected code:\n\`\`\`\n${selectedText}\n\`\`\`\n\nInstruction: ${inlineEditQuery}\n\nReplace the selected code with the improved version. Respond with ONLY the replacement code, no explanation.`
      : `[INLINE EDIT REQUEST]\nFile: ${activeFilePath}\nFull content:\n\`\`\`\n${activeFile?.content?.substring(0, 3000) || ''}\n\`\`\`\n\nInstruction: ${inlineEditQuery}\n\nRespond with the complete updated file content only.`;

    let result = '';
    api.threads.stream(
      threadId,
      prompt,
      (token) => { result += token; },
      async () => {
        setInlineEditLoading(false);
        setInlineEditVisible(false);
        setInlineEditQuery('');
        const code = result.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
        if (selectedText && selection) {
          editor.executeEdits('inline-ai', [{
            range: selection,
            text: code,
          }]);
          toast.success('AI edit applied');
        } else if (activeFilePath) {
          await handleSave(activeFilePath, code);
          const f = openFiles.find(f => f.path === activeFilePath);
          if (f) setOpenFiles(prev => prev.map(o => o.path === activeFilePath ? { ...o, content: code, isDirty: false } : o));
          toast.success('AI edit applied to file');
        }
      },
      (err) => {
        setInlineEditLoading(false);
        toast.error('Inline edit failed: ' + err);
      }
    );
  };

  const handleNewTerminal = () => {
    TerminalManager.createTerminal(`Terminal ${terminals.length + 1}`);
  };

  const handleTerminalTabClick = (terminalId: string) => {
    const terminals = TerminalManager.getTerminals();
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      TerminalManager.setActiveTerminal(terminalId);
    }
  };

  const handleTerminalTabClose = (terminalId: string) => {
    TerminalManager.closeTerminal(terminalId);
  };

  const handleOpenFolder = async () => {
    if ((window as any).cubosDesktop?.showOpenDialog) {
      try {
        const result = await (window as any).cubosDesktop.showOpenDialog({
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          await importFolderPath(result.filePaths[0]);
        }
      } catch (error) {
        console.error('Failed to open folder:', error);
      }
    } else {
      setOpenFolderPath('');
      setOpenFolderDialogVisible(true);
    }
  };

  const importFolderPath = async (folderPath: string) => {
    if (!folderPath.trim()) return;
    setOpenFolderLoading(true);
    try {
      const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
      const response = await fetch(`${BASE}/projects/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath.trim() }),
      });
      if (response.ok) {
        const data = await response.json();
        const projectName = data.project?.project_name || data.project_name;
        if (projectName) {
          setOpenFolderDialogVisible(false);
          navigate(`/project/${projectName}/code`);
        } else {
          toast.error('Failed to open folder: invalid response');
        }
      } else if (response.status === 409) {
        const folderName = folderPath.trim().replace(/\\/g, '/').split('/').pop() || '';
        const projectName = folderName.toLowerCase().replace(/[\s_]+/g, '-');
        if (projectName) {
          setOpenFolderDialogVisible(false);
          navigate(`/project/${projectName}/code`);
        } else {
          toast.error('Project already exists');
        }
      } else {
        const errText = await response.text();
        let detail = errText;
        try { detail = JSON.parse(errText)?.detail || errText; } catch {}
        toast.error(`Failed to open folder: ${detail}`);
      }
    } catch (error: any) {
      toast.error(`Failed to open folder: ${error.message}`);
    } finally {
      setOpenFolderLoading(false);
    }
  };

  const handleSaveAll = async () => {
    for (const file of openFiles.filter(f => f.isDirty)) {
      try {
        await api.files.write(currentProjectId, file.path, file.content);
        setOpenFiles(prev => prev.map(f =>
          f.path === file.path ? { ...f, isDirty: false } : f
        ));
      } catch (error) {
        console.error(`Failed to save ${file.path}:`, error);
      }
    }
  };

  const handleSend = async (content: string, attachments?: File[]) => {
    if (!threadId) return;

    const activeFile = openFiles.find(f => f.path === activeFilePath);

    let enhancedMessage = content;

    if (attachments && attachments.length > 0) {
      const electronPaths: string[] = (window as any)._cubosElectronFilePaths || [];
      const attachmentContext = attachments.map((f, i) => {
        const fullPath = electronPaths[i] || f.name;
        return `[ATTACHED FILE: ${fullPath}]`;
      }).join('\n');
      enhancedMessage = `${attachmentContext}\n\n${enhancedMessage}`;
      (window as any)._cubosElectronFilePaths = [];
    }

    if (activeFile) {
      enhancedMessage = `[CONTEXT: Currently editing file "${activeFile.path}" at line ${cursorPosition.line}, column ${cursorPosition.column}]\n\n[FILE CONTENT OF ${activeFile.path}]:\n\`\`\`\n${activeFile.content.substring(0, 5000)}\n\`\`\`\n\n[USER MESSAGE]: ${enhancedMessage}`;
    } else if (activeFilePath) {
      enhancedMessage = `[CONTEXT: Active file is "${activeFilePath}"]\n\n[USER MESSAGE]: ${enhancedMessage}`;
    }

    if (allFilePaths.length > 0 && allFilePaths.length <= 50) {
      enhancedMessage += `\n\n[AVAILABLE FILES IN PROJECT]: ${allFilePaths.slice(0, 50).join(', ')}`;
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content, timestamp: now }]);

    const streamId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: streamId, role: "assistant", content: "▋", timestamp: now }]);
    setIsStreaming(true);

    let streamedContent = "";

    api.threads.stream(
      threadId,
      enhancedMessage,
      (token) => {
        streamedContent += token;
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: (m.content === "▋" ? "" : m.content) + token } : m
        ));
      },
      async () => {
        setIsStreaming(false);
        setMessages((prev) => prev.map((m) =>
          m.id === streamId && m.content === "▋" ? { ...m, content: "Done." } : m
        ));

        const writePattern = /<!--\s*WRITE_FILE:\s*([^\n>]+?)\s*-->\s*```[^\n]*\n([\s\S]*?)```/g;
        let match;
        const written: string[] = [];
        while ((match = writePattern.exec(streamedContent)) !== null) {
          const filePath = match[1].trim();
          const fileContent = match[2];
          try {
            await api.files.overwrite(currentProjectId, filePath, fileContent);
            written.push(filePath);
          } catch {
            try {
              await api.files.write(currentProjectId, filePath, fileContent);
              written.push(filePath);
            } catch (writeErr) {
              toast.error(`Could not write ${filePath}`);
            }
          }
        }
        if (written.length > 0) {
          toast.success(`Written: ${written.join(", ")}`);
          setOutputEntries(prev => [
            ...prev,
            ...written.map(p => ({
              id: `write-${Date.now()}-${p}`,
              timestamp: new Date().toLocaleTimeString(),
              source: "AI",
              content: `File written: ${p}`,
              type: "info" as const,
            }))
          ]);
          const refreshed = await api.files.list(currentProjectId);
          setAllFilePaths((refreshed?.items ?? []).map((f: any) => f.path || f.name));
          setFileTreeRefreshKey(k => k + 1);
        }
      },
      (err) => {
        setIsStreaming(false);
        setMessages((prev) => prev.map((m) =>
          m.id === streamId ? { ...m, content: cleanDisplayText(err) || "Request failed." } : m
        ));
      },
      {
        enableTools: true,
        onTool: (tool) => {
          setOutputEntries(prev => [
            ...prev,
            {
              id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: new Date().toLocaleTimeString(),
              source: "AI Tool",
              content: `${tool.name} ${JSON.stringify(tool.args).slice(0, 200)}\n→ ${tool.result_preview.slice(0, 400)}`,
              type: "info" as const,
            },
          ]);
          if (tool.name === "write_file" || tool.name === "overwrite_file") {
            api.files.list(currentProjectId).then((refreshed) => {
              setAllFilePaths((refreshed?.items ?? []).map((f: any) => f.path || f.name));
              setFileTreeRefreshKey(k => k + 1);
            }).catch(() => null);
          }
        },
      }
    );
  };

  useKeyboardShortcuts({
    onSave: () => {
      if (activeFilePath) {
        const file = openFiles.find(f => f.path === activeFilePath);
        if (file) handleSave(activeFilePath, file.content);
      }
    },
    onCloseFile: () => {
      if (activeFilePath) handleTabClose(activeFilePath);
    },
    onToggleTerminal: () => setTerminalPanelOpen(prev => !prev),
    onToggleSidebar: () => setSidebarVisible(prev => !prev),
    onShowExplorer: () => {
      setActiveSidebar('explorer');
      setSidebarVisible(true);
    },
    onSearchInFiles: () => {
      setActiveSidebar('search');
      setSidebarVisible(true);
    },
    onNewFile: handleNewFile,
    onInlineEdit: () => {
      if (activeFilePath) {
        setInlineEditQuery('');
        setInlineEditVisible(true);
      }
    },
  });

  const menuActions = {
    // File Menu
    onNewFile: handleNewFile,
    onOpenFile: async () => {
      if ((window as any).cubosDesktop?.showOpenDialog) {
        const result = await (window as any).cubosDesktop.showOpenDialog({
          properties: ['openFile'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          handleFileClick(result.filePaths[0]);
        }
      } else {
        toast.error('Open File requires the desktop app. In browser mode, use the file tree on the left.');
      }
    },
    onOpenFolder: handleOpenFolder,
    onSave: () => {
      if (activeFilePath) {
        const file = openFiles.find(f => f.path === activeFilePath);
        if (file) handleSave(activeFilePath, file.content);
      }
    },
    onSaveAs: async () => {
      if (!activeFilePath) return;
      const file = openFiles.find(f => f.path === activeFilePath);
      if (!file) return;
      if ((window as any).cubosDesktop?.showSaveDialog) {
        const result = await (window as any).cubosDesktop.showSaveDialog({});
        if (!result.canceled && result.filePath) {
          await api.files.write(currentProjectId, result.filePath, file.content);
        }
      } else {
        toast.error('Save As requires the desktop app. Use Ctrl+S to save the current file.');
      }
    },
    onSaveAll: handleSaveAll,
    onCloseEditor: () => {
      if (activeFilePath) handleTabClose(activeFilePath);
    },
    onNewWindow: () => {
      if ((window as any).cubosDesktop?.openNewWindow) {
        (window as any).cubosDesktop.openNewWindow();
      } else {
        window.open(window.location.href, '_blank');
      }
    },
    onCloseFolder: () => {
      navigate('/');
    },
    onPreferences: () => {
      navigate('/settings');
    },

    // Edit Menu
    onUndo: () => {
      editorRef.current?.trigger('keyboard', 'undo', {});
    },
    onRedo: () => {
      editorRef.current?.trigger('keyboard', 'redo', {});
    },
    onCut: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.clipboardCutAction', {});
    },
    onCopy: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.clipboardCopyAction', {});
    },
    onPaste: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.clipboardPasteAction', {});
    },
    onFind: () => {
      editorRef.current?.trigger('keyboard', 'actions.find', {});
    },
    onReplace: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction', {});
    },
    onFindInFiles: () => {
      setActiveSidebar('search');
      setSidebarVisible(true);
    },
    onReplaceInFiles: () => {
      setActiveSidebar('search');
      setSidebarVisible(true);
    },

    // Selection Menu
    onSelectAll: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.selectAll', {});
    },
    onExpandSelection: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.smartSelect.expand', {});
    },
    onShrinkSelection: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.smartSelect.shrink', {});
    },
    onCopyLineUp: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.copyLinesUpAction', {});
    },
    onCopyLineDown: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.copyLinesDownAction', {});
    },
    onMoveLineUp: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.moveLinesUpAction', {});
    },
    onMoveLineDown: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.moveLinesDownAction', {});
    },
    onAddCursorAbove: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.insertCursorAbove', {});
    },
    onAddCursorBelow: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.insertCursorBelow', {});
    },
    onSelectAllOccurrences: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.selectHighlights', {});
    },

    // View Menu
    onCommandPalette: () => setCommandPaletteOpen(true),
    onOpenView: () => setCommandPaletteOpen(true),
    onShowProblems: () => {
      setActivePanel('problems');
      setTerminalPanelOpen(true);
    },
    onShowOutput: () => {
      setActivePanel('output');
      setTerminalPanelOpen(true);
    },
    onToggleWordWrap: () => {
      const currentWrap = SettingsManager.get('editor.wordWrap');
      const newWrap = currentWrap === 'on' ? 'off' : 'on';
      SettingsManager.set('editor.wordWrap', newWrap);
      editorRef.current?.updateOptions({ wordWrap: newWrap });
    },
    onZoomIn: () => {
      const currentZoom = SettingsManager.get('workbench.zoomLevel') || 1;
      const newZoom = Math.min(currentZoom + 0.1, 2);
      SettingsManager.set('workbench.zoomLevel', newZoom);
      setZoomLevel(newZoom);
      document.body.style.zoom = `${newZoom}`;
    },
    onZoomOut: () => {
      const currentZoom = SettingsManager.get('workbench.zoomLevel') || 1;
      const newZoom = Math.max(currentZoom - 0.1, 0.5);
      SettingsManager.set('workbench.zoomLevel', newZoom);
      setZoomLevel(newZoom);
      document.body.style.zoom = `${newZoom}`;
    },

    // Go Menu
    onGoBack: () => {
      window.history.back();
    },
    onGoForward: () => {
      window.history.forward();
    },
    onGoToFile: () => setQuickOpenVisible(true),
    onGoToSymbol: () => setSymbolSearchVisible(true),
    onGoToLine: () => setGoToLineVisible(true),
    onGoToDefinition: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.revealDefinition', {});
    },
    onGoToReferences: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.goToReferences', {});
    },
    onGoToImplementation: () => {
      editorRef.current?.trigger('keyboard', 'editor.action.goToImplementation', {});
    },

    // Debug Menu
    onStartDebugging: () => {
      toast.info('Opening debug panel. Use console.log() and browser DevTools (F12) for debugging.');
      setActiveSidebar('debug');
      setSidebarVisible(true);
    },
    onRunWithoutDebugging: () => {
      if (!activeFilePath) {
        toast.error('No file is currently active.');
        return;
      }
      const ext = activeFilePath.split('.').pop()?.toLowerCase();
      const fileName = activeFilePath.split('/').pop();
      let command = '';

      if (ext === 'py') command = `python "${fileName}"`;
      else if (ext === 'js') command = `node "${fileName}"`;
      else if (ext === 'ts') command = `ts-node "${fileName}"`;
      else if (ext === 'sh' || ext === 'bash') command = `bash "${fileName}"`;
      else if (ext === 'ps1') command = `powershell -File "${fileName}"`;
      else {
        toast.error(`Unable to determine how to run .${ext} files. Please use the Terminal to run this file manually.`);
        return;
      }

      setTerminalPanelOpen(true);
      setActivePanel('terminal');

      navigator.clipboard.writeText(command).then(() => {
        toast.success(`Command copied to clipboard: ${command}\nPaste it in the terminal to run.`);
      }).catch(() => {
        toast.info(`Run this command in the terminal: ${command}`);
      });
    },
    onStopDebugging: () => {
      toast.info('Stop debugging: Close debug panel or use Ctrl+C in terminal');
      setActiveSidebar('explorer');
    },
    onRestartDebugging: () => {
      toast.info('Restart debugging: Re-run your application from the terminal');
    },
    onAddConfiguration: () => {
      toast.info('Create .vscode/launch.json to configure debug settings');
      handleNewFile();
    },
    onOpenConfigurations: () => {
      const launchJsonPath = '.vscode/launch.json';
      handleFileClick(launchJsonPath);
    },
    onToggleBreakpoint: () => {
      editorRef.current?.trigger('keyboard', 'editor.debug.action.toggleBreakpoint', {});
    },
    onNewBreakpoint: () => {
      toast.info('Use F9 to toggle breakpoints in the editor');
    },

    // Terminal Menu
    onNewTerminal: handleNewTerminal,
    onSplitTerminal: () => {
      const newTerminalName = `Terminal ${terminals.length + 1}`;
      TerminalManager.createTerminal(newTerminalName);
      setTerminalPanelOpen(true);
      setActivePanel('terminal');
    },
    onRunTask: () => {
      setTerminalPanelOpen(true);
      setActivePanel('terminal');
      toast.info('Enter your task command in the terminal (e.g., npm run test, npm start)');
    },
    onRunBuildTask: () => {
      setTerminalPanelOpen(true);
      setActivePanel('terminal');
      const command = 'npm run build';
      navigator.clipboard.writeText(command).then(() => {
        toast.success(`Build command copied: ${command}\nPaste in terminal to run.`);
      }).catch(() => {
        toast.info(`Run this in terminal: ${command}`);
      });
    },
    onRunActiveFile: () => {
      if (!activeFilePath) {
        toast.error('No file is currently active.');
        return;
      }
      const ext = activeFilePath.split('.').pop()?.toLowerCase();
      const fileName = activeFilePath.split('/').pop();
      let command = '';

      if (ext === 'py') command = `python "${fileName}"`;
      else if (ext === 'js') command = `node "${fileName}"`;
      else if (ext === 'ts') command = `ts-node "${fileName}"`;
      else if (ext === 'sh' || ext === 'bash') command = `bash "${fileName}"`;
      else if (ext === 'ps1') command = `powershell -File "${fileName}"`;
      else {
        toast.error(`Unable to determine how to run .${ext} files. Please use the Terminal to run this file manually.`);
        return;
      }

      setTerminalPanelOpen(true);
      setActivePanel('terminal');

      navigator.clipboard.writeText(command).then(() => {
        toast.success(`Command copied to clipboard: ${command}\nPaste it in the terminal to run.`);
      }).catch(() => {
        toast.info(`Run this command in the terminal: ${command}`);
      });
    },
    onConfigureTasks: () => {
      const tasksJsonPath = '.vscode/tasks.json';
      handleFileClick(tasksJsonPath);
      toast.info('Create or edit tasks.json to configure tasks');
    },
    onConfigureDefaultBuildTask: () => {
      const tasksJsonPath = '.vscode/tasks.json';
      handleFileClick(tasksJsonPath);
      toast.info('Configure default build task in tasks.json');
    },

    // Help Menu
    onWelcome: () => {
      window.open('https://github.com/cubeos/cubos', '_blank');
    },
    onDocumentation: () => {
      window.open('https://github.com/cubeos/cubos/wiki', '_blank');
    },
    onReleaseNotes: () => {
      window.open('https://github.com/cubeos/cubos/releases', '_blank');
    },
    onKeyboardShortcuts: () => {
      setCommandPaletteOpen(true);
    },
    onReportIssue: () => {
      window.open('https://github.com/cubeos/cubos/issues/new', '_blank');
    },
    onAbout: () => {
      toast.info('CubOS - AI-Powered Development Environment\n\nVersion: 1.0.0\nBuilt with ❤️ using React, TypeScript, and FastAPI');
    },

    // Navigation
    onToggleTerminal: () => setTerminalPanelOpen(prev => !prev),
    onToggleSidebar: () => setSidebarVisible(prev => !prev),
    onShowExplorer: () => {
      setActiveSidebar('explorer');
      setSidebarVisible(true);
    },
    onShowSearch: () => {
      setActiveSidebar('search');
      setSidebarVisible(true);
    },
    onShowSourceControl: () => {
      setActiveSidebar('git');
      setSidebarVisible(true);
    },
    onShowDebug: () => {
      setActiveSidebar('debug');
      setSidebarVisible(true);
    },
    onShowExtensions: () => {
      setActiveSidebar('extensions');
      setSidebarVisible(true);
    },
  };

  return (
    <MenuActionsProvider actions={menuActions}>
      <div className="flex flex-col h-screen bg-background">
        {/* Menu Bar */}
        <MenuBar />

        {/* Open Folder Dialog */}
        {openFolderDialogVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg p-6 w-[480px] shadow-xl">
              <h2 className="text-foreground font-semibold text-sm mb-1">Open Folder</h2>
              <p className="text-muted-foreground text-xs mb-4">Enter the full path to the folder you want to open</p>
              <input
                type="text"
                value={openFolderPath}
                onChange={e => setOpenFolderPath(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') importFolderPath(openFolderPath); }}
                placeholder="e.g. C:\Users\you\projects\myapp"
                className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setOpenFolderDialogVisible(false)}
                  className="px-4 py-2 text-xs rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => importFolderPath(openFolderPath)}
                  disabled={openFolderLoading || !openFolderPath.trim()}
                  className="px-4 py-2 text-xs rounded bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
                >
                  {openFolderLoading ? 'Opening...' : 'Open Folder'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New File Dialog */}
        {newFileDialogVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setNewFileDialogVisible(false)}>
            <div className="bg-background border border-border rounded-lg p-6 w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-foreground font-semibold text-sm mb-1">New File</h2>
              <p className="text-muted-foreground text-xs mb-4">Enter a file name (use / for subdirectories)</p>
              <input
                type="text"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFile(); if (e.key === 'Escape') setNewFileDialogVisible(false); }}
                placeholder="e.g. components/MyComponent.tsx"
                className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setNewFileDialogVisible(false)} className="px-4 py-2 text-xs rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleCreateFile} disabled={!newFileName.trim()} className="px-4 py-2 text-xs rounded bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        )}

        {/* New Folder Dialog */}
        {newFolderDialogVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setNewFolderDialogVisible(false)}>
            <div className="bg-background border border-border rounded-lg p-6 w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-foreground font-semibold text-sm mb-1">New Folder</h2>
              <p className="text-muted-foreground text-xs mb-4">Enter a folder name (use / for nested folders)</p>
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderDialogVisible(false); }}
                placeholder="e.g. components/forms"
                className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setNewFolderDialogVisible(false)} className="px-4 py-2 text-xs rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="px-4 py-2 text-xs rounded bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Inline AI Edit Overlay */}
        {inlineEditVisible && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40" onClick={() => setInlineEditVisible(false)}>
            <div className="bg-background border border-border rounded-lg shadow-2xl w-[560px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">Inline AI Edit</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{activeFilePath?.split('/').pop()}</span>
              </div>
              <div className="p-3">
                <input
                  ref={inlineEditRef}
                  type="text"
                  value={inlineEditQuery}
                  onChange={e => setInlineEditQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInlineEdit(); if (e.key === 'Escape') setInlineEditVisible(false); }}
                  placeholder="Describe what to change… (Enter to apply, Esc to cancel)"
                  className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                  autoFocus
                  disabled={inlineEditLoading}
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-muted-foreground">Select code first for a targeted edit, or leave selection empty to edit the full file</span>
                  <button
                    onClick={handleInlineEdit}
                    disabled={!inlineEditQuery.trim() || inlineEditLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
                  >
                    {inlineEditLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    {inlineEditLoading ? 'Applying…' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header/Title Bar */}
        <div className="flex items-center px-3 h-8 bg-sidebar border-b border-border justify-between">
          <span className="text-foreground text-[11px] font-semibold">{isSelfUpgrade ? 'Self-Upgrade' : currentProjectId}</span>
          <div className="flex items-center gap-2">
            <ModelSelector compact />
            {!isSelfUpgrade && <ModeToggle currentMode="code" />}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Activity Bar */}
          <div className="w-12 bg-activity-bar border-r border-border flex flex-col items-center py-1 flex-shrink-0">
            {activityBarItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (activeSidebar === item.id && sidebarVisible) setSidebarVisible(false);
                  else { setActiveSidebar(item.id); setSidebarVisible(true); }
                }}
                title={item.label}
                className={`w-10 h-10 flex items-center justify-center rounded-md mb-0.5 transition-colors ${
                  activeSidebar === item.id && sidebarVisible
                    ? "text-activity-bar-active border-l-2 border-activity-bar-active bg-accent/30"
                    : "text-activity-bar-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => navigate("/settings")}
              title="Settings"
              className="w-10 h-10 flex items-center justify-center text-activity-bar-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Sidebar */}
          {sidebarVisible && (
            <ResizablePanel
              direction="horizontal"
              initialSize={sidebarWidth}
              minSize={180}
              maxSize={500}
              onResize={(newWidth) => setSidebarWidth(newWidth)}
            >
              <div className="h-full bg-sidebar border-r border-border flex flex-col flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>
                    {activeSidebar === "explorer" ? "Explorer"
                      : activeSidebar === "search" ? "Search"
                      : activeSidebar === "git" ? "Source Control"
                      : activeSidebar === "debug" ? "Run & Debug"
                      : activeSidebar === "extensions" ? "Extensions"
                      : activeSidebar === "testing" ? "Testing"
                      : activeSidebar}
                  </span>
                </div>

                {activeSidebar === "explorer" && (
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>{currentProjectId}</span>
                      <div className="flex gap-0.5">
                        <button onClick={handleNewFile} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="New File (Ctrl+N)">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={handleNewFolder} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="New Folder">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                        </button>
                        <button className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="More Options">
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <FileTree projectName={currentProjectId} onFileClick={handleFileClick} refreshKey={fileTreeRefreshKey} />
                  </div>
                )}

                {activeSidebar === "search" && (
                  <SearchPanel
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    searchResults={searchResults}
                    isSearching={isSearching}
                    onResultClick={handleSearchResultClick}
                    searchOptions={searchOptions}
                    onSearchOptionsChange={setSearchOptions}
                    onSearch={handleSearch}
                    onReplace={handleReplaceInFile}
                    onReplaceAll={handleReplaceAllInFiles}
                  />
                )}

                {activeSidebar === "git" && (
                  <GitPanel projectId={currentProjectId} />
                )}

                {activeSidebar === "debug" && (
                  <div className="flex flex-col h-full overflow-y-auto">
                    <div className="px-3 py-2 space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Quick Run</p>
                        {[
                          { label: "Run Python File", icon: Play, cmd: activeFilePath?.endsWith('.py') ? `python "${activeFilePath}"` : "python main.py" },
                          { label: "Run Node.js File", icon: Play, cmd: activeFilePath?.endsWith('.js') ? `node "${activeFilePath}"` : "node index.js" },
                          { label: "npm start", icon: Zap, cmd: "npm start" },
                          { label: "npm run dev", icon: Zap, cmd: "npm run dev" },
                          { label: "npm run build", icon: Zap, cmd: "npm run build" },
                          { label: "npm test", icon: FlaskConical, cmd: "npm test" },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={() => handleRunDebug(item.cmd)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-foreground hover:bg-secondary/70 transition-colors text-left"
                          >
                            <item.icon className="w-3 h-3 text-success flex-shrink-0" />
                            <span className="flex-1 truncate">{item.label}</span>
                            <code className="text-[9px] text-muted-foreground truncate max-w-[80px] hidden">{item.cmd}</code>
                          </button>
                        ))}
                      </div>
                      {activeFilePath && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Active File</p>
                          <button
                            onClick={() => {
                              const ext = activeFilePath.split('.').pop()?.toLowerCase();
                              const cmds: Record<string, string> = { py: `python "${activeFilePath}"`, js: `node "${activeFilePath}"`, ts: `ts-node "${activeFilePath}"`, sh: `bash "${activeFilePath}"` };
                              const cmd = cmds[ext ?? ''] ?? `echo "Cannot run .${ext} directly"`;
                              handleRunDebug(cmd);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] bg-success/10 text-success hover:bg-success/20 transition-colors text-left"
                          >
                            <Play className="w-3 h-3 flex-shrink-0" />
                            <span className="flex-1 truncate">Run {activeFilePath.split('/').pop()}</span>
                          </button>
                        </div>
                      )}
                      {debugRunning && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                              Running
                            </p>
                            <button onClick={() => { cancelDebugRef.current?.(); setDebugRunning(false); }} className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-secondary flex items-center gap-0.5">
                              <Square className="w-2.5 h-2.5" /> Stop
                            </button>
                          </div>
                          <div className="bg-black/30 rounded p-2 max-h-40 overflow-y-auto scrollbar-thin">
                            {debugOutput.slice(-20).map((line, i) => (
                              <div key={i} className="text-[10px] font-mono text-green-400 whitespace-pre-wrap">{line}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSidebar === "extensions" && (
                  <div className="flex flex-col h-full overflow-y-auto">
                    <div className="px-3 py-2 space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI Model</p>
                        <div className="px-1">
                          <ModelSelector className="w-full" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Built-in Tools</p>
                        {[
                          { label: "AI Chat Assistant", icon: MessageCircle, desc: "Chat with AI about your code", active: true },
                          { label: "Code Agent", icon: Zap, desc: "Autonomous code editing AI", active: true },
                          { label: "Git Integration", icon: GitBranch, desc: "Source control with AI commits", active: true },
                          { label: "Problems Panel", icon: AlertCircle, desc: "AI-powered code diagnostics", active: true },
                          { label: "File Search", icon: Search, desc: "Semantic + text search", active: true },
                          { label: "Terminal", icon: TerminalIcon, desc: "Integrated multi-tab terminal", active: true },
                          { label: "Deep Research", icon: FlaskConical, desc: "AI research on any topic", active: true },
                          { label: "CoWork", icon: Cpu, desc: "Workspace automation", active: true },
                        ].map((ext) => (
                          <div key={ext.label} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors">
                            <ext.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-foreground font-medium truncate">{ext.label}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{ext.desc}</div>
                            </div>
                            {ext.active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium flex-shrink-0">On</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebar === "testing" && (
                  <div className="flex flex-col h-full overflow-y-auto">
                    <div className="px-3 py-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Test Cases</p>
                        <div className="flex gap-1">
                          <button onClick={fetchTests} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Refresh"><RefreshCw className="w-3 h-3" /></button>
                          <button onClick={() => setAddTestVisible(v => !v)} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Add Test"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {addTestVisible && (
                        <div className="bg-secondary/40 rounded-lg p-2.5 space-y-2">
                          <input
                            value={newTestTitle}
                            onChange={e => setNewTestTitle(e.target.value)}
                            placeholder="Test name"
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                          />
                          <input
                            value={newTestCommand}
                            onChange={e => setNewTestCommand(e.target.value)}
                            placeholder="Command (e.g. npm test)"
                            className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                            onKeyDown={e => e.key === 'Enter' && handleAddTest()}
                          />
                          <div className="flex gap-1.5">
                            <button onClick={handleAddTest} disabled={!newTestTitle.trim() || !newTestCommand.trim()} className="flex-1 py-1 text-[10px] rounded bg-foreground text-background disabled:opacity-40 hover:bg-foreground/80 transition-colors">Add</button>
                            <button onClick={() => setAddTestVisible(false)} className="px-2 py-1 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}
                      {testCases.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <TestTube className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          <p className="text-[11px]">No tests yet</p>
                          <p className="text-[10px] mt-1">Click + to add a test</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {testCases.map((tc) => {
                            const result = testResults[tc.id];
                            const isRunning = runningTestId === tc.id;
                            return (
                              <div key={tc.id} className="bg-secondary/30 rounded-lg p-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  {result ? (
                                    result.passed
                                      ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                                      : <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-border flex-shrink-0" />
                                  )}
                                  <span className="flex-1 text-[11px] text-foreground truncate">{tc.title}</span>
                                  <button
                                    onClick={() => handleRunTest(tc.id)}
                                    disabled={!!runningTestId}
                                    className="p-0.5 rounded hover:bg-success/20 text-success disabled:opacity-40 transition-colors"
                                    title="Run test"
                                  >
                                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                  </button>
                                  <button onClick={() => handleDeleteTest(tc.id)} className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><X className="w-3 h-3" /></button>
                                </div>
                                <div className="text-[9px] font-mono text-muted-foreground truncate">{(tc.command ?? []).join(' ')}</div>
                                {result?.output && (
                                  <div className={`text-[9px] font-mono rounded px-1.5 py-1 max-h-20 overflow-y-auto ${result.passed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                    {result.output.slice(0, 300)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          )}

          {/* Editor Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ minWidth: 0 }}>
            {/* Editor and Terminal Container */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
              {/* Editor - takes remaining space above terminal */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: terminalPanelOpen ? '150px' : 0 }}>
                <SplitEditorView
                  projectName={currentProjectId}
                  onContentChange={handleContentChange}
                  onSave={handleSave}
                  onCursorPositionChange={handleCursorPositionChange}
                  onEditorMount={(editor) => { editorRef.current = editor; }}
                  theme={theme}
                />
              </div>

              {/* Bottom Panel - Terminal */}
              {terminalPanelOpen && (
                <ResizablePanel
                  direction="vertical"
                  initialSize={panelHeight}
                  minSize={100}
                  maxSize={600}
                  onResize={(newHeight) => setPanelHeight(newHeight)}
                >
                  <div className="h-full flex flex-col">
                    <PanelTabs
                      activePanel={activePanel}
                      onPanelChange={setActivePanel}
                      onClose={() => setTerminalPanelOpen(false)}
                      problemCount={problems.length}
                      outputCount={outputEntries.length}
                    />
                    <div className="flex-1 overflow-hidden">
                      {activePanel === "terminal" && (
                        <div className="h-full flex flex-col">
                          <TerminalTabs
                            terminals={terminals}
                            activeTerminalId={activeTerminalId}
                            onTabClick={handleTerminalTabClick}
                            onTabClose={handleTerminalTabClose}
                            onNewTerminal={handleNewTerminal}
                          />
                          <div className="flex-1">
                            <TerminalPanel
                              projectName={currentProjectId}
                              onClose={() => setTerminalPanelOpen(false)}
                            />
                          </div>
                        </div>
                      )}
                      {activePanel === "problems" && (
                        <ProblemsPanel
                          problems={problems}
                          onProblemClick={handleProblemClick}
                          onClear={handleClearProblems}
                          onRefresh={refreshDiagnostics}
                        />
                      )}
                      {activePanel === "output" && (
                        <OutputPanel
                          entries={outputEntries}
                          onClear={handleClearOutput}
                        />
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              )}
            </div>
          </div>

          {/* AI Chat Panel */}
          {chatPanelOpen && (
            <ResizablePanel
              direction="horizontal"
              initialSize={chatPanelWidth}
              minSize={280}
              maxSize={600}
              onResize={(newWidth) => setChatPanelWidth(newWidth)}
            >
              <div className="h-full bg-background border-l border-border flex flex-col flex-shrink-0">
                <div className="px-3 py-2 bg-sidebar border-b border-border flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    AI Assistant
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setThreadListVisible(v => !v)}
                      title="Chat History"
                      className={`p-0.5 rounded transition-colors text-muted-foreground hover:text-foreground ${threadListVisible ? 'bg-accent text-foreground' : ''}`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const result = await api.threads.create(currentProjectId);
                          setThreadId(result.thread.id);
                          setMessages([]);
                          setThreadListVisible(false);
                          const updated = await api.threads.list(currentProjectId);
                          setAllThreads(updated.threads || []);
                        } catch {}
                      }}
                      title="New Chat"
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setChatPanelOpen(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {threadListVisible && allThreads.length > 0 && (
                  <div className="border-b border-border bg-sidebar max-h-48 overflow-y-auto">
                    {allThreads
                      .slice()
                      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={async () => {
                            setThreadId(t.id);
                            setThreadListVisible(false);
                            try {
                              const msgs = await api.threads.messages(t.id, 0, 100);
                              setMessages(toChatMessages(msgs.items));
                            } catch {}
                          }}
                          className={`w-full text-left px-3 py-2 text-[11px] hover:bg-accent transition-colors flex items-center gap-2 ${t.id === threadId ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'}`}
                        >
                          <MessageCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="flex-1 truncate">{t.title || `Chat ${t.id?.slice(-6)}`}</span>
                          {t.id === threadId && <span className="text-[9px] text-primary">active</span>}
                        </button>
                      ))}
                  </div>
                )}

                <div className="flex-1 overflow-auto p-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
                      <MessageCircle className="w-8 h-8 opacity-30" />
                      <p className="font-medium">AI Code Assistant</p>
                      <p className="text-[11px] text-center opacity-70">Ask me to write, fix, or explain code.<br/>Use Ctrl+I to edit selected code inline.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {messages.map((msg) => (
                        <ChatMessageComponent key={msg.id} message={msg as any} isSelfUpgrade={isSelfUpgrade} projectName={currentProjectId} onApprovalResolved={() => {}} />
                      ))}
                      {isStreaming && (
                        <div className="flex items-center gap-1.5 text-primary text-[10px]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Thinking...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t border-border">
                  <ChatInput placeholder="Ask about your code… (Ctrl+I for inline edit)" onSend={handleSend} isGenerating={isStreaming} onStop={() => {}} />
                </div>
              </div>
            </ResizablePanel>
          )}

          {/* Floating Reopen Chat Button */}
          {!chatPanelOpen && (
            <button
              onClick={() => setChatPanelOpen(true)}
              className="fixed right-4 bottom-20 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-all z-50"
              title="Open AI Assistant"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Bar */}
        <StatusBar
          currentFile={activeFilePath}
          lineNumber={cursorPosition.line}
          columnNumber={cursorPosition.column}
          branch={gitBranch}
          onBranchClick={() => setBranchSwitcherVisible(true)}
          onLanguageClick={() => toast.info('Language mode selector - monaco editor handles syntax highlighting automatically')}
          onGitHubClick={() => toast.info('GitHub integration available in Source Control panel')}
        />

        {/* Overlay Components */}
        {commandPaletteOpen && (
          <CommandPalette
            onClose={() => setCommandPaletteOpen(false)}
          />
        )}

        {quickOpenVisible && (
          <QuickOpen
            files={allFilePaths}
            onClose={() => setQuickOpenVisible(false)}
            onSelectFile={(path) => {
              setQuickOpenVisible(false);
              handleFileClick(path);
            }}
          />
        )}

        {goToLineVisible && (
          <GoToLine
            onClose={() => setGoToLineVisible(false)}
            onGoToLine={(lineNumber: number) => {
              setGoToLineVisible(false);
              if (editorRef.current) {
                editorRef.current.revealLineInCenter(lineNumber);
                editorRef.current.setPosition({ lineNumber, column: 1 });
                editorRef.current.focus();
              }
            }}
            totalLines={editorRef.current?.getModel()?.getLineCount() || 1000}
          />
        )}

        {symbolSearchVisible && activeFilePath && (
          <SymbolSearch
            onClose={() => setSymbolSearchVisible(false)}
            onGoToSymbol={(lineNumber: number) => {
              setSymbolSearchVisible(false);
              if (editorRef.current) {
                editorRef.current.revealLineInCenter(lineNumber);
                editorRef.current.setPosition({ lineNumber, column: 1 });
                editorRef.current.focus();
              }
            }}
            fileContent={openFiles.find(f => f.path === activeFilePath)?.content || ''}
          />
        )}

        {branchSwitcherVisible && (
          <BranchSwitcher
            projectName={currentProjectId}
            currentBranch={gitBranch}
            onClose={() => setBranchSwitcherVisible(false)}
            onBranchSwitch={(branch) => {
              setGitBranch(branch);
            }}
          />
        )}
      </div>
    </MenuActionsProvider>
  );
}
