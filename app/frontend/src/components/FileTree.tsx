import { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, File, FileText, FileCode, Image,
  FileJson, Folder, FolderOpen, Package, Settings, Loader2,
  Plus, FilePlus, FolderPlus, Trash2, Edit2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import ContextMenu, { ContextMenuItem } from './ContextMenu/ContextMenu';
import { getApiBase } from '@/services/api';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

interface FileTreeProps {
  projectName: string;
  onFileClick?: (path: string) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}

const FILE_NESTING_RULES: Record<string, string[]> = {
  'package.json': ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  'tsconfig.json': ['tsconfig.*.json'],
  '.env': ['.env.local', '.env.development', '.env.production', '.env.test'],
  'vite.config.ts': ['vite.config.*.ts'],
  'tailwind.config.js': ['tailwind.config.ts', 'postcss.config.js'],
};

function getFileIcon(filename: string, isDirectory: boolean, isOpen: boolean = false) {
  if (isDirectory) {
    return isOpen ? <FolderOpen className="w-4 h-4 text-gray-400" /> : <Folder className="w-4 h-4 text-gray-400" />;
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const basename = filename.toLowerCase();

  if (basename === 'package.json' || basename.includes('package')) {
    return <Package className="w-4 h-4 text-red-400" />;
  }
  if (basename.endsWith('.config.js') || basename.endsWith('.config.ts')) {
    return <Settings className="w-4 h-4 text-gray-400" />;
  }
  if (ext === 'ts' || ext === 'tsx') {
    return <FileCode className="w-4 h-4 text-gray-400" />;
  }
  if (ext === 'js' || ext === 'jsx') {
    return <FileCode className="w-4 h-4 text-yellow-400" />;
  }
  if (ext === 'json') {
    return <FileJson className="w-4 h-4 text-yellow-400" />;
  }
  if (ext === 'md' || ext === 'txt') {
    return <FileText className="w-4 h-4 text-gray-400" />;
  }
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'svg') {
    return <Image className="w-4 h-4 text-purple-400" />;
  }

  return <File className="w-4 h-4 text-gray-400" />;
}

function shouldNestFile(parentFile: string, childFile: string): boolean {
  const rules = FILE_NESTING_RULES[parentFile];
  if (!rules) return false;

  return rules.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(childFile);
    }
    return childFile === pattern;
  });
}

function organizeFilesWithNesting(items: FileItem[]): FileItem[] {
  const nested = new Set<string>();

  items.forEach(item => {
    if (item.type === 'file') {
      const children = items.filter(child =>
        child.type === 'file' &&
        child.name !== item.name &&
        shouldNestFile(item.name, child.name)
      );

      if (children.length > 0) {
        children.forEach(child => nested.add(child.path));
      }
    }
  });

  return items.filter(item => !nested.has(item.path));
}

function FileTreeItem({
  item,
  projectName,
  level,
  onFileClick,
  onRefresh,
}: {
  item: FileItem;
  projectName: string;
  level: number;
  onFileClick?: (path: string) => void;
  onRefresh?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClick = async () => {
    if (item.type === 'directory') {
      if (!isExpanded && children.length === 0) {
        setIsLoading(true);
        try {
          const response = await fetch(`${getApiBase()}/project/${projectName}/files?subpath=${encodeURIComponent(item.path)}`);
          const data = await response.json();
          const items = data.items || [];

          const organized = organizeFilesWithNesting(items);
          setChildren(organized);
        } catch (error) {
          console.error('Error loading directory:', error);
        } finally {
          setIsLoading(false);
        }
      }
      setIsExpanded(!isExpanded);
    } else {
      onFileClick?.(item.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (item.type === 'file') {
      items.push({
        label: 'Open',
        icon: <Eye className="w-4 h-4" />,
        onClick: () => onFileClick?.(item.path)
      });
    }

    if (item.type === 'directory') {
      items.push({
        label: 'New File',
        icon: <FilePlus className="w-4 h-4" />,
        onClick: async () => {
          const fileName = prompt('Enter file name:');
          if (!fileName) return;
          try {
            const filePath = `${item.path}/${fileName}`;
            const response = await fetch(`${getApiBase()}/project/${projectName}/file/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: filePath, content: '' })
            });
            if (response.ok) {
              onRefresh?.();
            } else {
              toast.error('Failed to create file');
            }
          } catch (error) {
            console.error('Error creating file:', error);
            toast.error('Failed to create file');
          }
        }
      });
      items.push({
        label: 'New Folder',
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: async () => {
          const folderName = prompt('Enter folder name:');
          if (!folderName) return;
          try {
            const folderPath = `${item.path}/${folderName}`;
            const response = await fetch(`${getApiBase()}/project/${projectName}/directory`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: folderPath })
            });
            if (response.ok) {
              onRefresh?.();
            } else {
              toast.error('Failed to create folder');
            }
          } catch (error) {
            console.error('Error creating folder:', error);
            toast.error('Failed to create folder');
          }
        }
      });
      items.push({ label: '', separator: true, onClick: () => {} });
    }

    items.push({
      label: 'Rename',
      icon: <Edit2 className="w-4 h-4" />,
      onClick: async () => {
        const newName = prompt('Enter new name:', item.name);
        if (!newName || newName === item.name) return;
        try {
          const pathParts = item.path.split('/');
          pathParts[pathParts.length - 1] = newName;
          const newPath = pathParts.join('/');
          const response = await fetch(`${getApiBase()}/project/${projectName}/file/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: item.path, to: newPath })
          });
          if (response.ok) {
            onRefresh?.();
          } else {
            toast.error('Failed to rename');
          }
        } catch (error) {
          console.error('Error renaming:', error);
          toast.error('Failed to rename');
        }
      }
    });

    items.push({
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: async () => {
        if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;
        try {
          const response = await fetch(`${getApiBase()}/project/${projectName}/file?path=${encodeURIComponent(item.path)}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            onRefresh?.();
          } else {
            toast.error('Failed to delete');
          }
        } catch (error) {
          console.error('Error deleting:', error);
          toast.error('Failed to delete');
        }
      }
    });

    return items;
  };

  const shouldCompact = item.type === 'directory' && children.length === 1 && children[0].type === 'directory';
  const compactPath = shouldCompact ? `${item.name}/${children[0].name}` : item.name;

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center px-2 py-0.5 cursor-pointer text-[13px] text-foreground hover:bg-accent select-none font-mono"
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {item.type === 'directory' && (
          <span className="mr-1 text-muted-foreground">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        )}
        {item.type === 'file' && <span className="w-4" />}

        <span className="mr-2">
          {getFileIcon(item.name, item.type === 'directory', isExpanded)}
        </span>

        <span className={item.type === 'directory' ? 'text-gray-300' : ''}>
          {compactPath}
        </span>
      </div>

      {isExpanded && children.length > 0 && !shouldCompact && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              projectName={projectName}
              level={level + 1}
              onFileClick={onFileClick}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {shouldCompact && isExpanded && children[0] && (
        <FileTreeItem
          item={children[0]}
          projectName={projectName}
          level={level}
          onFileClick={onFileClick}
          onRefresh={onRefresh}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default function FileTree({ projectName, onFileClick, refreshKey, onRefresh }: FileTreeProps) {
  const [rootItems, setRootItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localRefreshTick, setLocalRefreshTick] = useState(0);

  const handleRefresh = () => {
    setLocalRefreshTick(t => t + 1);
    onRefresh?.();
  };

  useEffect(() => {
    const loadRootFiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${getApiBase()}/project/${projectName}/files`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const items = data.items || [];
        const organized = organizeFilesWithNesting(items);
        setRootItems(organized);
      } catch (err) {
        console.error('Error loading root files:', err);
        setError('Failed to load files');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectName) {
      loadRootFiles();
    }
  }, [projectName, refreshKey, localRefreshTick]);

  if (isLoading) {
    return (
      <div className="p-2 text-muted-foreground text-xs flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading files...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 text-destructive text-xs">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-accent"
      >
        <div className="flex items-center gap-1">
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>{projectName}</span>
        </div>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const fileName = prompt('Enter file name:');
            if (!fileName) return;
            try {
              const response = await fetch(`${getApiBase()}/project/${projectName}/file/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fileName, content: '' })
              });
              if (response.ok) {
                handleRefresh();
              } else {
                toast.error('Failed to create file');
              }
            } catch (error) {
              console.error('Error creating file:', error);
              toast.error('Failed to create file');
            }
          }}
          className="p-0.5 rounded hover:bg-accent/50"
          title="New File"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-auto">
          {rootItems.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              projectName={projectName}
              level={0}
              onFileClick={onFileClick}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
