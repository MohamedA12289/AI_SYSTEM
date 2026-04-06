import { useEffect, useState } from "react";
import { Info, Monitor, Moon, Sun, Hammer, Play, Cloud, HardDrive } from "lucide-react";
import { api } from "@/services/api";
import type { AssistantMode, AppSettings } from "@/types";

interface Props { assistantMode: AssistantMode; onModeChange: (mode: AssistantMode) => void; }

export default function SettingsPage({ assistantMode, onModeChange }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [activeOllamaModel, setActiveOllamaModel] = useState<string>("");
  const [meta, setMeta] = useState<{ appName: string; version: string; platform: string } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [activeProvider, setActiveProvider] = useState<"ollama" | "groq">("ollama");
  const [groqModels, setGroqModels] = useState<string[]>([]);
  const [activeGroqModel, setActiveGroqModel] = useState<string>("qwen/qwen3-32b");

  useEffect(() => {
    api.settings.get().then(setSettings).catch(() => null);
    api.models.list().then((d) => { setModels(d.models ?? []); setActiveOllamaModel(d.active_model ?? ""); }).catch(() => setModels([]));
    api.models.listOllama().then((d) => setOllamaModels(d.models ?? [])).catch(() => setOllamaModels([]));
    window.cubosDesktop?.getMeta().then(setMeta).catch(() => setMeta(null));
    api.provider.get().then((d) => setActiveProvider(d.active as "ollama" | "groq")).catch(() => null);
    api.groqModels.list().then((d) => { setGroqModels(d.groq_models ?? []); setActiveGroqModel(d.active_groq_model); }).catch(() => null);
  }, []);

  const patchSettings = async (patchValue: any) => {
    const next = await api.settings.patch(patchValue);
    setSettings(next);
  };

  const switchProvider = async (p: "ollama" | "groq") => {
    setActiveProvider(p);
    await api.provider.set(p).catch(() => null);
  };

  const applyTheme = (t: "dark" | "light" | "system") => {
    setTheme(t);
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else window.matchMedia("(prefers-color-scheme: dark)").matches ? root.classList.add("dark") : root.classList.remove("dark");
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">AI Backend</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => switchProvider("ollama")} className={`flex flex-col items-center gap-2 py-4 rounded-lg border transition-all ${activeProvider === "ollama" ? "border-foreground/30 bg-secondary" : "border-border hover:border-foreground/15"}`}>
              <HardDrive className={`w-5 h-5 ${activeProvider === "ollama" ? "text-foreground" : "text-muted-foreground"}`} />
              <span className="text-[12px] font-medium text-foreground">Local (Ollama)</span>
              <span className="text-[10px] text-muted-foreground text-center px-2">Runs on your machine — private, no quota</span>
            </button>
            <button onClick={() => switchProvider("groq")} className={`flex flex-col items-center gap-2 py-4 rounded-lg border transition-all ${activeProvider === "groq" ? "border-foreground/30 bg-secondary" : "border-border hover:border-foreground/15"}`}>
              <Cloud className={`w-5 h-5 ${activeProvider === "groq" ? "text-foreground" : "text-muted-foreground"}`} />
              <span className="text-[12px] font-medium text-foreground">Cloud (Groq)</span>
              <span className="text-[10px] text-muted-foreground text-center px-2">Ultra-fast inference via Groq API</span>
            </button>
          </div>
          {activeProvider === "ollama" && ollamaModels.length > 0 && (
            <div className="mt-3">
              <label className="text-[11px] text-muted-foreground block mb-1">Local Ollama Model</label>
              <select value={activeOllamaModel} onChange={(e) => { setActiveOllamaModel(e.target.value); api.models.activate(e.target.value).catch(() => null); }} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30">
                {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {activeProvider === "groq" && groqModels.length > 0 && (
            <div className="mt-3">
              <label className="text-[11px] text-muted-foreground block mb-1">Groq Model</label>
              <select value={activeGroqModel} onChange={(e) => { setActiveGroqModel(e.target.value); api.groqModels.activate(e.target.value).catch(() => null); }} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30">
                {groqModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><Info className="w-3 h-3" />If Groq fails, it automatically falls back to Ollama.</p>
        </section>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">Assistant Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { onModeChange('build'); api.settings.setAssistantMode('build').then(setSettings).catch(()=>null); }} className={`flex flex-col items-center gap-2 py-4 rounded-lg border transition-all ${assistantMode === 'build' ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}><Hammer className={`w-5 h-5 ${assistantMode === 'build' ? 'text-foreground' : 'text-muted-foreground'}`} /><span className="text-[12px] font-medium text-foreground">Build</span><span className="text-[10px] text-muted-foreground text-center px-2">Execute actions, write files, run commands</span></button>
            <button onClick={() => { onModeChange('plan'); api.settings.setAssistantMode('plan').then(setSettings).catch(()=>null); }} className={`flex flex-col items-center gap-2 py-4 rounded-lg border transition-all ${assistantMode === 'plan' ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}><Play className={`w-5 h-5 ${assistantMode === 'plan' ? 'text-foreground' : 'text-muted-foreground'}`} /><span className="text-[12px] font-medium text-foreground">Plan</span><span className="text-[10px] text-muted-foreground text-center px-2">Analyze, research, plan — no execution</span></button>
          </div>
        </section>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">Appearance</h2>
          <div className="grid grid-cols-3 gap-2">{([{value:'light',label:'Light',Icon:Sun},{value:'dark',label:'Dark',Icon:Moon},{value:'system',label:'System',Icon:Monitor}] as const).map(({value,label,Icon}) => <button key={value} onClick={() => applyTheme(value)} className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all ${theme === value ? 'border-foreground/30 bg-secondary' : 'border-border hover:border-foreground/15'}`}><Icon className={`w-4 h-4 ${theme===value?'text-foreground':'text-muted-foreground'}`} /><span className="text-[11px] font-medium text-foreground">{label}</span></button>)}</div>
        </section>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">Approval Mode</h2>
          <label className="flex items-center justify-between py-2"><span className="text-[12px] text-foreground">Writes require approval</span><input type="checkbox" checked={!!settings?.approval_mode?.writes_require_approval} onChange={(e) => patchSettings({ approval_mode: { writes_require_approval: e.target.checked } })} /></label>
          <label className="flex items-center justify-between py-2"><span className="text-[12px] text-foreground">Commands require approval</span><input type="checkbox" checked={!!settings?.approval_mode?.commands_require_approval} onChange={(e) => patchSettings({ approval_mode: { commands_require_approval: e.target.checked } })} /></label>
        </section>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">Active Model</h2>
          <select value={settings?.models?.active_model ?? ''} onChange={(e)=> api.models.activate(e.target.value).then((d)=> setSettings(d.settings)).catch(()=>null)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30">{models.map((m)=><option key={m} value={m}>{m}</option>)}</select>
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1"><Info className="w-3 h-3" />Backend-driven model setting</p>
        </section>
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-3">System</h2>
          <div className="text-[12px] text-muted-foreground space-y-1"><div>App: <strong className="text-foreground">{meta?.appName ?? 'CubOS'}</strong></div><div>Version: <strong className="text-foreground">{meta?.version ?? 'dev'}</strong></div><div>Platform: <strong className="text-foreground">{meta?.platform ?? 'unknown'}</strong></div></div>
        </section>
      </div>
    </div>
  );
}