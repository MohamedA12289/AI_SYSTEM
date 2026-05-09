import { useState, useRef, useEffect } from 'react';
import { useMenuActions } from '@/contexts/MenuActionsContext';

interface MenuItemDef {
  label: string;
  items?: { label: string; shortcut?: string; action: () => void; separator?: boolean; disabled?: boolean }[];
}

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actions = useMenuActions();

  const menuItems: MenuItemDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New File', shortcut: 'Ctrl+N', action: () => actions.onNewFile?.() },
        { label: 'New Window', shortcut: 'Ctrl+Shift+N', action: () => actions.onNewWindow?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Open File...', shortcut: 'Ctrl+O', action: () => actions.onOpenFile?.() },
        { label: 'Open Folder...', shortcut: 'Ctrl+K Ctrl+O', action: () => actions.onOpenFolder?.() },
        { label: 'Open Recent', disabled: true, action: () => {} },
        { label: '', separator: true, action: () => {} },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => actions.onSave?.() },
        { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: () => actions.onSaveAs?.() },
        { label: 'Save All', shortcut: 'Ctrl+K S', action: () => actions.onSaveAll?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Close Editor', shortcut: 'Ctrl+W', action: () => actions.onCloseEditor?.() },
        { label: 'Close Folder', action: () => actions.onCloseFolder?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Preferences', action: () => actions.onPreferences?.() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => actions.onUndo?.() },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => actions.onRedo?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => actions.onCut?.() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => actions.onCopy?.() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => actions.onPaste?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Find', shortcut: 'Ctrl+F', action: () => actions.onFind?.() },
        { label: 'Replace', shortcut: 'Ctrl+H', action: () => actions.onReplace?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Find in Files', shortcut: 'Ctrl+Shift+F', action: () => actions.onFindInFiles?.() },
        { label: 'Replace in Files', shortcut: 'Ctrl+Shift+H', action: () => actions.onReplaceInFiles?.() },
      ],
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => actions.onSelectAll?.() },
        { label: 'Expand Selection', shortcut: 'Shift+Alt+→', action: () => actions.onExpandSelection?.() },
        { label: 'Shrink Selection', shortcut: 'Shift+Alt+←', action: () => actions.onShrinkSelection?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Copy Line Up', shortcut: 'Shift+Alt+↑', action: () => actions.onCopyLineUp?.() },
        { label: 'Copy Line Down', shortcut: 'Shift+Alt+↓', action: () => actions.onCopyLineDown?.() },
        { label: 'Move Line Up', shortcut: 'Alt+↑', action: () => actions.onMoveLineUp?.() },
        { label: 'Move Line Down', shortcut: 'Alt+↓', action: () => actions.onMoveLineDown?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Add Cursor Above', shortcut: 'Ctrl+Alt+↑', action: () => actions.onAddCursorAbove?.() },
        { label: 'Add Cursor Below', shortcut: 'Ctrl+Alt+↓', action: () => actions.onAddCursorBelow?.() },
        { label: 'Select All Occurrences', shortcut: 'Ctrl+Shift+L', action: () => actions.onSelectAllOccurrences?.() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette...', shortcut: 'Ctrl+Shift+P', action: () => actions.onCommandPalette?.() },
        { label: 'Open View...', action: () => actions.onOpenView?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: () => actions.onShowExplorer?.() },
        { label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => actions.onShowSearch?.() },
        { label: 'Source Control', shortcut: 'Ctrl+Shift+G', action: () => actions.onShowSourceControl?.() },
        { label: 'Run & Debug', shortcut: 'Ctrl+Shift+D', action: () => actions.onShowDebug?.() },
        { label: 'Extensions', shortcut: 'Ctrl+Shift+X', action: () => actions.onShowExtensions?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Terminal', shortcut: 'Ctrl+`', action: () => actions.onToggleTerminal?.() },
        { label: 'Problems', shortcut: 'Ctrl+Shift+M', action: () => actions.onShowProblems?.() },
        { label: 'Output', shortcut: 'Ctrl+Shift+U', action: () => actions.onShowOutput?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Word Wrap', shortcut: 'Alt+Z', action: () => actions.onToggleWordWrap?.() },
        { label: 'Zoom In', shortcut: 'Ctrl+=', action: () => actions.onZoomIn?.() },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => actions.onZoomOut?.() },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Back', shortcut: 'Alt+←', action: () => actions.onGoBack?.() },
        { label: 'Forward', shortcut: 'Alt+→', action: () => actions.onGoForward?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Go to File...', shortcut: 'Ctrl+P', action: () => actions.onGoToFile?.() },
        { label: 'Go to Symbol...', shortcut: 'Ctrl+Shift+O', action: () => actions.onGoToSymbol?.() },
        { label: 'Go to Line...', shortcut: 'Ctrl+G', action: () => actions.onGoToLine?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Go to Definition', shortcut: 'F12', action: () => actions.onGoToDefinition?.() },
        { label: 'Go to References', shortcut: 'Shift+F12', action: () => actions.onGoToReferences?.() },
        { label: 'Go to Implementation', shortcut: 'Ctrl+F12', action: () => actions.onGoToImplementation?.() },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Start Debugging', shortcut: 'F5', action: () => actions.onStartDebugging?.() },
        { label: 'Run Without Debugging', shortcut: 'Ctrl+F5', action: () => actions.onRunWithoutDebugging?.() },
        { label: 'Stop Debugging', shortcut: 'Shift+F5', action: () => actions.onStopDebugging?.() },
        { label: 'Restart Debugging', shortcut: 'Ctrl+Shift+F5', action: () => actions.onRestartDebugging?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Add Configuration...', action: () => actions.onAddConfiguration?.() },
        { label: 'Open Configurations', action: () => actions.onOpenConfigurations?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Toggle Breakpoint', shortcut: 'F9', action: () => actions.onToggleBreakpoint?.() },
        { label: 'New Breakpoint', action: () => actions.onNewBreakpoint?.() },
      ],
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal', shortcut: 'Ctrl+Shift+`', action: () => actions.onNewTerminal?.() },
        { label: 'Split Terminal', action: () => actions.onSplitTerminal?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Run Task...', action: () => actions.onRunTask?.() },
        { label: 'Run Build Task...', shortcut: 'Ctrl+Shift+B', action: () => actions.onRunBuildTask?.() },
        { label: 'Run Active File', action: () => actions.onRunActiveFile?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Configure Tasks...', action: () => actions.onConfigureTasks?.() },
        { label: 'Configure Default Build Task...', action: () => actions.onConfigureDefaultBuildTask?.() },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Welcome', action: () => actions.onWelcome?.() },
        { label: 'Documentation', action: () => actions.onDocumentation?.() },
        { label: 'Release Notes', action: () => actions.onReleaseNotes?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: () => actions.onKeyboardShortcuts?.() },
        { label: 'Report Issue', action: () => actions.onReportIssue?.() },
        { label: '', separator: true, action: () => {} },
        { label: 'About CubOS', action: () => actions.onAbout?.() },
      ],
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (label: string) => {
    setActiveMenu(activeMenu === label ? null : label);
  };

  const handleItemClick = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  return (
    <div
      ref={menuRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#2d2d30',
        color: '#ccc',
        height: '30px',
        borderBottom: '1px solid #3c3c3c',
        fontSize: '13px',
        position: 'relative',
        zIndex: 1000,
      }}
    >
      {menuItems.map((menu) => (
        <div key={menu.label} style={{ position: 'relative' }}>
          <span
            onClick={() => handleMenuClick(menu.label)}
            style={{
              padding: '4px 12px',
              cursor: 'pointer',
              background: activeMenu === menu.label ? '#3e3e42' : 'transparent',
              display: 'inline-block',
              height: '100%',
              lineHeight: '22px',
            }}
            onMouseEnter={() => {
              if (activeMenu && activeMenu !== menu.label) {
                setActiveMenu(menu.label);
              }
            }}
          >
            {menu.label}
          </span>
          {activeMenu === menu.label && menu.items && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: '#252526',
                border: '1px solid #454545',
                minWidth: '220px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                zIndex: 1001,
              }}
            >
              {menu.items.map((item, idx) => (
                <div key={idx}>
                  {item.separator ? (
                    <div style={{ height: '1px', background: '#454545', margin: '4px 0' }} />
                  ) : (
                    <div
                      onClick={() => !item.disabled && handleItemClick(item.action)}
                      style={{
                        padding: '6px 20px',
                        cursor: item.disabled ? 'default' : 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        color: item.disabled ? '#555' : '#ccc',
                        background: 'transparent',
                        opacity: item.disabled ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!item.disabled) {
                          e.currentTarget.style.background = '#2a2d2e';
                          e.currentTarget.style.color = '#fff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!item.disabled) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#ccc';
                        }
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span style={{ fontSize: '11px', color: '#888', marginLeft: '20px' }}>
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
