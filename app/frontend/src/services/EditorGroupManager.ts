export interface EditorTab {
  path: string;
  name: string;
  isDirty: boolean;
  isPinned: boolean;
  isPreview: boolean;
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeTabPath: string | null;
}

class EditorGroupManagerImpl {
  private groups: EditorGroup[] = [];
  private activeGroupId: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    const defaultGroup: EditorGroup = {
      id: 'group-1',
      tabs: [],
      activeTabPath: null
    };
    this.groups = [defaultGroup];
    this.activeGroupId = 'group-1';
  }

  getGroups(): EditorGroup[] {
    return [...this.groups];
  }

  getActiveGroup(): EditorGroup | null {
    if (!this.activeGroupId) return null;
    return this.groups.find(g => g.id === this.activeGroupId) || null;
  }

  getActiveGroupId(): string | null {
    return this.activeGroupId;
  }

  setActiveGroup(groupId: string): void {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      this.activeGroupId = groupId;
      this.notifyListeners();
    }
  }

  splitEditor(direction: 'horizontal' | 'vertical' = 'horizontal'): string {
    const activeGroup = this.getActiveGroup();
    const newGroupId = `group-${Date.now()}`;
    
    const newGroup: EditorGroup = {
      id: newGroupId,
      tabs: activeGroup?.tabs ? [...activeGroup.tabs] : [],
      activeTabPath: activeGroup?.activeTabPath || null
    };

    this.groups.push(newGroup);
    this.activeGroupId = newGroupId;
    this.notifyListeners();
    
    return newGroupId;
  }

  closeGroup(groupId: string): void {
    if (this.groups.length === 1) return;
    
    this.groups = this.groups.filter(g => g.id !== groupId);
    
    if (this.activeGroupId === groupId) {
      this.activeGroupId = this.groups[0]?.id || null;
    }
    
    this.notifyListeners();
  }

  openFile(path: string, name: string, groupId?: string, options?: { isPreview?: boolean }): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    if (options?.isPreview) {
      const existingPreview = group.tabs.find(t => t.isPreview && !t.isPinned);
      if (existingPreview) {
        const index = group.tabs.indexOf(existingPreview);
        group.tabs[index] = {
          path,
          name,
          isDirty: false,
          isPinned: false,
          isPreview: true
        };
        group.activeTabPath = path;
        this.notifyListeners();
        return;
      }
    }

    const existingTab = group.tabs.find(t => t.path === path);
    if (existingTab) {
      if (options?.isPreview !== true) {
        existingTab.isPreview = false;
      }
      group.activeTabPath = path;
      this.notifyListeners();
      return;
    }

    group.tabs.push({
      path,
      name,
      isDirty: false,
      isPinned: false,
      isPreview: options?.isPreview || false
    });
    group.activeTabPath = path;
    this.notifyListeners();
  }

  closeFile(path: string, groupId?: string): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    const tabIndex = group.tabs.findIndex(t => t.path === path);
    if (tabIndex === -1) return;

    group.tabs.splice(tabIndex, 1);

    if (group.activeTabPath === path) {
      group.activeTabPath = group.tabs[Math.min(tabIndex, group.tabs.length - 1)]?.path || null;
    }

    this.notifyListeners();
  }

  setActiveFile(path: string, groupId?: string): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    const tab = group.tabs.find(t => t.path === path);
    if (tab) {
      tab.isPreview = false;
      group.activeTabPath = path;
      this.notifyListeners();
    }
  }

  pinTab(path: string, groupId?: string): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    const tab = group.tabs.find(t => t.path === path);
    if (tab) {
      tab.isPinned = true;
      tab.isPreview = false;
      this.notifyListeners();
    }
  }

  unpinTab(path: string, groupId?: string): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    const tab = group.tabs.find(t => t.path === path);
    if (tab) {
      tab.isPinned = false;
      this.notifyListeners();
    }
  }

  setTabDirty(path: string, isDirty: boolean, groupId?: string): void {
    const targetGroupId = groupId || this.activeGroupId;
    if (!targetGroupId) return;

    const group = this.groups.find(g => g.id === targetGroupId);
    if (!group) return;

    const tab = group.tabs.find(t => t.path === path);
    if (tab) {
      tab.isDirty = isDirty;
      this.notifyListeners();
    }
  }

  reorderTabs(groupId: string, fromIndex: number, toIndex: number): void {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;

    const [movedTab] = group.tabs.splice(fromIndex, 1);
    group.tabs.splice(toIndex, 0, movedTab);
    this.notifyListeners();
  }

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }
}

export const EditorGroupManager = new EditorGroupManagerImpl();
