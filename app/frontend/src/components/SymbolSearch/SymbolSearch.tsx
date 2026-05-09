import { useState, useEffect, useRef } from "react";
import { Search, X, Hash } from "lucide-react";

interface Symbol {
  name: string;
  line: number;
  type: 'function' | 'class' | 'interface' | 'const' | 'let' | 'var' | 'type';
}

interface SymbolSearchProps {
  fileContent: string;
  onGoToSymbol: (lineNumber: number) => void;
  onClose: () => void;
}

export default function SymbolSearch({ fileContent, onGoToSymbol, onClose }: SymbolSearchProps) {
  const [query, setQuery] = useState("");
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [filteredSymbols, setFilteredSymbols] = useState<Symbol[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const extractedSymbols = extractSymbols(fileContent);
    setSymbols(extractedSymbols);
    setFilteredSymbols(extractedSymbols);
  }, [fileContent]);

  const extractSymbols = (content: string): Symbol[] => {
    const lines = content.split('\n');
    const symbols: Symbol[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      const functionMatch = trimmed.match(/(?:function|const|let|var)\s+(\w+)\s*[=:]?\s*(?:async\s*)?\(|(?:async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        symbols.push({
          name: functionMatch[1] || functionMatch[2],
          line: index + 1,
          type: 'function'
        });
      }
      
      const classMatch = trimmed.match(/class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          line: index + 1,
          type: 'class'
        });
      }
      
      const interfaceMatch = trimmed.match(/interface\s+(\w+)/);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1],
          line: index + 1,
          type: 'interface'
        });
      }
      
      const typeMatch = trimmed.match(/type\s+(\w+)\s*=/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          line: index + 1,
          type: 'type'
        });
      }
    });

    return symbols;
  };

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
      setFilteredSymbols(symbols);
      setSelectedIndex(0);
      return;
    }

    const lowerQuery = value.toLowerCase();
    const filtered = symbols
      .filter(symbol => fuzzyMatch(value, symbol.name))
      .sort((a, b) => {
        const aStartsWith = a.name.toLowerCase().startsWith(lowerQuery);
        const bStartsWith = b.name.toLowerCase().startsWith(lowerQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return a.name.localeCompare(b.name);
      });

    setFilteredSymbols(filtered);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredSymbols.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSymbols[selectedIndex]) {
        onGoToSymbol(filteredSymbols[selectedIndex].line);
        onClose();
      }
    }
  };

  const handleSymbolClick = (symbol: Symbol) => {
    onGoToSymbol(symbol.line);
    onClose();
  };

  const getTypeIcon = (type: string) => {
    return <Hash className="w-4 h-4 text-muted-foreground" />;
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
            placeholder="Search symbols in file..."
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
          {filteredSymbols.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {symbols.length === 0 ? "No symbols found in file" : "No matching symbols"}
            </div>
          ) : (
            <div className="py-1">
              {filteredSymbols.map((symbol, index) => (
                <div
                  key={`${symbol.name}-${symbol.line}`}
                  onClick={() => handleSymbolClick(symbol)}
                  className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {getTypeIcon(symbol.type)}
                  <div className="flex-1">
                    <div className="text-sm">{symbol.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Line {symbol.line} · {symbol.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
