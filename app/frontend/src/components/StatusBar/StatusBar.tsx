import { useState } from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';

interface StatusBarProps {
  currentFile: string | null;
  lineNumber: number;
  columnNumber: number;
  branch?: string;
  ahead?: number;
  behind?: number;
  githubUsername?: string;
  onBranchClick?: () => void;
  onLanguageClick?: () => void;
  onGitHubClick?: () => void;
}

function getLanguageLabel(filename: string | null): string {
  if (!filename) return '';
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'py': 'Python',
    'css': 'CSS',
    'html': 'HTML',
    'json': 'JSON',
    'md': 'Markdown',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'sql': 'SQL',
    'sh': 'Shell',
    'bash': 'Bash',
    'rs': 'Rust',
    'go': 'Go',
    'rb': 'Ruby',
    'php': 'PHP',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'cs': 'C#',
    'kt': 'Kotlin',
    'swift': 'Swift',
  };
  return languageMap[ext || ''] || 'Plain Text';
}

export default function StatusBar({
  currentFile,
  lineNumber,
  columnNumber,
  branch = 'main',
  ahead = 0,
  behind = 0,
  githubUsername,
  onBranchClick,
  onLanguageClick,
  onGitHubClick,
}: StatusBarProps) {
  const [langHover, setLangHover] = useState(false);
  const [branchHover, setBranchHover] = useState(false);

  const language = currentFile ? getLanguageLabel(currentFile) : '';

  return (
    <div className="flex items-center justify-between h-[22px] bg-sidebar border-t border-border px-2 text-[11px] text-muted-foreground select-none flex-shrink-0">
      <div className="flex items-center gap-1">
        <button
          onClick={onBranchClick}
          onMouseEnter={() => setBranchHover(true)}
          onMouseLeave={() => setBranchHover(false)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${branchHover ? 'bg-accent text-foreground' : ''}`}
        >
          <GitBranch className="w-3 h-3" />
          <span>{branch}</span>
          {ahead > 0 && <span className="text-xs">↑{ahead}</span>}
          {behind > 0 && <span className="text-xs">↓{behind}</span>}
        </button>
      </div>

      <div className="flex items-center gap-1">
        {currentFile && (
          <>
            <span className="px-1.5 py-0.5">Ln {lineNumber}, Col {columnNumber}</span>
            <span className="px-1.5 py-0.5">UTF-8</span>
          </>
        )}
        {language && (
          <button
            onClick={onLanguageClick}
            onMouseEnter={() => setLangHover(true)}
            onMouseLeave={() => setLangHover(false)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${langHover ? 'bg-accent text-foreground' : ''}`}
          >
            {language}
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </button>
        )}
        {githubUsername && (
          <button
            onClick={onGitHubClick}
            className="px-1.5 py-0.5 rounded hover:bg-accent hover:text-foreground transition-colors"
          >
            @{githubUsername}
          </button>
        )}
      </div>
    </div>
  );
}