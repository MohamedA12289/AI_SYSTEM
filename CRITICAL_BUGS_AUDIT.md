# CRITICAL BUGS AUDIT - CubOS Packaged App
## Date: Current Session
## Scope: Manual Smoke Test - Packaged Application

---

## EXECUTIVE SUMMARY

During manual smoke testing of the packaged CubOS application, **7 CRITICAL BUGS** were discovered that make core functionality unusable. These bugs represent incomplete implementation of essential features, not edge cases.

**Severity: CRITICAL - Application is NOT production-ready**

---

## CRITICAL BUGS IDENTIFIED

### 🔴 BUG #1: MenuBar Incomplete and Non-Functional
**Severity:** CRITICAL  
**Component:** `app/frontend/src/components/MenuBar/MenuBar.tsx`

**Issue:**
- Menu bar only shows 4 static items: File, Edit, View, Help
- Missing required items: Go, Selection, Run, Terminal
- Menu items are non-interactive (cursor: 'default')
- No dropdown menus implemented
- Clicking menu items does nothing

**Expected:**
- Full menu with: File, Edit, View, Go, Selection, Run, Terminal
- Each menu item should have functional dropdown with actions
- Clicking menu items should open corresponding dropdowns

**Root Cause:**
MenuBar component is a stub implementation with placeholder spans instead of functional menu system.

---

### 🔴 BUG #2: File Loading Completely Broken
**Severity:** CRITICAL  
**Component:** `app/frontend/src/pages/CodeModePage.tsx:33-48`

**Issue:**
- Double-clicking files in Explorer shows "fail to load file"
- Files open as empty content
- No API call to backend to fetch file content

**Current Code:**
```typescript
const handleFileClick = (path: string) => {
  const newFile: OpenFile = {
    path,
    name: fileName,
    content: '',  // ❌ ALWAYS EMPTY
    isDirty: false
  };
  setOpenFiles([...openFiles, newFile]);
  setActiveFilePath(path);
};
```

**Expected:**
Should call `api.files.read(projectName, path)` to fetch actual file content from backend.

**Root Cause:**
`handleFileClick` creates files with hardcoded empty content instead of loading from API.

---

### 🔴 BUG #3: Terminal WebSocket Connection Fails
**Severity:** CRITICAL  
**Component:** `app/frontend/src/components/Terminal/TerminalPanel.tsx:55`

**Issue:**
- Terminal displays "WebSocket connection error, terminal disconnected"
- WebSocket connection fails on initialization

**Current Code:**
```typescript
const ws = new WebSocket(`ws://localhost:8000/ws/terminal/${projectName}`);
```

**Potential Causes:**
1. Project name format mismatch (e.g., "self_upgrade" vs "self-upgrade")
2. Backend WebSocket endpoint not responding
3. Project name encoding issues

**Expected:**
Terminal should connect successfully and be interactive.

---

### 🔴 BUG #4: No AI Chat Panel in Code Mode
**Severity:** CRITICAL  
**Component:** `app/frontend/src/pages/CodeModePage.tsx`

**Issue:**
- Code mode has NO AI assistant panel on right side
- Chat mode has working AI chat, but code mode is missing it entirely
- No way to interact with AI while viewing code

**Expected:**
Code mode should have a right side panel similar to chat mode, allowing users to:
- Ask questions about code
- Request changes
- Get assistance while coding

**Root Cause:**
CodeModePage doesn't include any chat/assistant panel component in its layout.

---

### 🔴 BUG #5: Self-Upgrade Appears as Project (404 Error)
**Severity:** HIGH  
**Component:** Backend project listing

**Issue:**
- "Self-Upgrade" appears in projects dropdown
- Clicking it navigates to `/project/self-upgrade/chat` → 404
- Self-upgrade should NOT be a project, it's a system section

**Expected:**
- Self-upgrade should only appear in dedicated section (sidebar)
- Should NOT be listed in projects dropdown
- Routes are `/self-upgrade/chat` and `/self-upgrade/code` (not `/project/...`)

**Root Cause:**
Backend is returning self-upgrade in projects list when it shouldn't.

---

### 🔴 BUG #6: Project Navigation from Sidebar Gives 404
**Severity:** HIGH  
**Component:** `app/frontend/src/components/AppSidebar.tsx:75`

**Issue:**
- Clicking project from homepage works fine
- Clicking project from left sidebar dropdown → 404 Not Found
- Inconsistent navigation behavior

**Current Code:**
```tsx
onClick={() => navigate(`/project/${p.id}/chat`)}
```

**Investigation Needed:**
- Verify `p.id` matches route parameter expectations
- Check if `p.id` vs `p.name` vs `p.project_name` inconsistency

---

### 🔴 BUG #7: Explorer Shows "No File Selected" with No Interaction
**Severity:** MEDIUM  
**Component:** `app/frontend/src/components/FileTree` (UX Issue)

**Issue:**
- Explorer shows "no file selected" message
- User expects to see file tree to click on
- Confusing UX - looks broken

**Expected:**
Explorer should show file tree by default, allowing users to browse and select files.

**Note:** This may be correct behavior if no files exist, but combined with other issues it appears broken.

---

## ADDITIONAL ISSUES TO INVESTIGATE

### Terminal Flashing
**Severity:** LOW  
**Description:** User reports terminal window flashing - needs investigation

---

## ROOT CAUSE ANALYSIS

### Why Did These Issues Occur?

**Incomplete Implementation:**
- MenuBar was left as placeholder/stub
- File loading logic was never completed
- Code mode AI panel was never added
- These are not bugs, they're incomplete features

**Lack of Integration Testing:**
- Manual testing would have immediately caught these issues
- No end-to-end tests for critical user flows
- Packaged app was not tested before release smoke test

**Development Process Issues:**
- Features marked as complete when they were stubs
- No verification of packaged app functionality
- Focus on packaging infrastructure vs feature completeness

---

## IMPACT ASSESSMENT

**User Impact:** SEVERE
- **File editing:** BROKEN - can't load file content
- **Menu navigation:** BROKEN - no functional menus
- **Terminal:** BROKEN - WebSocket connection fails
- **AI assistance in code mode:** MISSING - no chat panel
- **Project navigation:** PARTIALLY BROKEN - sidebar navigation fails

**Release Readiness:** ❌ NOT READY
This application cannot be released in its current state. Core functionality is non-functional.

---

## NEXT STEPS

1. ✅ Complete this audit
2. 🔄 Fix all critical bugs systematically:
   - Fix MenuBar (add full menus with dropdowns)
   - Fix file loading (implement API call)
   - Fix terminal WebSocket (debug connection)
   - Add AI chat panel to code mode
   - Remove self-upgrade from projects
   - Fix sidebar navigation
3. 🔄 Rebuild packaged application
4. 🔄 Re-run complete smoke test
5. 🔄 Document all fixes and provide final report

---

## PRIORITY ORDER

1. **P0 (Critical - Do First):**
   - File loading (BUG #2)
   - MenuBar (BUG #1)
   - Terminal WebSocket (BUG #3)

2. **P1 (High - Do Next):**
   - AI chat panel in code mode (BUG #4)
   - Self-upgrade in projects (BUG #5)
   - Sidebar navigation (BUG #6)

3. **P2 (Medium - Nice to Have):**
   - Explorer UX (BUG #7)
   - Terminal flashing

---

**Report Generated:** Session continuation after Go 4 verification
**Status:** AUDIT COMPLETE - PROCEEDING TO FIXES
