import { useState, useEffect, useRef } from "react";
import { GitBranch, X, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";

interface BranchSwitcherProps {
  projectName: string;
  currentBranch: string;
  onClose: () => void;
  onBranchSwitch?: (branch: string) => void;
}

export default function BranchSwitcher({ projectName, currentBranch, onClose, onBranchSwitch }: BranchSwitcherProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const result = await api.git.branches(projectName);
      const branchList = result.branches || [];
      setBranches(branchList);
      const currentIndex = branchList.indexOf(currentBranch);
      if (currentIndex >= 0) {
        setSelectedIndex(currentIndex);
      }
    } catch (error) {
      toast.error('Failed to load branches: ' + (error as Error).message);
      setBranches([currentBranch]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = branches.filter(branch =>
    branch.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredBranches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredBranches[selectedIndex]) {
        handleBranchSelect(filteredBranches[selectedIndex]);
      }
    }
  };

  const handleBranchSelect = async (branch: string) => {
    if (branch === currentBranch) {
      onClose();
      return;
    }

    try {
      await api.git.checkout(projectName, branch);
      toast.success(`Switched to ${branch}`);
      if (onBranchSwitch) {
        onBranchSwitch(branch);
      }
    } catch (error: any) {
      toast.error(`Failed to switch branch: ${error?.message || "unknown error"}`);
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search branches..."
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
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading branches...
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No branches found
            </div>
          ) : (
            <div className="py-1">
              {filteredBranches.map((branch, index) => (
                <div
                  key={branch}
                  onClick={() => handleBranchSelect(branch)}
                  className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    <span className="text-sm">{branch}</span>
                  </div>
                  {branch === currentBranch && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border bg-sidebar/50 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Current: {currentBranch}</span>
            <span>↑↓ navigate • Enter select • Esc close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
