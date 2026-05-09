import { useState, useEffect, useRef } from "react";
import { Search, X, File } from "lucide-react";

interface QuickOpenProps {
  files: string[];
  onSelectFile: (path: string) => void;
  onClose: () => void;
}

export default function QuickOpen({ files, onSelectFile, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setFilteredFiles(files.slice(0, 50));
  }, [files]);

  const fuzzyMatch = (query: string, text: string): boolean => {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    
    if (!value.trim()) {
      setFilteredFiles(files.slice(0, 50));
      setSelectedIndex(0);
      return;
    }

    const lowerQuery = value.toLowerCase();
    const filtered = files
      .filter(file => {
        const fileName = file.split('/').pop() || file;
        return fuzzyMatch(value, fileName) || fuzzyMatch(value, file);
      })
      .sort((a, b) => {
        const aName = a.split('/').pop() || a;
        const bName = b.split('/').pop() || b;
        const aStartsWith = aName.toLowerCase().startsWith(lowerQuery);
        const bStartsWith = bName.toLowerCase().startsWith(lowerQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return aName.localeCompare(bName);
      })
      .slice(0, 50);

    setFilteredFiles(filtered);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        onSelectFile(filteredFiles[selectedIndex]);
        onClose();
      }
    }
  };

  const handleFileClick = (file: string) => {
    onSelectFile(file);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No files found
            </div>
          ) : (
            <div className="py-1">
              {filteredFiles.map((file, index) => {
                const fileName = file.split('/').pop() || file;
                const filePath = file.substring(0, file.length - fileName.length);
                
                return (
                  <div
                    key={file}
                    onClick={() => handleFileClick(file)}
                    className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <File className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{fileName}</div>
                      {filePath && (
                        <div className="text-xs text-muted-foreground truncate">
                          {filePath}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
