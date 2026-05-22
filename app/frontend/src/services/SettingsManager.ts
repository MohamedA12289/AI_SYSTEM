export type SettingType = 'string' | 'number' | 'boolean' | 'select' | 'color' | 'secret';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  category: string;
  default: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  envName?: string;
}

export interface Settings {
  'editor.fontSize': number;
  'editor.fontFamily': string;
  'editor.tabSize': number;
  'editor.wordWrap': 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  'editor.minimap': boolean;
  'editor.lineNumbers': boolean;
  'workbench.colorTheme': string;
  'workbench.sidebarPosition': 'left' | 'right';
  'workbench.panelPosition': 'bottom' | 'right';
  'workbench.zoomLevel': number;
  'terminal.fontSize': number;
  'terminal.fontFamily': string;
  'terminal.cursorStyle': 'block' | 'line' | 'underline';
  'git.autoFetch': boolean;
  'git.confirmPush': boolean;
  'git.defaultBranch': string;
  'git.githubToken': string;
  'git.githubUsername': string;
  'search.caseSensitive': boolean;
  'search.wholeWord': boolean;
  'search.useRegex': boolean;
  'ai.provider': string;
  'ai.model': string;
  'ai.apiKey': string;
  'ai.openaiApiKey': string;
  'ai.groqApiKey': string;
  'ai.abacusaiApiKey': string;
  'ai.anthropicApiKey': string;
  'ai.googleApiKey': string;
  'ai.openrouterApiKey': string;
  'ai.ollamaBaseUrl': string;
  'ai.temperature': number;
}

class SettingsManagerImpl {
  private settings: Partial<Settings> = {};
  private listeners: Set<(settings: Partial<Settings>) => void> = new Set();
  private readonly STORAGE_KEY = 'cubos_settings';

  private readonly definitions: SettingDefinition[] = [
    {
      key: 'editor.fontSize',
      label: 'Font Size',
      description: 'Controls the font size in pixels in the editor',
      type: 'number',
      category: 'Editor',
      default: 14,
      min: 8,
      max: 32
    },
    {
      key: 'editor.fontFamily',
      label: 'Font Family',
      description: 'Controls the font family in the editor',
      type: 'string',
      category: 'Editor',
      default: 'Consolas, "Courier New", monospace'
    },
    {
      key: 'editor.tabSize',
      label: 'Tab Size',
      description: 'The number of spaces a tab is equal to',
      type: 'number',
      category: 'Editor',
      default: 2,
      min: 1,
      max: 8
    },
    {
      key: 'editor.wordWrap',
      label: 'Word Wrap',
      description: 'Controls how lines should wrap',
      type: 'select',
      category: 'Editor',
      default: 'off',
      options: [
        { label: 'Off', value: 'off' },
        { label: 'On', value: 'on' },
        { label: 'Word Wrap Column', value: 'wordWrapColumn' },
        { label: 'Bounded', value: 'bounded' }
      ]
    },
    {
      key: 'editor.minimap',
      label: 'Minimap Enabled',
      description: 'Controls whether the minimap is shown',
      type: 'boolean',
      category: 'Editor',
      default: true
    },
    {
      key: 'editor.lineNumbers',
      label: 'Line Numbers',
      description: 'Controls the display of line numbers',
      type: 'boolean',
      category: 'Editor',
      default: true
    },
    {
      key: 'workbench.colorTheme',
      label: 'Color Theme',
      description: 'Specifies the color theme used in the workbench',
      type: 'select',
      category: 'Workbench',
      default: 'dark',
      options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
        { label: 'High Contrast', value: 'high-contrast' }
      ]
    },
    {
      key: 'workbench.sidebarPosition',
      label: 'Sidebar Position',
      description: 'Controls the position of the sidebar',
      type: 'select',
      category: 'Workbench',
      default: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' }
      ]
    },
    {
      key: 'workbench.panelPosition',
      label: 'Panel Position',
      description: 'Controls the position of the panel (terminal, problems, output)',
      type: 'select',
      category: 'Workbench',
      default: 'bottom',
      options: [
        { label: 'Bottom', value: 'bottom' },
        { label: 'Right', value: 'right' }
      ]
    },
    {
      key: 'workbench.zoomLevel',
      label: 'Zoom Level',
      description: 'Adjust the zoom level of the workbench. Original size is 0 and each increment above (e.g. 1) or below (e.g. -1) represents zooming 20% larger or smaller.',
      type: 'number',
      category: 'Workbench',
      default: 0,
      min: -5,
      max: 5
    },
    {
      key: 'terminal.fontSize',
      label: 'Font Size',
      description: 'Controls the font size in pixels in the terminal',
      type: 'number',
      category: 'Terminal',
      default: 13,
      min: 8,
      max: 32
    },
    {
      key: 'terminal.fontFamily',
      label: 'Font Family',
      description: 'Controls the font family in the terminal',
      type: 'string',
      category: 'Terminal',
      default: 'Consolas, "Courier New", monospace'
    },
    {
      key: 'terminal.cursorStyle',
      label: 'Cursor Style',
      description: 'Controls the style of the terminal cursor',
      type: 'select',
      category: 'Terminal',
      default: 'block',
      options: [
        { label: 'Block', value: 'block' },
        { label: 'Line', value: 'line' },
        { label: 'Underline', value: 'underline' }
      ]
    },
    {
      key: 'git.autoFetch',
      label: 'Auto Fetch',
      description: 'When enabled, will automatically fetch from the remote repository',
      type: 'boolean',
      category: 'Git',
      default: false
    },
    {
      key: 'git.confirmPush',
      label: 'Confirm Push',
      description: 'Confirm before pushing',
      type: 'boolean',
      category: 'Git',
      default: true
    },
    {
      key: 'git.defaultBranch',
      label: 'Default Branch',
      description: 'The default branch name to use when initializing a new Git repository',
      type: 'string',
      category: 'Git',
      default: 'main'
    },
    {
      key: 'git.githubToken',
      label: 'GitHub Token',
      description: 'Personal access token for GitHub authentication',
      type: 'string',
      category: 'Git',
      default: ''
    },
    {
      key: 'git.githubUsername',
      label: 'GitHub Username',
      description: 'Your GitHub username',
      type: 'string',
      category: 'Git',
      default: ''
    },
    {
      key: 'search.caseSensitive',
      label: 'Case Sensitive',
      description: 'Search is case sensitive by default',
      type: 'boolean',
      category: 'Search',
      default: false
    },
    {
      key: 'search.wholeWord',
      label: 'Whole Word',
      description: 'Match whole words only',
      type: 'boolean',
      category: 'Search',
      default: false
    },
    {
      key: 'search.useRegex',
      label: 'Use Regular Expression',
      description: 'Enable regular expression in search patterns',
      type: 'boolean',
      category: 'Search',
      default: false
    },
    {
      key: 'ai.provider',
      label: 'AI Provider',
      description: 'The AI service provider to use',
      type: 'select',
      category: 'AI',
      default: 'ollama',
      options: [
        { label: 'Ollama (Local)', value: 'ollama' },
        { label: 'Groq', value: 'groq' },
        { label: 'OpenAI', value: 'openai' },
        { label: 'Anthropic (Claude)', value: 'anthropic' },
        { label: 'OpenRouter', value: 'openrouter' }
      ]
    },
    {
      key: 'ai.model',
      label: 'AI Model',
      description: 'The specific AI model to use for completions',
      type: 'string',
      category: 'AI',
      default: 'gpt-4'
    },
    {
      key: 'ai.temperature',
      label: 'Temperature',
      description: 'Controls randomness in AI responses (0 = deterministic, 1 = random)',
      type: 'number',
      category: 'AI',
      default: 0.7,
      min: 0,
      max: 1
    },
    {
      key: 'ai.ollamaBaseUrl',
      label: 'Ollama Base URL',
      description: 'Base URL of your local Ollama server',
      type: 'string',
      category: 'AI',
      default: 'http://127.0.0.1:11434'
    },
    {
      key: 'ai.openaiApiKey',
      label: 'OpenAI API Key',
      description: 'API key for OpenAI (sk-...)',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'OPENAI_API_KEY'
    },
    {
      key: 'ai.groqApiKey',
      label: 'Groq API Key',
      description: 'API key for Groq (gsk_...)',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'GROQ_API_KEY'
    },
    {
      key: 'ai.abacusaiApiKey',
      label: 'Abacus AI API Key',
      description: 'API key for Abacus AI',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'ABACUSAI_API_KEY'
    },
    {
      key: 'ai.anthropicApiKey',
      label: 'Anthropic API Key',
      description: 'API key for Anthropic Claude (sk-ant-...)',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'ANTHROPIC_API_KEY'
    },
    {
      key: 'ai.googleApiKey',
      label: 'Google AI API Key',
      description: 'API key for Google Gemini',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'GOOGLE_API_KEY'
    },
    {
      key: 'ai.openrouterApiKey',
      label: 'OpenRouter API Key',
      description: 'API key for OpenRouter',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'OPENROUTER_API_KEY'
    },
    {
      key: 'ai.apiKey',
      label: 'Generic API Key (legacy)',
      description: 'Fallback API key for the selected provider',
      type: 'secret',
      category: 'API Keys',
      default: '',
      envName: 'API_KEY'
    }
  ];

  constructor() {
    this.loadSettings();
    this.loadSecretsFromBackend();
    this.syncProviderDefinitions().catch(() => null);
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.settings = JSON.parse(stored);
      } else {
        this.settings = this.getDefaults();
      }
      for (const def of this.definitions) {
        if (def.type === 'secret') {
          delete (this.settings as any)[def.key];
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaults();
    }
  }

  private async loadSecretsFromBackend(): Promise<void> {
    try {
      const { api } = await import('@/services/api');
      const items = await api.secrets.list(true);
      const byEnv = new Map(items.map((it: any) => [it.key, it.value]));
      for (const def of this.definitions) {
        if (def.type === 'secret' && def.envName && byEnv.has(def.envName)) {
          (this.settings as any)[def.key] = byEnv.get(def.envName);
        }
      }
      this.notifyListeners();
    } catch (error) {
      console.warn('Failed to load secrets from backend:', error);
    }
  }

  private saveSettings(): void {
    try {
      const filtered: any = {};
      const secretKeys = new Set(this.definitions.filter(d => d.type === 'secret').map(d => d.key));
      for (const k of Object.keys(this.settings)) {
        if (!secretKeys.has(k)) {
          filtered[k] = (this.settings as any)[k];
        }
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private getDefaults(): Partial<Settings> {
    const defaults: any = {};
    this.definitions.forEach(def => {
      defaults[def.key] = def.default;
    });
    return defaults;
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return (this.settings[key] ?? this.getDefault(key)) as Settings[K];
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    const def = this.definitions.find(d => d.key === key);
    if (def?.type === 'secret') {
      (this.settings as any)[key] = value;
      this.notifyListeners();
      return;
    }
    this.settings[key] = value;
    this.saveSettings();
    this.notifyListeners();
    this.syncBackendSetting(String(key), value).catch((error) => {
      console.warn(`Failed to sync setting ${String(key)} to backend:`, error);
    });
  }

  async syncProviderDefinitions(): Promise<void> {
    const { api } = await import('@/services/api');
    const catalog = await api.provider.list();
    const providers = catalog.providers ?? [];
    const labels: Record<string, string> = {
      ollama: 'Ollama (Local)',
      groq: 'Groq',
      openai: 'OpenAI',
      anthropic: 'Anthropic (Claude)',
      openrouter: 'OpenRouter',
    };
    const providerDef = this.definitions.find(d => d.key === 'ai.provider');
    if (providerDef) {
      providerDef.options = providers.map((provider) => ({ label: labels[provider] ?? provider, value: provider }));
      if (!providers.includes(String(this.settings['ai.provider'] || providerDef.default) as any)) {
        this.settings['ai.provider'] = providers[0] || 'ollama';
        this.saveSettings();
      }
    }
    this.notifyListeners();
  }

  private async syncBackendSetting(key: string, value: any): Promise<void> {
    if (key !== 'ai.provider' && key !== 'ai.model') return;
    const { api } = await import('@/services/api');
    if (key === 'ai.provider') {
      await api.provider.set(String(value));
      return;
    }
    const provider = String(this.settings['ai.provider'] || 'ollama');
    if (provider === 'ollama') {
      await api.models.activate(String(value));
    } else {
      await api.provider.setModel(provider as any, String(value));
    }
  }

  async saveSecret(key: string, value: string): Promise<void> {
    const def = this.definitions.find(d => d.key === key);
    if (!def || def.type !== 'secret' || !def.envName) {
      throw new Error('Not a secret setting');
    }
    const { api } = await import('@/services/api');
    if (!value) {
      try { await api.secrets.delete(def.envName); } catch {}
      (this.settings as any)[key] = '';
    } else {
      await api.secrets.set(def.envName, value);
      (this.settings as any)[key] = '*'.repeat(Math.max(8, Math.min(value.length, 16)));
    }
    this.notifyListeners();
  }

  async revealSecret(key: string): Promise<string> {
    const def = this.definitions.find(d => d.key === key);
    if (!def || def.type !== 'secret' || !def.envName) {
      throw new Error('Not a secret setting');
    }
    const { api } = await import('@/services/api');
    const result = await api.secrets.reveal(def.envName);
    return result?.value || '';
  }

  getAll(): Partial<Settings> {
    return { ...this.settings };
  }

  getDefault<K extends keyof Settings>(key: K): Settings[K] {
    const def = this.definitions.find(d => d.key === key);
    return def?.default as Settings[K];
  }

  reset<K extends keyof Settings>(key: K): void {
    this.settings[key] = this.getDefault(key);
    this.saveSettings();
    this.notifyListeners();
  }

  resetAll(): void {
    this.settings = this.getDefaults();
    this.saveSettings();
    this.notifyListeners();
  }

  getDefinitions(): SettingDefinition[] {
    return [...this.definitions];
  }

  getDefinitionsByCategory(category: string): SettingDefinition[] {
    return this.definitions.filter(d => d.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.definitions.map(d => d.category));
    return Array.from(categories);
  }

  onChange(callback: (settings: Partial<Settings>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getAll()));
  }

  exportSettings(): string {
    const filtered: any = {};
    const secretKeys = new Set(this.definitions.filter(d => d.type === 'secret').map(d => d.key));
    for (const k of Object.keys(this.settings)) {
      if (!secretKeys.has(k)) {
        filtered[k] = (this.settings as any)[k];
      }
    }
    return JSON.stringify(filtered, null, 2);
  }

  importSettings(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      const secretKeys = new Set(this.definitions.filter(d => d.type === 'secret').map(d => d.key));
      for (const k of secretKeys) delete imported[k];
      this.settings = { ...this.settings, ...imported };
      this.saveSettings();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
}

export const SettingsManager = new SettingsManagerImpl();
