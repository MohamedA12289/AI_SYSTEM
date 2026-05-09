import { createContext, useContext, ReactNode } from 'react';

export interface MenuActions {
  onNewFile?: () => void;
  onNewWindow?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onSaveAll?: () => void;
  onCloseEditor?: () => void;
  onCloseFolder?: () => void;
  onPreferences?: () => void;

  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onFindInFiles?: () => void;
  onReplaceInFiles?: () => void;

  onSelectAll?: () => void;
  onExpandSelection?: () => void;
  onShrinkSelection?: () => void;
  onCopyLineUp?: () => void;
  onCopyLineDown?: () => void;
  onMoveLineUp?: () => void;
  onMoveLineDown?: () => void;
  onAddCursorAbove?: () => void;
  onAddCursorBelow?: () => void;
  onSelectAllOccurrences?: () => void;

  onCommandPalette?: () => void;
  onOpenView?: () => void;
  onShowProblems?: () => void;
  onShowOutput?: () => void;
  onToggleWordWrap?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;

  onGoBack?: () => void;
  onGoForward?: () => void;
  onGoToFile?: () => void;
  onGoToSymbol?: () => void;
  onGoToLine?: () => void;
  onGoToDefinition?: () => void;
  onGoToReferences?: () => void;
  onGoToImplementation?: () => void;

  onStartDebugging?: () => void;
  onRunWithoutDebugging?: () => void;
  onStopDebugging?: () => void;
  onRestartDebugging?: () => void;
  onAddConfiguration?: () => void;
  onOpenConfigurations?: () => void;
  onToggleBreakpoint?: () => void;
  onNewBreakpoint?: () => void;

  onNewTerminal?: () => void;
  onSplitTerminal?: () => void;
  onRunTask?: () => void;
  onRunBuildTask?: () => void;
  onRunActiveFile?: () => void;
  onConfigureTasks?: () => void;
  onConfigureDefaultBuildTask?: () => void;

  onWelcome?: () => void;
  onDocumentation?: () => void;
  onReleaseNotes?: () => void;
  onKeyboardShortcuts?: () => void;
  onReportIssue?: () => void;
  onAbout?: () => void;

  onToggleTerminal?: () => void;
  onToggleSidebar?: () => void;
  onShowExplorer?: () => void;
  onShowSearch?: () => void;
  onShowSourceControl?: () => void;
  onShowDebug?: () => void;
  onShowExtensions?: () => void;
}

const MenuActionsContext = createContext<MenuActions>({});

export const useMenuActions = () => useContext(MenuActionsContext);

export function MenuActionsProvider({ children, actions }: { children: ReactNode; actions: MenuActions }) {
  return (
    <MenuActionsContext.Provider value={actions}>
      {children}
    </MenuActionsContext.Provider>
  );
}
