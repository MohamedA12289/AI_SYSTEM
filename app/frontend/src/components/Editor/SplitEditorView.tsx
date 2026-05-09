import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import EditorPanel from "./EditorPanel";
import EditorTabs from "./EditorTabs";
import Breadcrumbs from "./Breadcrumbs";
import { EditorGroup, EditorGroupManager } from "@/services/EditorGroupManager";
import ResizablePanel from "../ResizablePanel/ResizablePanel";

interface SplitEditorViewProps {
  projectName: string;
  onContentChange?: (path: string, content: string, isDirty: boolean) => void;
  onSave?: (path: string, content: string) => void;
  onCursorPositionChange?: (line: number, column: number) => void;
  onEditorMount?: (editor: any) => void;
  theme?: string;
}

export default function SplitEditorView({
  projectName,
  onContentChange,
  onSave,
  onCursorPositionChange,
  onEditorMount,
  theme
}: SplitEditorViewProps) {
  const [groups, setGroups] = useState<EditorGroup[]>(EditorGroupManager.getGroups());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(EditorGroupManager.getActiveGroupId());
  const editorRefs = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const unsubscribe = EditorGroupManager.onChange(() => {
      setGroups(EditorGroupManager.getGroups());
      setActiveGroupId(EditorGroupManager.getActiveGroupId());
    });
    return unsubscribe;
  }, []);

  const handleTabClick = (groupId: string, path: string) => {
    EditorGroupManager.setActiveFile(path, groupId);
    EditorGroupManager.setActiveGroup(groupId);
  };

  const handleTabClose = (groupId: string, path: string) => {
    EditorGroupManager.closeFile(path, groupId);
  };

  const handleTabPin = (groupId: string, path: string) => {
    EditorGroupManager.pinTab(path, groupId);
  };

  const handleTabUnpin = (groupId: string, path: string) => {
    EditorGroupManager.unpinTab(path, groupId);
  };

  const handleTabReorder = (groupId: string, fromIndex: number, toIndex: number) => {
    EditorGroupManager.reorderTabs(groupId, fromIndex, toIndex);
  };

  const handleTabDoubleClick = (groupId: string, path: string) => {
    EditorGroupManager.setActiveFile(path, groupId);
  };

  const handleCloseGroup = (groupId: string) => {
    EditorGroupManager.closeGroup(groupId);
  };

  const handleBreadcrumbNavigate = (path: string) => {
  };

  if (groups.length === 1) {
    const group = groups[0];
    const activeTab = group.tabs.find(t => t.path === group.activeTabPath);

    return (
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Breadcrumbs
          projectName={projectName}
          filePath={activeTab?.path || null}
          onNavigate={handleBreadcrumbNavigate}
        />
        <EditorTabs
          tabs={group.tabs}
          activeTab={group.activeTabPath}
          onTabClick={(path) => handleTabClick(group.id, path)}
          onTabClose={(path) => handleTabClose(group.id, path)}
          onTabPin={(path) => handleTabPin(group.id, path)}
          onTabUnpin={(path) => handleTabUnpin(group.id, path)}
          onTabReorder={(from, to) => handleTabReorder(group.id, from, to)}
          onTabDoubleClick={(path) => handleTabDoubleClick(group.id, path)}
        />
        <div className="flex-1 overflow-hidden bg-background">
          <EditorPanel
            projectName={projectName}
            filePath={activeTab?.path || null}
            onContentChange={onContentChange}
            onSave={onSave}
            onCursorPositionChange={onCursorPositionChange}
            onEditorMount={(editor) => {
              editorRefs.current.set(group.id, editor);
              onEditorMount?.(editor);
            }}
            theme={theme}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden min-w-0">
      {groups.map((group, index) => {
        const activeTab = group.tabs.find(t => t.path === group.activeTabPath);
        const isActive = group.id === activeGroupId;

        return (
          <div key={group.id} className="flex flex-1 min-w-0">
            {index > 0 && <div className="w-px bg-border" />}
            <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${isActive ? 'ring-1 ring-primary/50' : ''}`}>
              <div className="flex items-center justify-between bg-sidebar border-b border-border px-2 h-6">
                <span className="text-[10px] text-muted-foreground">Group {index + 1}</span>
                {groups.length > 1 && (
                  <button
                    onClick={() => handleCloseGroup(group.id)}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Close Group"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Breadcrumbs
                projectName={projectName}
                filePath={activeTab?.path || null}
                onNavigate={handleBreadcrumbNavigate}
              />
              <EditorTabs
                tabs={group.tabs}
                activeTab={group.activeTabPath}
                onTabClick={(path) => handleTabClick(group.id, path)}
                onTabClose={(path) => handleTabClose(group.id, path)}
                onTabPin={(path) => handleTabPin(group.id, path)}
                onTabUnpin={(path) => handleTabUnpin(group.id, path)}
                onTabReorder={(from, to) => handleTabReorder(group.id, from, to)}
                onTabDoubleClick={(path) => handleTabDoubleClick(group.id, path)}
              />
              <div className="flex-1 overflow-hidden bg-background">
                <EditorPanel
                  projectName={projectName}
                  filePath={activeTab?.path || null}
                  onContentChange={onContentChange}
                  onSave={onSave}
                  onCursorPositionChange={onCursorPositionChange}
                  onEditorMount={(editor) => {
                    editorRefs.current.set(group.id, editor);
                    if (isActive) {
                      onEditorMount?.(editor);
                    }
                  }}
                  theme={theme}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
