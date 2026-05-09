import { useEffect } from 'react';

interface KeyboardShortcutsHandlers {
  onSave?: () => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onCloseFile?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onQuickOpen?: () => void;
  onCommandPalette?: () => void;
  onToggleComment?: () => void;
  onSelectNextOccurrence?: () => void;
  onDeleteLine?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleTerminal?: () => void;
  onToggleSidebar?: () => void;
  onShowExplorer?: () => void;
  onSearchInFiles?: () => void;
  onInlineEdit?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutsHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlOrCmd && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            handlers.onSave?.();
            break;
          case 'n':
            e.preventDefault();
            handlers.onNewFile?.();
            break;
          case 'o':
            e.preventDefault();
            handlers.onOpenFile?.();
            break;
          case 'w':
            e.preventDefault();
            handlers.onCloseFile?.();
            break;
          case 'f':
            e.preventDefault();
            handlers.onFind?.();
            break;
          case 'h':
            e.preventDefault();
            handlers.onReplace?.();
            break;
          case 'p':
            e.preventDefault();
            handlers.onQuickOpen?.();
            break;
          case '/':
            e.preventDefault();
            handlers.onToggleComment?.();
            break;
          case 'd':
            e.preventDefault();
            handlers.onSelectNextOccurrence?.();
            break;
          case 'z':
            e.preventDefault();
            handlers.onUndo?.();
            break;
          case 'y':
            e.preventDefault();
            handlers.onRedo?.();
            break;
          case '`':
            e.preventDefault();
            handlers.onToggleTerminal?.();
            break;
          case 'b':
            e.preventDefault();
            handlers.onToggleSidebar?.();
            break;
          case 'i':
            e.preventDefault();
            handlers.onInlineEdit?.();
            break;
        }
      }

      if (ctrlOrCmd && e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'p':
            e.preventDefault();
            handlers.onCommandPalette?.();
            break;
          case 'k':
            e.preventDefault();
            handlers.onDeleteLine?.();
            break;
          case 'e':
            e.preventDefault();
            handlers.onShowExplorer?.();
            break;
          case 'f':
            e.preventDefault();
            handlers.onSearchInFiles?.();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}