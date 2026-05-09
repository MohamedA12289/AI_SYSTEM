import { ChevronRight, Folder } from "lucide-react";

interface BreadcrumbsProps {
  projectName: string;
  filePath: string | null;
  onNavigate?: (path: string) => void;
}

export default function Breadcrumbs({ projectName, filePath, onNavigate }: BreadcrumbsProps) {
  if (!filePath) return null;

  const pathParts = filePath.split('/');
  
  const handleClick = (index: number) => {
    if (!onNavigate) return;
    if (index === 0) {
      onNavigate('');
    } else {
      const path = pathParts.slice(0, index).join('/');
      onNavigate(path);
    }
  };

  return (
    <div className="flex items-center h-[22px] bg-sidebar border-b border-border px-3 gap-1 text-[11px] overflow-hidden">
      <button
        onClick={() => handleClick(0)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-accent"
        title={projectName}
      >
        <Folder className="w-3 h-3" />
        <span className="whitespace-nowrap">{projectName}</span>
      </button>
      
      {pathParts.map((part, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <button
            onClick={() => handleClick(index + 1)}
            className="text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-accent whitespace-nowrap"
            title={pathParts.slice(0, index + 1).join('/')}
          >
            {part}
          </button>
        </div>
      ))}
    </div>
  );
}
