import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface GoToLineProps {
  totalLines: number;
  onGoToLine: (lineNumber: number) => void;
  onClose: () => void;
}

export default function GoToLine({ totalLines, onGoToLine, onClose }: GoToLineProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const lineNumber = parseInt(input, 10);
      if (!isNaN(lineNumber) && lineNumber >= 1 && lineNumber <= totalLines) {
        onGoToLine(lineNumber);
        onClose();
      }
    }
  };

  const handleGo = () => {
    const lineNumber = parseInt(input, 10);
    if (!isNaN(lineNumber) && lineNumber >= 1 && lineNumber <= totalLines) {
      onGoToLine(lineNumber);
      onClose();
    }
  };

  const isValid = () => {
    if (!input) return false;
    const lineNumber = parseInt(input, 10);
    return !isNaN(lineNumber) && lineNumber >= 1 && lineNumber <= totalLines;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-medium">Go to Line</div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Enter line number (1-${totalLines})`}
              className="w-full px-3 py-2 bg-surface border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-foreground hover:bg-accent rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGo}
              disabled={!isValid()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
