# GO 3 Specification - Advanced IDE Features

**Goal:** Implement remaining VS Code parity features for a complete IDE experience  
**Status:** Planning Phase  
**Date:** 2026-04-09

---

## GO 3 Feature Set

### 1. Settings/Preferences System ⭐ HIGH PRIORITY

**Service:** `SettingsManager`
- Centralized settings storage (localStorage + in-memory)
- Settings schema with types and validation
- Default values
- Get/set/reset functionality
- Settings change notifications (pub-sub)

**UI:** Settings Page (`/settings`)
- Search settings
- Categories: Editor, Workbench, Extensions, Terminal, Git
- Settings editor with input types (text, number, boolean, dropdown, color)
- Reset to defaults button
- Import/Export settings (JSON)

**Key Settings:**
- Editor: font size, font family, tab size, word wrap, minimap
- Workbench: theme, sidebar position, panel position, zoom level
- Terminal: font size, shell path, cursor style
- Git: auto-fetch, confirm push, default branch

---

### 2. Workspace Search (Search in Files) ⭐ HIGH PRIORITY

**Implementation:**
- Enhance existing Search sidebar with actual search functionality
- Search input with regex, case-sensitive, whole word options
- Replace functionality (replace in file, replace all)
- Results tree view showing matches by file
- Click match to open file at line
- Search history (recent searches)

**API Integration:**
- Use existing `api.files.search()` endpoint
- Display match context (line before/after)
- Highlight matches in editor

---

### 3. Enhanced Git Integration ⭐ HIGH PRIORITY

**Current State:** Basic "Source Control" sidebar placeholder

**Enhancements:**
- File change list (modified, added, deleted, untracked)
- Stage/unstage files
- Commit with message input
- Push/pull buttons with remote status
- Branch switcher (dropdown)
- Git status in sidebar (# changes)
- Diff view (side-by-side or inline)

**API Endpoints:**
- `GET /api/projects/{project}/git/status`
- `POST /api/projects/{project}/git/stage`
- `POST /api/projects/{project}/git/commit`
- `POST /api/projects/{project}/git/push`
- `POST /api/projects/{project}/git/pull`
- `GET /api/projects/{project}/git/branches`
- `POST /api/projects/{project}/git/checkout`

---

### 4. Problems Panel ⭐ MEDIUM PRIORITY

**Implementation:**
- Bottom panel tab alongside Terminal
- Display errors, warnings, info from various sources:
  - TypeScript/ESLint errors
  - Build errors
  - Linting warnings
- Grouping by file
- Click problem to jump to location
- Filter by severity (error/warning/info)
- Clear all button

**Integration:**
- Parse compiler output
- Parse linter output
- Display in real-time during builds

---

### 5. Output Panel ⭐ MEDIUM PRIORITY

**Implementation:**
- Bottom panel tab alongside Terminal and Problems
- Channel switcher (dropdown: Tasks, Git, Extensions, Debug)
- Read-only text output
- Auto-scroll to bottom
- Clear output button
- Copy output button

**Use Cases:**
- Build task output
- Git command output
- Extension logs
- Debug console

---

### 6. Theme Switcher ⭐ MEDIUM PRIORITY

**Implementation:**
- Settings page theme selector
- Built-in themes: Dark (default), Light, High Contrast
- Theme preview thumbnails
- Apply theme immediately (no reload)
- Custom theme support (JSON import)

**Themes:**
- Dark (current)
- Light (invert colors)
- High Contrast Dark
- High Contrast Light

**CSS Variables:**
- Use existing Tailwind theme system
- Override via `<html class="theme-light">` or `data-theme="light"`

---

### 7. Keybindings Editor ⭐ LOW PRIORITY

**Implementation:**
- Settings page tab for Keybindings
- Table view: Command | Keybinding | When | Source
- Search keybindings
- Edit keybinding (click to record new key combo)
- Conflict detection (show if keybinding already used)
- Reset to default
- Export/Import keybindings

**Service Integration:**
- Use existing KeybindingRegistry
- Add `updateKeybinding(commandId, newKeys)` method
- Persist custom keybindings to localStorage

---

### 8. Extensions Panel UI ⭐ LOW PRIORITY

**Implementation:**
- Sidebar panel (already has Extensions icon)
- Search extensions (mock data for now)
- Installed extensions list
- Extension details view
- Enable/disable extensions
- Placeholder for future extension marketplace

**Mock Data:**
- Show 5-10 sample "installed" extensions
- Extension info: name, author, version, description
- No actual extension loading (future feature)

---

### 9. Debug Panel UI ⭐ LOW PRIORITY

**Implementation:**
- Sidebar panel (already has Debug icon)
- Run configurations dropdown
- Start/stop debug button
- Variables view (mock)
- Call stack view (mock)
- Breakpoints list (mock)
- Debug console (redirect to Output panel)

**Note:** Full debug integration requires backend support, this is UI-only

---

### 10. Zoom Functionality ⭐ LOW PRIORITY

**Implementation:**
- Menu: View → Zoom In (Ctrl+=)
- Menu: View → Zoom Out (Ctrl+-)
- Menu: View → Reset Zoom (Ctrl+0)
- Commands in Command Palette
- Zoom levels: 50%, 75%, 90%, 100%, 110%, 125%, 150%, 175%, 200%
- Apply zoom to entire UI via CSS transform or font-size scaling
- Persist zoom level in settings

---

## Implementation Priority

### Phase 1 (Core IDE Features) - Implement First
1. ✅ Settings/Preferences System (Service + UI)
2. ✅ Workspace Search (functional search in files)
3. ✅ Enhanced Git Integration (basic workflow)

### Phase 2 (Developer Productivity) - Implement Second
4. ✅ Problems Panel (errors/warnings display)
5. ✅ Output Panel (build output display)
6. ✅ Theme Switcher (light/dark themes)

### Phase 3 (Nice-to-Have) - Implement if Time Permits
7. ⏸️ Keybindings Editor (advanced customization)
8. ⏸️ Extensions Panel UI (placeholder for future)
9. ⏸️ Debug Panel UI (placeholder for future)
10. ⏸️ Zoom Functionality (accessibility feature)

---

## File Structure

```
app/frontend/src/
├── services/
│   ├── SettingsManager.ts          (NEW)
│   ├── WorkspaceSearch.ts          (NEW)
│   └── GitService.ts               (NEW)
├── components/
│   ├── Settings/
│   │   ├── SettingsPage.tsx        (NEW)
│   │   ├── SettingsSearch.tsx      (NEW)
│   │   ├── SettingItem.tsx         (NEW)
│   │   └── ThemeSelector.tsx       (NEW)
│   ├── Search/
│   │   ├── WorkspaceSearch.tsx     (ENHANCE existing Search in sidebar)
│   │   ├── SearchResult.tsx        (NEW)
│   │   └── SearchOptions.tsx       (NEW)
│   ├── Git/
│   │   ├── GitPanel.tsx            (NEW - replaces placeholder in sidebar)
│   │   ├── GitFileList.tsx         (NEW)
│   │   ├── GitCommit.tsx           (NEW)
│   │   └── GitBranchSwitcher.tsx   (NEW)
│   ├── Panels/
│   │   ├── ProblemsPanel.tsx       (NEW)
│   │   ├── OutputPanel.tsx         (NEW)
│   │   └── PanelTabs.tsx           (ENHANCE existing terminal tabs)
│   ├── Extensions/
│   │   ├── ExtensionsPanel.tsx     (NEW)
│   │   └── ExtensionItem.tsx       (NEW)
│   └── Debug/
│       ├── DebugPanel.tsx          (NEW)
│       ├── VariablesView.tsx       (NEW)
│       └── CallStackView.tsx       (NEW)
├── pages/
│   └── SettingsPage.tsx            (NEW)
└── routes.tsx                      (UPDATE - add /settings route)
```

---

## Implementation Steps

### Step 1: Settings System
1. Create `SettingsManager.ts` service
2. Define settings schema
3. Create `SettingsPage.tsx` with categories
4. Create setting input components
5. Wire up settings to existing features
6. Add Settings route to router
7. Add "Settings" menu item

### Step 2: Workspace Search
1. Enhance existing Search sidebar
2. Add search options (regex, case, whole word)
3. Create search results tree view
4. Implement click-to-open-file
5. Add replace functionality
6. Store search history

### Step 3: Git Integration
1. Create `GitService.ts` for API calls
2. Create `GitPanel.tsx` to replace sidebar placeholder
3. Implement file change list
4. Add stage/unstage functionality
5. Add commit UI with message input
6. Add push/pull buttons
7. Add branch switcher

### Step 4: Problems Panel
1. Create `ProblemsPanel.tsx`
2. Add to bottom panel tabs (alongside Terminal)
3. Fetch and display problems from API
4. Group problems by file
5. Implement click-to-jump functionality
6. Add severity filters

### Step 5: Output Panel
1. Create `OutputPanel.tsx`
2. Add to bottom panel tabs
3. Add channel switcher
4. Implement output streaming
5. Add clear/copy buttons

### Step 6: Theme Switcher
1. Create theme definitions (light/dark/high-contrast)
2. Add theme selector to Settings page
3. Implement theme switching logic
4. Update CSS variables on theme change
5. Persist theme preference

---

## Success Criteria

GO 3 is complete when:
- ✅ Settings page is functional with all categories
- ✅ Workspace search works and displays results
- ✅ Git panel shows file changes and allows commit
- ✅ Problems panel displays errors/warnings
- ✅ Output panel shows build output
- ✅ Theme switcher works (light/dark at minimum)
- ✅ All features integrated into CodeModePage
- ✅ No regressions in GO 1 or GO 2 features
- ✅ Clean build with no TypeScript errors
- ✅ Manual testing checklist completed

---

## Estimated Complexity

**Total Features:** 10  
**High Priority:** 3 (Settings, Search, Git)  
**Medium Priority:** 3 (Problems, Output, Theme)  
**Low Priority:** 4 (Keybindings, Extensions, Debug, Zoom)

**Recommended for GO 3:** Implement Priority 1 + Priority 2 = 6 features  
**Save for GO 4:** Priority 3 features (4 features)

---

## Notes

- Focus on core functionality over polish
- Mock data acceptable for Extensions and Debug panels
- Full Git integration requires backend API support
- Theme switching should use existing Tailwind configuration
- Settings should integrate with existing services (CommandRegistry, KeybindingRegistry, LayoutStateManager)
