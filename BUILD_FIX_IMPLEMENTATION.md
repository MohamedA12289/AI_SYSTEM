# CubOS Build-Fix Implementation Plan

> Step-by-step plan of EVERY change to ship a green build, derived from the empirical test results in `FIX_PLAN.md` (run 3, 198/216 PASS).
> Companion to: `FIX_PLAN.md` (RCA), `TESTS_LOG.md` (every test run), `TEST_REPORT.md` (latest harness output), `IMPLEMENTATION_PLAN.md` (system-tools / install plan — separate scope).
> Date: 2026-05-11. Status: **awaiting greenlight** before D7 starts.

---

## 0. Pre-flight (already done)

- [x] Enumerated 185 backend routes via `/openapi.json` → `ROUTES.md`
- [x] Enumerated frontend API surface by regex-scanning `.ts/.tsx/.js/.jsx` for `fetch(`, `apiClient.`, `apiUrl(`, `axios.` → `ROUTES.md` (frontend section)
- [x] Built exhaustive harness `tools/run_full_test.py` (216 checks: core + frontend_sweep + openapi_sweep + voice + websocket)
- [x] Ran harness three times. Final clean run: **198 PASS / 18 FAIL / 1 required-fail**
- [x] Root-caused every failure → 7 distinct bugs (F1-F7) documented in `FIX_PLAN.md`

---

## 1. Consolidated 4-batch plan

Smaller batches were merged into 4 mega-batches so we don't bounce between commits. Each ends with harness re-run + doc updates.

| Mega-batch | Scope | Effort | Fixes | Harness target |
|---|---|---|---|---|
| **M1 — All backend bug fixes** | F1+F2+F3+F4+F5+F6+F7 (every backend root cause in one PR) | 3-4 h | 18 endpoints | 216/216 PASS, 0 required-fail |
| **M2 — Frontend E2E harness** | Playwright/CDP scaffold + 15 flow specs (T-2) | 3-4 h | enables UI verification | 15 specs runnable |
| **M3 — All UI fixes** | D-UI-1..9 in one sweep, validated by M2 | ~10 h | D1-1/3/4/5/7/8/9, D2-1/2/3, D3-1, D4-1/2/3/4, D5-1, D6-1/2/3 | all UI flows green |
| **M4 — Release gate + cut installer** | T-3 release_check.ps1 + final harness + electron-build | 1 h | gates installer | green build artifact |

---

## 2. M1 — All backend bug fixes (one PR)

Touches 6 files. ~190 LOC. Order inside the PR is "smallest blast-radius first" so each block can be smoke-tested individually before the next.

### M1.1 — `app/backend/thread_routes.py` (F2)
Add `except HTTPException: raise` immediately before each generic `except Exception:` block in the 7 thread handlers:
- `api_get_thread` (L85), `api_update_thread_title` (L102), `api_delete_thread` (L124), `api_get_thread_messages` (L146), `api_send_thread_message` (L166), `api_get_thread_messages_count`, `api_stream_thread`.

```py
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
+   except HTTPException:
+       raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### M1.2 — `app/backend/api/github_auth.py` (F1)
- `/initiate` (L26-29): 500 → 503 with `{configured: False}` body.
- `/callback` (L44-45): same when secrets missing.
- New `GET /api/github/auth/config` → `{configured, client_id_present, client_secret_present}`.

### M1.3 — `app/backend/project_registry.py` + `ollama_client.py` (helpers for F3)
- New helper `assert_project_exists(project_name) → raises HTTPException(404)`.
- `ask_ollama(prompt, timeout=15.0)` — convert `httpx.ReadTimeout` to `HTTPException(504, "AI backend timed out")`.

### M1.4 — 8 project AI routes (F3)
Files: `wave2_routes.py` (workspace/analyze, pair/review, pair/plan, cowork/instruction), `advanced_routes.py` (coagent/api-contracts, coagent/project-state, coagent/workspace-map), `main.py:781` (chat/summary/refresh).

For each route:
```py
-@router.post("/project/{project_name}/workspace/analyze")
-def analyze_workspace(project_name: str, request: WorkspaceAnalyzeRequest):
-    ensure_project_memory(project_name)
+@router.post("/project/{project_name}/workspace/analyze")
+async def analyze_workspace(project_name: str, request: WorkspaceAnalyzeRequest):
+    assert_project_exists(project_name)
+    ensure_project_memory(project_name)
     ...
-    analysis = ask_ollama(prompt)
+    analysis = await asyncio.to_thread(ask_ollama, prompt)
     return {...}
```

### M1.5 — `app/backend/main.py` + `terminal_pty.py` (F5 — REQUIRED-FAIL)
- `terminal_pty.handle_terminal_session`: send `{"type":"ready","project_name":...}` immediately after `accept()`.
- Wrap winpty import/spawn errors with explicit logging + send `{"type":"info","data":"using subprocess fallback"}` before fallback.
- Add new lightweight `@app.websocket("/ws/terminal/health")` echo route in `main.py`.

### M1.6 — `app/backend/main.py` + `voice_tools.py` (F4 + F6 + F7)
- `voice_tools.transcribe_bytes` — keyword-only `filename` param, infer suffix, shell out to bundled `ffmpeg.exe` for webm/ogg/mp3/m4a → wav.
- `main.py::transcribe_endpoint` → wrap in `await asyncio.to_thread(transcribe_bytes, ...)`.
- `main.py::voice_websocket` → send `{"type":"ready","stt_available":...}` after `accept()`.
- `voice_tools.list_available_voices` — 24h disk cache at `%LOCALAPPDATA%\CubOS\models\piper\voices_index.json`, `?refresh=true` busts.
- `main.py::list_available_voices_endpoint` → async + accept `?refresh=true`.
- Backend startup: set `HF_HOME=%LOCALAPPDATA%\CubOS\models\whisper` before whisper import.
- PyInstaller spec: bundle `ffmpeg.exe`; add `tools/fetch_ffmpeg.ps1` helper.

### M1 verification (run 4)
`python tools/run_full_test.py` — expect:
- 5 thread routes → 400 (was 500)
- github/initiate → 503 (was 500); new /config → 200
- 8 project AI routes → 404 on stub (was 6s timeout)
- voice/transcribe → 200 with `text` key
- voice/available → ≤2s on warm cache
- ws/voice → ready frame ≤2s
- ws/terminal → ready frame ≤2s + echo round-trip (REQUIRED-FAIL clears)

**Target:** 216/216 PASS, 0 required-fail. Update `FIX_PLAN.md` F1-F7 → `[x]`. Update `TESTS_LOG.md` with Run 4 section.

---

## 3. M2 — Frontend E2E harness (T-2)

New files under `app/frontend/tests/e2e/`:
- `playwright.config.ts` — single project, headed mode on CI dry-run, screenshots on failure.
- `fixtures/launch-exe.ts` — spawns `dist\win-unpacked\CubOS.exe` with `--remote-debugging-port=9222`, returns a `Browser` via CDP attach.
- `fixtures/mock-server.ts` — local HTTP server intercepting GitHub OAuth, Ollama, git clone for deterministic tests.
- 11 `flows/*.spec.ts` (boot, create-project, terminal, run-script, provider-switch, voice-record, resizable-panels, github-oauth, clone-repo, settings-keys, self-upgrade).

Each spec: launches exe → drives UI via CDP → emits per-flow pass/fail with screenshot. Configurable via `PLAYWRIGHT_HEADED=1`.

**M2 verification:** `npx playwright test` produces report; 0 specs failing on dev machine (all PASS or SKIP — UI bugs will fail in M3 first).

---

## 4. M3 — All UI fixes (one big sweep validated by M2)

Group all UI work into a single PR-sized branch. Sub-tasks tracked internally but ship together so we only re-run T-2 once at the end.

### M3 sub-tasks

| Sub | Item | Files |
|---|---|---|
| 3.1 subprocess hygiene | D1-1 | `git_tools.py`, `terminal_pty.py`, `ollama_client.py`, `mcp_client.py`, `browser_tools.py`, `voice_tools.py`, `electron/main.cjs` — add `creationflags=subprocess.CREATE_NO_WINDOW` / `windowsHide:true` everywhere |
| 3.2 run/debug pipe | D1-3, D1-8 | `RunDebugPanel.tsx`, `OutputPanel.tsx` — route Run through `/ws/terminal/{p}`, subscribe Output to same stream |
| 3.3 settings keys + provider truth | D1-4, D1-5, D2-1/2/3 | `SettingsPage.tsx`, `AISettings.tsx`, `secrets_manager.py` — `/secrets/list` masked, provider list from `/settings/providers`, clear `ai_client` cache on `/settings/provider/model` POST |
| 3.4 self-upgrade scope | D1-7, D5-1 | `SelfUpgrade.tsx`, backend file walker — point at `process.resourcesPath/cubos_backend/`, filter out cache files |
| 3.5 voice UX | D1-6, D1-9 | `VoiceInput.tsx` — friendly "no active project" message; pipe webm through new `/voice/transcribe` (already fixed in M1) |
| 3.6 resizable panels | D3-1 | `CodeModePage.tsx` + `react-resizable-panels`; persist sizes per-project in localStorage |
| 3.7 projects/chat scope | D4-1, D4-2, D4-3, D4-4 | `project_registry.py` (append-only register), `HomePage.tsx` (list all), `ChatPanel.tsx` (key thread by project) |
| 3.8 GitHub OAuth full | D6-1, D6-2, D6-3 | `electron/main.cjs` (register `cubos://`, parse callback), `GitHubAuthDialog.tsx` (PAT editable always, use `/api/github/auth/config`), `git_tools.py` (set-remote UX) |

### M3 verification
Re-run M2's Playwright suite. All 15 flows must PASS. Then re-run M1 harness — must still be 216/216.

---

## 5. M4 — Release gate + cut installer

### M4.1 — `tools/release_check.ps1` (T-3)
```powershell
$ErrorActionPreference = "Stop"
python tools/run_full_test.py
if ($LASTEXITCODE -ne 0) { Write-Error "Backend harness failed"; exit 1 }
npx playwright test --config app/frontend/tests/e2e/playwright.config.ts
if ($LASTEXITCODE -ne 0) { Write-Error "E2E harness failed"; exit 1 }
npm --prefix app/frontend run test
if ($LASTEXITCODE -ne 0) { Write-Error "Unit tests failed"; exit 1 }
Write-Host "All gates passed."
```
Wire into `app/frontend/package.json` `prebuild` script.

### M4.2 — Cut installer
- Bump version.
- `npm run dist` (electron-builder).
- Smoke-test the produced `.exe` manually for 5 min (open, terminal echo, switch provider).
- Tag release.

---

## 6. Deliverables checklist

- [x] `ROUTES.md`, `FIX_PLAN.md`, `BUILD_FIX_IMPLEMENTATION.md`, `TESTS_LOG.md`, `TEST_REPORT.md`, `tools/run_full_test.py`
- [ ] **M1** — all 7 backend fixes, run 4 = 216/216
- [ ] **M2** — Playwright harness, 11 specs runnable
- [ ] **M3** — all UI fixes, 15 flows PASS
- [ ] **M4** — release_check.ps1, signed installer

---

## 7. Rules of engagement

1. No code change ships without a failing test that flips to passing.
2. Harness re-runs at the end of each mega-batch — not in the middle.
3. No silent regressions — any newly-failing endpoint blocks the next mega-batch until investigated.
4. No installer build until release gate passes (T-3).
