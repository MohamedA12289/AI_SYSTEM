import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { api } from "@/services/api";
import type { ProjectFile } from "@/types";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
  loaded?: boolean;
}

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map: Record<string, TreeNode> = {};

  for (const f of files) {
    const parts = f.path.replace(/\\/g, "/").split("/").filter(Boolean);
    let current = root;
    let cumPath = "";
    for (let i = 0; i < parts.length; i++) {
      cumPath = cumPath ? `${cumPath}/${parts[i]}` : parts[i];
      if (!map[cumPath]) {
        const node: TreeNode = {
          name: parts[i],
          path: cumPath,
          type: i === parts.length - 1 ? f.type as any : "directory",
          children: i < parts.length - 1 ? [] : undefined,
          loaded: true,
        };
        map[cumPath] = node;
        current.push(node);
      }
      if (i < parts.length - 1) {
        current = map[cumPath].children!;
      }
    }
  }
  return root;
}

interface FileTreeProps {
  projectId: string;
  onOpenFile: (path: string, name: string) => void;
  activeTabPath: string | null;
  selectedPaths?: string[];
  onToggleSelect?: (path: string) => void;
}

function TreeNodeItem({ node, depth, projectId, onOpenFile, activeTabPath, selectedPaths, onToggleSelect }: {
  node: TreeNode;
  depth: number;
  projectId: string;
  onOpenFile: (path: string, name: string) => void;
  activeTabPath: string | null;
  selectedPaths?: string[];
  onToggleSelect?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [children, setChildren] = useState<TreeNode[]>(node.children ?? []);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    if (node.type === "directory") {
      if (!expanded) {
        try {
          const res = await api.files.list(projectId, node.path);
          setChildren(buildTree(res.items ?? []));
        } catch {}
      }
      setExpanded((v) => !v);
    } else {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        onToggleSelect?.(node.path);
      } else {
        onOpenFile(node.path, node.name);
      }
    }
  }, [expanded, node, projectId, onOpenFile, onToggleSelect]);

  const isActive = activeTabPath === node.path;
  const isSelected = selectedPaths?.includes(node.path);
  const indent = depth * 14;

  return (
    <div>
      <div
        onClick={toggle}
        className={`flex items-center gap-1 py-0.5 px-2 cursor-pointer select-none text-[12px] rounded-sm mx-1 group
          ${isActive ? "bg-accent text-accent-foreground" : isSelected ? "bg-primary/15 text-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
        style={{ paddingLeft: `${8 + indent}px` }}
        title={node.type === "file" ? "Click to open · Ctrl+Click to select" : undefined}
      >
        {node.type === "directory" ? (
          <>
            {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
            {expanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-yellow-500/70" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-yellow-500/70" />}
          </>
        ) : (
          <>
            <span className="w-3 h-3 shrink-0" />
            <File className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-blue-400/70"}`} />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {isSelected && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
      </div>
      {node.type === "directory" && expanded && children.map((child) => (
        <TreeNodeItem key={child.path} node={child} depth={depth + 1} projectId={projectId} onOpenFile={onOpenFile} activeTabPath={activeTabPath} selectedPaths={selectedPaths} onToggleSelect={onToggleSelect} />
      ))}
    </div>
  );
}

export function FileTree({ projectId, onOpenFile, activeTabPath, selectedPaths, onToggleSelect }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api.files.list(projectId, "").then((res) => {
      setTree(buildTree(res.items ?? []));
    }).catch(() => {});
  }, [projectId]);

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin py-1">
      {tree.length === 0 ? (
        <p className="text-[11px] text-muted-foreground px-3 py-2">No files found</p>
      ) : (
        tree.map((node) => (
          <TreeNodeItem key={node.path} node={node} depth={0} projectId={projectId} onOpenFile={onOpenFile} activeTabPath={activeTabPath} selectedPaths={selectedPaths} onToggleSelect={onToggleSelect} />
        ))
      )}
    </div>
  );
}
