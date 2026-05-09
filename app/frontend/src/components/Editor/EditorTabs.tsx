import { useState, useRef } from "react";
import { X, Pin, PinOff } from "lucide-react";

interface Tab {
  path: string;
  name: string;
  isDirty: boolean;
  isPinned?: boolean;
  isPreview?: boolean;
}

interface EditorTabsProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabPin?: (path: string) => void;
  onTabUnpin?: (path: string) => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
  onTabDoubleClick?: (path: string) => void;
}

export default function EditorTabs({ 
  tabs, 
  activeTab, 
  onTabClick, 
  onTabClose,
  onTabPin,
  onTabUnpin,
  onTabReorder,
  onTabDoubleClick
}: EditorTabsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabPath: string } | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index && onTabReorder) {
      onTabReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleContextMenu = (e: React.MouseEvent, tabPath: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabPath });
  };

  const handleDoubleClick = (path: string) => {
    if (onTabDoubleClick) {
      onTabDoubleClick(path);
    }
  };

  const pinnedTabs = tabs.filter(t => t.isPinned);
  const unpinnedTabs = tabs.filter(t => !t.isPinned);

  return (
    <>
      <div className="flex bg-sidebar border-b border-border overflow-x-auto h-[35px] scrollbar-thin">
        {pinnedTabs.map((tab, index) => (
          <div
            key={tab.path}
            draggable={!tab.isPinned}
            onClick={() => onTabClick(tab.path)}
            onDoubleClick={() => handleDoubleClick(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
            className={`
              flex items-center px-3 py-2 gap-2 cursor-pointer text-[13px] border-r border-border
              transition-colors min-w-max select-none
              ${activeTab === tab.path 
                ? 'bg-background text-foreground border-t-2 border-t-primary' 
                : 'bg-transparent text-muted-foreground hover:bg-accent border-t-2 border-t-transparent'
              }
            `}
          >
            <Pin className="w-3 h-3" />
            <span className={tab.isPreview ? 'italic' : ''}>{tab.name}</span>
            {tab.isDirty && <span className="text-primary">•</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {unpinnedTabs.map((tab, index) => {
          const globalIndex = pinnedTabs.length + index;
          return (
            <div
              key={tab.path}
              draggable
              onDragStart={(e) => handleDragStart(e, globalIndex)}
              onDragOver={(e) => handleDragOver(e, globalIndex)}
              onDrop={(e) => handleDrop(e, globalIndex)}
              onDragEnd={handleDragEnd}
              onClick={() => onTabClick(tab.path)}
              onDoubleClick={() => handleDoubleClick(tab.path)}
              onContextMenu={(e) => handleContextMenu(e, tab.path)}
              className={`
                flex items-center px-3 py-2 gap-2 cursor-pointer text-[13px] border-r border-border
                transition-colors min-w-max select-none
                ${activeTab === tab.path 
                  ? 'bg-background text-foreground border-t-2 border-t-primary' 
                  : 'bg-transparent text-muted-foreground hover:bg-accent border-t-2 border-t-transparent'
                }
                ${draggedIndex === globalIndex ? 'opacity-50' : ''}
                ${dropTargetIndex === globalIndex ? 'border-l-2 border-l-primary' : ''}
              `}
            >
              <span className={tab.isPreview ? 'italic' : ''}>{tab.name}</span>
              {tab.isDirty && <span className="text-primary">•</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.path);
                }}
                className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-popover border border-border rounded shadow-lg py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {tabs.find(t => t.path === contextMenu.tabPath)?.isPinned ? (
            <button
              onClick={() => {
                onTabUnpin?.(contextMenu.tabPath);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors text-left"
            >
              <PinOff className="w-3.5 h-3.5" />
              Unpin
            </button>
          ) : (
            <button
              onClick={() => {
                onTabPin?.(contextMenu.tabPath);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors text-left"
            >
              <Pin className="w-3.5 h-3.5" />
              Pin
            </button>
          )}
          <button
            onClick={() => {
              onTabClose(contextMenu.tabPath);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors text-left"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
          <button
            onClick={() => {
              tabs.forEach(t => {
                if (t.path !== contextMenu.tabPath && !t.isPinned) {
                  onTabClose(t.path);
                }
              });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors text-left"
          >
            Close Others
          </button>
          <button
            onClick={() => {
              tabs.forEach(t => {
                if (!t.isPinned) {
                  onTabClose(t.path);
                }
              });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors text-left"
          >
            Close All
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
