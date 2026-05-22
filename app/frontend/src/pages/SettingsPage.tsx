import { useState, useEffect } from "react";
import { Search, RotateCcw, Download, Upload, ChevronRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SettingsManager, type SettingDefinition } from "@/services/SettingsManager";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Editor");
  const [settings, setSettings] = useState(SettingsManager.getAll());
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});

  const categories = SettingsManager.getCategories();

  useEffect(() => {
    const unsubscribe = SettingsManager.onChange((newSettings) => {
      setSettings(newSettings);
    });
    SettingsManager.syncProviderDefinitions().catch(() => null);
    return unsubscribe;
  }, []);

  const filterDefinitions = (definitions: SettingDefinition[]) => {
    if (!searchQuery.trim()) return definitions;
    const query = searchQuery.toLowerCase();
    return definitions.filter(def =>
      def.label.toLowerCase().includes(query) ||
      def.description.toLowerCase().includes(query) ||
      def.key.toLowerCase().includes(query)
    );
  };

  const handleReset = (key: string) => {
    SettingsManager.reset(key as any);
  };

  const handleResetAll = () => {
    if (confirm('Reset all settings to their default values?')) {
      SettingsManager.resetAll();
    }
  };

  const handleExport = () => {
    const json = SettingsManager.exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cubos-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const success = SettingsManager.importSettings(text);
        if (success) {
          toast.success('Settings imported successfully');
        } else {
          toast.error('Failed to import settings. Please check the file format.');
        }
      }
    };
    input.click();
  };

  const renderSettingInput = (def: SettingDefinition) => {
    const value = settings[def.key as keyof typeof settings];

    switch (def.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean ?? def.default}
              onChange={(e) => SettingsManager.set(def.key as any, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value as number ?? def.default}
              onChange={(e) => SettingsManager.set(def.key as any, Number(e.target.value))}
              min={def.min}
              max={def.max}
              className="w-24 px-2 py-1 text-sm bg-surface border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <span className="text-xs text-muted-foreground">
              ({def.min} - {def.max})
            </span>
          </div>
        );

      case 'select':
        return (
          <select
            value={value as string ?? def.default}
            onChange={(e) => SettingsManager.set(def.key as any, e.target.value)}
            className="px-2 py-1 text-sm bg-surface border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {def.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'color':
        return (
          <input
            type="color"
            value={value as string ?? def.default}
            onChange={(e) => SettingsManager.set(def.key as any, e.target.value)}
            className="w-12 h-8 border border-border rounded cursor-pointer"
          />
        );

      case 'secret': {
        const revealed = revealedSecrets.has(def.key);
        const masked = String(value ?? '');
        const isDirty = secretDrafts[def.key] !== undefined;
        const editValue = isDirty ? secretDrafts[def.key] : (revealed ? (revealedValues[def.key] ?? '') : masked);
        return (
          <div className="flex items-center gap-1">
            <input
              type={revealed || isDirty ? 'text' : 'password'}
              value={editValue}
              onChange={(e) => setSecretDrafts(prev => ({ ...prev, [def.key]: e.target.value }))}
              placeholder="Paste API key…"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 max-w-md px-2 py-1 text-sm font-mono bg-surface border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={async () => {
                if (revealed) {
                  setRevealedSecrets(prev => { const n = new Set(prev); n.delete(def.key); return n; });
                  setRevealedValues(prev => { const n = { ...prev }; delete n[def.key]; return n; });
                  return;
                }
                try {
                  const real = await SettingsManager.revealSecret(def.key);
                  setRevealedValues(prev => ({ ...prev, [def.key]: real }));
                  setRevealedSecrets(prev => new Set(prev).add(def.key));
                } catch (err: any) {
                  toast.error('Could not reveal: ' + (err?.message || 'unknown'));
                }
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
              title={revealed ? 'Hide' : 'Show'}
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {isDirty && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await SettingsManager.saveSecret(def.key, secretDrafts[def.key]);
                      setSecretDrafts(prev => { const n = { ...prev }; delete n[def.key]; return n; });
                      setRevealedSecrets(prev => { const n = new Set(prev); n.delete(def.key); return n; });
                      setRevealedValues(prev => { const n = { ...prev }; delete n[def.key]; return n; });
                      toast.success('Saved to secrets store');
                    } catch (err: any) {
                      toast.error('Save failed: ' + (err?.message || 'unknown'));
                    }
                  }}
                  className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setSecretDrafts(prev => { const n = { ...prev }; delete n[def.key]; return n; })}
                  className="px-2 py-1 text-xs bg-surface border border-border rounded hover:bg-accent"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        );
      }

      case 'string':
      default:
        return (
          <input
            type="text"
            value={value as string ?? def.default}
            onChange={(e) => SettingsManager.set(def.key as any, e.target.value)}
            className="flex-1 max-w-md px-2 py-1 text-sm bg-surface border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        );
    }
  };

  const categoryDefinitions = filterDefinitions(
    SettingsManager.getDefinitionsByCategory(selectedCategory)
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Customize your CubOS experience</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-accent transition-colors text-foreground"
            title="Reset All Settings"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-accent transition-colors text-foreground"
            title="Export Settings"
          >
            <Upload className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-accent transition-colors text-foreground"
            title="Import Settings"
          >
            <Download className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-accent transition-colors text-foreground"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Categories */}
        <div className="w-56 border-r border-border bg-sidebar flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full pl-8 pr-2 py-1.5 text-sm bg-surface border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`
                  w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors
                  ${selectedCategory === category
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }
                `}
              >
                <span>{category}</span>
                {selectedCategory === category && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Settings */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{selectedCategory}</h2>
            
            {categoryDefinitions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No settings found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-6">
                {categoryDefinitions.map(def => {
                  const currentValue = settings[def.key as keyof typeof settings];
                  const defaultValue = def.default;
                  const isModified = currentValue !== defaultValue;

                  return (
                    <div key={def.key} className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-foreground">
                            {def.label}
                          </label>
                          {isModified && (
                            <span className="text-xs text-primary">Modified</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {def.description}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                          {def.key}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderSettingInput(def)}
                        {isModified && (
                          <button
                            onClick={() => handleReset(def.key)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
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
    </div>
  );
}
