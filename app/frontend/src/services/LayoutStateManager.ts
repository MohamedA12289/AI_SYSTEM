export interface LayoutState {
  sidebarWidth: number;
  sidebarVisible: boolean;
  panelHeight: number;
  panelVisible: boolean;
  activeSidebar: string;
  chatPanelOpen: boolean;
  chatPanelWidth: number;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 224,
  sidebarVisible: true,
  panelHeight: 256,
  panelVisible: true,
  activeSidebar: 'explorer',
  chatPanelOpen: true,
  chatPanelWidth: 384,
};

const STORAGE_KEY = 'cubos_layout_state';

class LayoutStateManagerImpl {
  save(state: Partial<LayoutState>): void {
    try {
      const current = this.load();
      const updated = { ...current, ...state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save layout state:', error);
    }
  }

  load(): LayoutState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_LAYOUT, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load layout state:', error);
    }
    return { ...DEFAULT_LAYOUT };
  }

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset layout state:', error);
    }
  }
}

export const LayoutStateManager = new LayoutStateManagerImpl();
