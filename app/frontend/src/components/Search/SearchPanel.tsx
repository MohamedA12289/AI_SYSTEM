import { useState, useCallback } from "react";
import { Search, CaseSensitive, WholeWord, Regex, ChevronRight, ChevronDown, Replace, ReplaceAll } from "lucide-react";

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface SearchMatch {
  path: string;
  line: number;
  content: string;
  lineNumber?: number;
}

interface SearchPanelProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchMatch[];
  isSearching: boolean;
  onResultClick: (path: string, line?: number) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  onSearch: (query: string, options: SearchOptions) => void;
  onReplace?: (search: string, replace: string, filePath?: string) => void;
  onReplaceAll?: (search: string, replace: string) => void;
}

export default function SearchPanel({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
  onResultClick,
  searchOptions,
  onSearchOptionsChange,
  onSearch,
  onReplace,
  onReplaceAll,
}: SearchPanelProps) {
  const [replaceText, setReplaceText] = useState("");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [replaceVisible, setReplaceVisible] = useState(false);

  const groupedResults: Record<string, SearchMatch[]> = {};
  searchResults.forEach(result => {
    if (!groupedResults[result.path]) groupedResults[result.path] = [];
    groupedResults[result.path].push(result);
  });

  const toggleFileExpanded = (path: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(path)) newExpanded.delete(path);
    else newExpanded.add(path);
    setExpandedFiles(newExpanded);
  };

  const handleSearchInputChange = (value: string) => {
    onSearchQueryChange(value);
    if (value.trim()) onSearch(value, searchOptions);
  };

  const toggleOption = (option: keyof SearchOptions) => {
    const newOptions = { ...searchOptions, [option]: !searchOptions[option] };
    onSearchOptionsChange(newOptions);
    if (searchQuery.trim()) onSearch(searchQuery, newOptions);
  };

  const highlightMatch = useCallback((content: string, query: string, options: SearchOptions) => {
    if (!query) return content;
    try {
      let pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (options.wholeWord) pattern = `\\b${pattern}\\b`;
      const regex = new RegExp(`(${pattern})`, options.caseSensitive ? 'g' : 'gi');
      const parts = content.split(regex);
      return parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="bg-yellow-400/30 text-foreground rounded-sm">{part}</mark>
          : part
      );
    } catch {
      return content;
    }
  }, []);

  const totalMatches = searchResults.length;
  const totalFiles = Object.keys(groupedResults).length;

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="px-3 py-2 border-b border-border space-y-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setReplaceVisible(v => !v)}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={replaceVisible ? "Hide Replace" : "Show Replace"}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${replaceVisible ? 'rotate-90' : ''}`} />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder="Search"
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-surface border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              autoFocus
            />
          </div>
        </div>

        {replaceVisible && (
          <div className="flex items-center gap-1 pl-5">
            <div className="relative flex-1">
              <Replace className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace"
                className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-surface border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
            <button
              onClick={() => onReplaceAll?.(searchQuery, replaceText)}
              disabled={!searchQuery || !onReplaceAll}
              title="Replace All"
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <ReplaceAll className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          {[
            { key: 'caseSensitive' as const, icon: CaseSensitive, title: 'Match Case (Alt+C)' },
            { key: 'wholeWord' as const, icon: WholeWord, title: 'Match Whole Word (Alt+W)' },
            { key: 'useRegex' as const, icon: Regex, title: 'Use Regular Expression (Alt+R)' },
          ].map(({ key, icon: Icon, title }) => (
            <button
              key={key}
              onClick={() => toggleOption(key)}
              className={`p-1 rounded transition-colors ${
                searchOptions[key]
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
              title={title}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <div className="ml-auto">
            {searchQuery && !isSearching && (
              <span className="text-[10px] text-muted-foreground">
                {totalMatches} in {totalFiles} file{totalFiles !== 1 ? 's' : ''}
              </span>
            )}
            {isSearching && <span className="text-[10px] text-muted-foreground animate-pulse">Searching…</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {!isSearching && searchResults.length === 0 && searchQuery && (
          <div className="text-[10px] text-muted-foreground py-4 px-2 text-center">
            No results for "{searchQuery}"
          </div>
        )}
        {!searchQuery && (
          <div className="text-[10px] text-muted-foreground py-4 px-2 text-center">
            Type to search across all files
          </div>
        )}

        {Object.entries(groupedResults).map(([filePath, matches]) => {
          const isExpanded = !expandedFiles.has(filePath);
          const fileName = filePath.split('/').pop() || filePath;
          const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
          return (
            <div key={filePath} className="mb-0.5">
              <div
                onClick={() => toggleFileExpanded(filePath)}
                className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-accent rounded cursor-pointer group"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-[11px] text-foreground font-medium truncate">{fileName}</span>
                {fileDir && <span className="text-[10px] text-muted-foreground truncate flex-1">{fileDir}</span>}
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground ml-auto flex-shrink-0">
                  {matches.length}
                </span>
              </div>

              {isExpanded && (
                <div className="ml-4 border-l border-border/50">
                  {matches.map((match, idx) => (
                    <div
                      key={`${filePath}-${idx}`}
                      onClick={() => onResultClick(match.path, match.line)}
                      className="py-1 px-2 hover:bg-accent rounded cursor-pointer flex items-start gap-2 group"
                    >
                      {match.lineNumber !== undefined && (
                        <span className="text-[9px] text-muted-foreground font-mono w-6 text-right flex-shrink-0 mt-0.5 select-none">
                          {match.lineNumber}
                        </span>
                      )}
                      <div className="text-[10px] font-mono text-foreground/90 truncate flex-1">
                        {highlightMatch(match.content.trim(), searchQuery, searchOptions)}
                      </div>
                      {replaceVisible && replaceText && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onReplace?.(searchQuery, replaceText, match.path); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all flex-shrink-0"
                          title="Replace this match"
                        >
                          <Replace className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
