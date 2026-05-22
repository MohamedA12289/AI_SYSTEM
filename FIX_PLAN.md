# CubOS Fix Plan

> Single source of truth for all known broken behavior and how each will be fixed.
> Updated after every empirical test run. Status flags:
> `[ ]` not started · `[~]` in progress · `[x]` fixed + verified by automated test · `[?]` claimed fixed, not yet re-tested · `[!]` confirmed still broken after fix attempt

## Methodology
1. Write every issue here BEFORE coding.
2. Build automated end-to-end test (`tools/run_full_test.py`) that hits real endpoints + UI flows.
3. Run test → mark each item with empirical status.
4. Fix in batches (D1…D8). After each batch: re-run full test, update statuses, NEVER claim fixed without re-test.
5. Refuse to ship installer until all P0/P1 items are `[x]`.

---

## Empirical test results (run 2 — exhaustive)

Harness: `tools/run_full_test.py` · Report: `TEST_REPORT.md` · Date: 2026-05-11

**Coverage:** 216 checks (185 backend routes via /openapi.json, 22 frontend-call paths, 1 voice multipart, 2 websockets, 6 core).
**Score:** 178 PASS · 38 FAIL · **23 required-fail**

### Group summary

| Group | Total | Pass | Fail | Required-fail |
|---|---|---|---|---|
| core | 6 | 6 | 0 | 0 |
| openapi_sweep | 185 | 172 | 13 | 0 |
| frontend_sweep | 22 | 0 | 22 | 22 |
| voice | 1 | 0 | 1 | 0 |
| websocket | 2 | 0 | 2 | 1 |

### REAL backend failures (from openapi_sweep)

5xx server errors — implementation bugs:
| Endpoint | Status | Fix item |
|---|---|---|
| `GET /api/github/auth/initiate` | 500 | D6-1 |
| `GET /api/threads/1` | 500 | D7-1 |
| `DELETE /api/threads/1` | 500 | D7-1 |
| `GET /api/threads/1/messages` | 500 | D7-1 |
| `GET /api/threads/1/messages/count` | 500 | D7-1 |

Backend timeouts (>6s, route hangs on stub project name) — likely doing real work without project-exists check:
| Endpoint | Latency | Fix item |
|---|---|---|
| `POST /project/{name}/chat/summary/refresh` | 6.0s timeout | D8-1 |
| `POST /project/{name}/coagent/api-contracts` | 6.0s timeout | D8-1 |
| `POST /project/{name}/coagent/project-state` | 6.0s timeout | D8-1 |
| `POST /project/{name}/coagent/workspace-map` | 6.0s timeout | D8-1 |
| `POST /project/{name}/cowork/instruction` | 6.0s timeout | D8-1 |
| `POST /project/{name}/pair/plan` | 6.0s timeout | D8-1 |
| `POST /project/{name}/pair/review` | 6.0s timeout | D8-1 |
| `POST /project/{name}/workspace/analyze` | 6.0s timeout | D8-1 |

Voice / WebSocket:
| Endpoint | Result | Fix item |
|---|---|---|
| `POST /voice/transcribe` (silent WAV) | 15s timeout | D1-6 |
| `WS /ws/terminal/{project}` | echo not returned (handshake timeout in run 2) | D1-2 |
| `WS /ws/voice` | handshake timeout 5s | D1-6 |

### Frontend-sweep false positives

All 22 `frontend_sweep` failures are **harness bugs, not backend bugs**. The same paths
return 200/400/422 in `openapi_sweep` moments earlier in the same run (e.g. `/projects` GET
returned 200 in openapi_sweep, "ReadTimeout" in frontend_sweep). Root cause: the per-call
isolated `httpx.AsyncClient` approach times out when the backend's event loop is busy with
prior whisper init. Mitigation: revert frontend sweep to shared client with strict
`asyncio.wait_for` cap, or run frontend sweep BEFORE openapi sweep so client is warm.
**No backend fix needed for these.** They WILL be re-verified after the harness fix.

### Run-1 items now confirmed against run-2

PASSING (verified working — both runs):
- Core: `GET /`, `/projects`, `/settings`, `/models`, `/settings/providers`, `/settings/provider`
- Themes/Slash/History/Voice-meta/Secrets/Roles: all PASS in both runs
- Projects CRUD: `POST /projects/create`, `GET /projects/{name}`, `PATCH`, `DELETE`, `archive`
- Settings: `GET/POST /settings`, `/settings/provider`, `/settings/provider/model`
- Git: `POST /api/git/clone` (422 on bad input), `commit` (400), `pull`, `push`, `stage`, `status`, `unstage` — all return correct status codes via openapi_sweep
- GitHub auth: `POST /api/github/auth/pat` (401), `POST /api/github/auth/repos/create` (422), `GET /api/github/auth/status` (422), `GET /api/github/auth/callback` (422) — proper validation responses
- Tasks: `GET/POST /api/tasks` (422), `PATCH/DELETE /api/tasks/{id}` (422)
- Files: extract-absolute, supported-file-types
- Project routes: scope, scaffold/app, snapshots, search, runs, tests, voice/chat, web/fetch, web/search — proper validation
- Wave2/3/4 routes: all return proper validation responses

FAILING (from run 1, status in run 2):
| Endpoint | Run 1 | Run 2 | Status |
|---|---|---|---|
| `POST /voice/transcribe` | 500 | 15s timeout | still broken (D1-6) |
| `WS /ws/terminal` | echo missing | handshake timeout | still broken (D1-2) |
| `WS /ws/voice` | handshake timeout | handshake timeout | still broken (D1-6) |
| `GET /self-upgrade/files` | 404 | 200 in run 2 | **FIXED** (was missing prefix in run 1) |
| `GET /auth/github/status` | 404 | path corrected to `/api/github/auth/status` → 422 | **N/A — wrong path in run 1** |
| `POST /project/clone` | 404 | path corrected to `/projects/clone-git` → 422 | **N/A — wrong path in run 1** |

Items NOT yet covered by the harness (require UI / packaged-exe tests — see T-2 Playwright):
- D1-1 CMD window flashes (visual; needs screen capture test)
- D1-3 Run/Debug Python exit code 2 (needs PTY interaction test)
- D1-4 API keys pre-fill in Settings panel (UI state test)
- D1-5 Active provider/model mismatch on reload (UI state test)
- D1-7 Self-upgrade panel content (UI test on top of D5-1)
- D1-8 Run-output panel ↔ PTY linkage (UI)
- D1-9 "Voice input requires active project" (UI)
- D2-1/D2-2/D2-3 AI tab UX (UI)
- D3-1 Resizable panels (UI)
- D4-3 Projects disappear on create (sequence test — partially testable via harness)
- D4-4 Chat opens wrong project's history (UI)
- D6-1/D6-2 GitHub OAuth flow + PAT field (UI + cubos:// protocol handler)

---

## P0 — Blockers

### D1-1 [ ] Terminal/CMD windows flash on launch
- **Symptom:** Black CMD windows pop up on app start; intermittent flashes when AI agent runs commands.
- **Cause:** Child `subprocess.Popen` calls (git, ollama, winpty, mcp, playwright, faster-whisper) inherit a console handle on Windows.
- **Fix:** Add `creationflags=subprocess.CREATE_NO_WINDOW` to every `Popen` in: `git_tools.py`, `terminal_pty.py`, `ollama_client.py`, `mcp_client.py`, `browser_tools.py`, `voice_tools.py`. In `electron/main.cjs`, every `spawn(...)` gets `{ windowsHide: true }`. Audit-grep: `grep -r "Popen\|spawn(" backend frontend/electron`.
- **Test:** Launch packaged exe, screen-record 10s, scan for any new window appearing/disappearing.

### D1-2 [ ] Terminal WebSocket disconnect
- **Symptom:** Code mode terminal shows "WebSocket connection error" indefinitely.
- **Cause candidates:** (a) port mismatch renderer↔backend, (b) winpty DLLs not loading from PyInstaller bundle, (c) `/ws/terminal/{project}` requires project pre-registered.
- **Fix:**
  - Inject backend port from `preload.cjs` as `window.CUBOS_BACKEND_PORT` (single source).
  - Add `/ws/terminal/health` simple-echo route for renderer to probe first.
  - Log winpty load errors at backend startup; fallback to `subprocess.Popen` + pipes if winpty fails.
  - Auto-reconnect with backoff in `TerminalPanel.tsx`.
- **Test:** Harness opens WS, sends `echo hi`, asserts `hi\n` returned within 3s.

### D1-3 [ ] Run/Debug Python exits code 2, flashes
- **Symptom:** Click Run → quick terminal flash → "process exited code 2".
- **Cause:** Spawns a new console window instead of routing into the in-app PTY; script path not resolved against project root.
- **Fix:** Run/Debug always pipes through the same `/ws/terminal/{project}` PTY. Resolve `path.resolve(projectRoot, file)` first. Keep buffer after exit.
- **Test:** Harness creates `print('hello')` script, triggers run endpoint, asserts WS receives `hello`.

### D1-4 [ ] API keys not pre-filled in Settings
- **Symptom:** All provider fields say "paste API key" even after keys were saved/provided.
- **Cause:** Frontend reads from localStorage; backend `secrets_manager` not consulted.
- **Fix:** `SettingsPage` API-keys tab → on mount `GET /secrets/list` (returns names + masked previews). Save → `POST /secrets`. Backend never returns raw values.
- **Test:** Harness: POST a key → GET /secrets → assert name present and value masked.

### D1-5 [ ] Active provider/model mismatch
- **Symptom:** Switched to Groq → AI still says "I'm GPT-4"; UI labels say "Qwen2.5-coder" everywhere.
- **Cause:** Two frontend sources of truth (hook + manager) diverge; backend caches handler at module-load.
- **Fix:** Backend `/settings/provider` is canonical. Frontend always fetches it fresh. Remove hardcoded model labels — display `${provider}/${model}`. Clear `ai_client` handler cache on `POST /settings/provider/model`.
- **Test:** Harness POSTs `{provider:"groq", model:"llama-3.1-70b-versatile"}` → GETs `/settings/provider` → asserts match → sends chat → asserts response metadata reports same provider.

### D1-6 [ ] Audio transcription fails (chat + code mode)
- **Symptom:** Record → stop → "transcription failed internal server error".
- **Cause:** Frontend records `audio/webm;opus`; `transcribe_bytes` saves as `.wav` without conversion; faster-whisper can't decode. Also model cache may be unwritable in Program Files.
- **Fix:** Detect mime, write `.webm`, ffmpeg→wav, then transcribe. Bundle `ffmpeg.exe` in PyInstaller. Move model cache to `%LOCALAPPDATA%\CubOS\models\whisper\`. Pre-download `base.en` on first launch with progress toast.
- **Test:** Harness uploads a real WAV + a real WebM via `/voice/transcribe`, asserts non-empty text.

### D1-7 [ ] Self-Upgrade shows electron cache, not app code
- **Symptom:** "Cache", "Code Cache", "Blob Storage", "configs" — useless. Clicking `index` → "fail to load file".
- **Cause:** Self-Upgrade tree pointed at `app.getPath('userData')` not the resources dir.
- **Fix:** Point at `process.resourcesPath/cubos_backend/` (packaged) or repo root (dev). Filter: `Cache, Code Cache, Blob Storage, Local Storage, Session Storage, Network, GPUCache, DawnGraphite*, *.log, *.ldb`.
- **Test:** Harness: GET `/self-upgrade/files` → assert at least one of [main.py, ai_client.py, agent_tools.py] present, assert none of the blacklist names present.

---

## P1 — Major UX broken

### D3-1 [ ] No resizable panels in Code Mode
- **Symptom:** Explorer/editor/AI panel are fixed widths, ~75% of screen used.
- **Fix:** Replace fixed CSS grid in `CodeModePage.tsx` with `react-resizable-panels`. Three horizontal panels, draggable handles. Persist sizes per-project in localStorage.
- **Test:** Playwright resizes a handle, reloads, asserts size persisted.

### D6-1 [ ] GitHub OAuth never completes
- **Symptom:** "Sign in" → "browser should open" → nothing.
- **Fix:** Register `cubos://` protocol in `main.cjs`. On click → backend issues state → `shell.openExternal(github oauth url)`. Backend route `GET /auth/github/callback` exchanges code → token → secrets. `second-instance` handler in Electron parses `cubos://oauth/callback?code=…`.
- **Test:** Harness mocks GitHub OAuth (intercept localhost callback), asserts token stored.

### D6-2 [ ] PAT field uneditable
- **Symptom:** Personal Access Token input is disabled until project exists.
- **Fix:** Remove the `disabled` gate — PAT is global.
- **Test:** Playwright clicks PAT field on fresh app, types, asserts value.

### D6-3 [ ] Git push/pull "not found"
- **Fix:** Better error message when no remote configured. Add "Set Remote URL" UI under Source Control. After OAuth, auto-configure remote.
- **Test:** Harness inits repo with no remote → push → asserts user-friendly error. Then sets remote → asserts push attempts.

### D4-1 [ ] Import existing project "missing LOC body, project_name"
- **Cause:** Frontend sends camelCase, backend expects snake_case.
- **Fix:** Pydantic `alias_generator=to_camel` on every request model, OR rename frontend keys. Choose one, apply globally.
- **Test:** Harness POSTs camelCase + snake_case to `/projects/import`, both succeed.

### D4-2 [ ] Clone git repository (assumed broken)
- **Fix:** Verify `POST /project/clone` works with `{url, name, token?}`. Use GitPython with `windowsHide`. Stream progress.
- **Test:** Harness clones `https://github.com/octocat/Hello-World.git`, asserts project registered.

### D4-3 [ ] Projects deleted when creating new one
- **Cause:** Registry overwrite or Home page filter bug.
- **Fix:** Audit `project_registry.register_project` — must be append-only. Home page lists ALL projects sorted by `last_accessed`.
- **Test:** Harness creates 3 projects sequentially, GET `/projects` returns all 3.

### D4-4 [ ] Chat opens previous chat from wrong project
- **Cause:** Active-thread ID in global localStorage.
- **Fix:** Key by project: `activeThread_${projectName}`. Clear on project switch.
- **Test:** Playwright: create proj A, open chat, create proj B, open chat → assert new empty thread.

### D2-1 [ ] AI provider switch doesn't swap model
- **Same as D1-5.**

### D2-2 [ ] Settings → AI tab non-functional dropdowns
- **Fix:** Audit every control; wire each to backend POST; add "Test connection" button per provider.
- **Test:** Harness toggles every control, GETs corresponding state, asserts changed.

### D2-3 [ ] Gemini in provider list (never requested)
- **Cause:** Hardcoded list.
- **Fix:** Frontend always populates from `GET /settings/providers`.
- **Test:** Harness asserts provider dropdown matches exactly `[anthropic, groq, ollama, openai, openrouter]`.

---

## P2 — Polish

### D1-8 [ ] Run output panel disconnected from PTY
- **Fix:** Output panel subscribes to `terminal:data` events when a Run is launched.
- **Test:** Run script → assert Output panel receives same bytes as terminal.

### D1-9 [ ] "Voice input requires an active project" hard error
- **Fix:** If no project, show "Create a project to use voice" + button; don't crash.
- **Test:** Playwright opens voice input with no project, asserts friendly message.

### D5-1 [ ] Self-upgrade "index" file fails to load
- **Same as D1-7** (filter removes leveldb files).

---

## P3 — Test infrastructure (the most important item)

### T-1 [x] Real endpoint test harness
- **`tools/run_full_test.py`** (Python): spawns uvicorn on a free port, waits for healthcheck, then hits every route. Records: `route, method, status, latency_ms, body_excerpt, pass/fail` and writes `TEST_REPORT.md`.
- Includes WebSocket tests (`/ws/terminal`, `/ws/voice`) by sending bytes and asserting echoes/transcripts.
- Includes file-upload tests (real WAV bytes for `/voice/transcribe`).
- Exit code non-zero if any required route fails.
- Mid-suite liveness probe aborts cleanly if backend dies.
- **Status:** built and run on 2026-05-11. 26/28 PASS (see Empirical test results above). Will be re-run after every batch.

### T-2 [ ] Playwright E2E against packaged exe
- **`app/frontend/tests/e2e/`**: launches `win-unpacked/CubOS.exe`, attaches via CDP. Scripted flows: boot, create project, terminal echo, run script, switch provider, record audio (mock blob), resize panels, GitHub OAuth (mocked), clone repo (mocked).
- Emits per-flow pass/fail.

### T-3 [ ] Release gate
- **`tools/release_check.ps1`**: run T-1 + T-2 + existing smoke tests + vitest. If anything fails, `exit 1` BEFORE electron-builder runs. No more "looks like it works" installers.

---

## Batch execution order (when greenlit)

| Batch | Focus | Items |
|-------|-------|-------|
| **D0** | Test infrastructure | T-1, T-2, T-3 (do this FIRST so we can measure fixes) |
| **D1** | Subprocess hygiene + terminal | D1-1, D1-2, D1-3, D1-8 |
| **D2** | Settings wiring + provider truth | D1-4, D1-5, D2-1, D2-2, D2-3 |
| **D3** | Layout & resizable panels | D3-1 |
| **D4** | Projects/Chat scoping | D4-1, D4-2, D4-3, D4-4 |
| **D5** | Self-Upgrade scope | D1-7, D5-1 |
| **D6** | GitHub OAuth + Git ops | D6-1, D6-2, D6-3 |
| **D7** | Audio pipeline | D1-6, D1-9 |
| **Verify** | Re-run full harness, update statuses | all |

After each batch, re-run T-1+T-2 and update statuses in this doc. No batch is "done" until its items are `[x]` (empirically verified), not `[?]`.

---

## Honesty contract

- "Smoke test passes" ≠ "feature works". From now on:
  - A check mark requires a `tools/run_full_test.py` row showing `PASS` for that exact behavior.
  - Anything that can't be tested automatically (visual layout, OAuth browser flow) gets `[?]` until manually verified by user — never `[x]`.
- If a fix attempt fails verification, item flips to `[!]` and we re-investigate. No silent claims of success.

---

## Empirical test results (run 3 — clean, harness fixed)

Harness: `tools/run_full_test.py` (frontend_sweep moved before openapi_sweep + shared warm client + `asyncio.wait_for` cap) · Report: `TEST_REPORT.md` · Date: 2026-05-11

**Coverage:** 216 checks · **Score:** 198 PASS · 18 FAIL · **1 required-fail** (`WS /ws/terminal`)

### Group summary (run 3)

| Group | Total | Pass | Fail | Required-fail |
|---|---|---|---|---|
| core | 6 | 6 | 0 | 0 |
| frontend_sweep | 22 | 21 | 1 | 0 |
| openapi_sweep | 185 | 172 | 13 | 0 |
| voice | 1 | 0 | 1 | 0 |
| websocket | 2 | 0 | 2 | 1 |

The 22 run-2 frontend_sweep "failures" were confirmed to be harness false positives — after the harness fix, frontend_sweep dropped to a single real failure (`GET /api/github/auth/initiate` 500, same one openapi_sweep catches). No backend regressions.

### Confirmed real failures + root causes (after run 3)

#### F1 — `GET /api/github/auth/initiate` → 500
- **File:** `app/backend/api/github_auth.py` lines 26-29
- **Code:**
  ```py
  @router.get("/initiate")
  async def initiate_oauth():
      if not GITHUB_CLIENT_ID:
          raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
  ```
- **Root cause:** Env var `GITHUB_CLIENT_ID` not set on this machine. The handler raises 500 for what is actually an unconfigured/disabled feature — wrong status code for the semantics.
- **Fix:** Return **503 Service Unavailable** (or 501 Not Implemented) with body `{"detail":"GitHub OAuth not configured","configured":false}`. Same on `/callback` (line 45). Frontend should show "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Settings → Integrations" instead of erroring.
- **Maps to:** D6-1.
- **Test:** harness asserts 503 with `configured:false`; with env vars set, asserts 200 with `auth_url`.

#### F2 — Thread routes return 500 on invalid IDs (should be 400/404)
- **File:** `app/backend/thread_routes.py` lines 85-163 (and similar pattern elsewhere in the file)
- **Code (representative):**
  ```py
  @router.get("/api/threads/{thread_id}")
  def api_get_thread(thread_id: str):
      try:
          if "_" not in thread_id:
              raise HTTPException(status_code=400, detail="Invalid thread ID format")
          ...
      except FileNotFoundError as e:
          raise HTTPException(status_code=404, detail=str(e))
      except Exception as e:
          raise HTTPException(status_code=500, detail=str(e))   # <-- swallows HTTPException
  ```
- **Root cause:** The broad `except Exception` catches `HTTPException` itself (it's a subclass of `Exception`), so the deliberately-raised 400 gets re-wrapped as 500. Affects:
  - `GET /api/threads/{thread_id}` (line 85)
  - `PUT /api/threads/{thread_id}/title` (line 102)
  - `DELETE /api/threads/{thread_id}` (line 124)
  - `GET /api/threads/{thread_id}/messages` (line 146)
  - `POST /api/threads/{thread_id}/messages` (line 166)
  - Likely `messages/count` and `stream` further down the file
- **Fix:** Add `except HTTPException: raise` immediately before the generic `except Exception:` in every handler. One-line per handler. Apply to all 7 handlers in `thread_routes.py`.
- **Maps to:** D7-1.
- **Test:** harness already covers `GET /api/threads/1` → expect 400 (was 500); add `/api/threads/missing_uuid` → expect 404.

#### F3 — 8 project AI-work routes time out (6s cap)
- **Files:** `app/backend/wave2_routes.py` (workspace/analyze, pair/plan, pair/review, cowork/instruction), `app/backend/advanced_routes.py` (coagent/api-contracts, coagent/project-state, coagent/workspace-map), `app/backend/main.py` (chat/summary/refresh).
- **Code (representative — `wave2_routes.py:368`):**
  ```py
  @router.post("/project/{project_name}/workspace/analyze")
  def analyze_workspace(project_name: str, request: WorkspaceAnalyzeRequest):
      ensure_project_memory(project_name)        # creates dir for stub name!
      ...
      analysis = ask_ollama(prompt)              # blocks event loop on AI call
      return {...}
  ```
- **Root cause:** Three independent problems chained:
  1. **No project-exists guard.** `ensure_project_memory()` silently creates state for any name, including the stub `"test_project_001"` the harness sends. So validation never fails.
  2. **Sync `ask_ollama` call from a sync handler.** Blocks one of uvicorn's worker threads for the duration. With no Ollama backend running on this machine, the request hangs until upstream timeout (~30s+), but the harness caps at 6s.
  3. **No timeout on `ask_ollama`.** Even when Ollama is up but slow, the route can hang minutes.
- **Fix (three parts):**
  1. Add `_assert_project_exists(project_name)` at the top of every project-scoped AI route — raise 404 if the workspace_root in the registry does not exist. Centralize the helper in `project_registry.py`.
  2. Add `timeout=15.0` to `ask_ollama` (and surface upstream HTTP timeout config in `ollama_client.py`). On timeout: raise 504 Gateway Timeout with `{"detail":"AI backend timed out","provider":"ollama"}`.
  3. Convert these handlers to `async def` + `await asyncio.to_thread(ask_ollama, prompt)` so they don't pin a uvicorn worker.
- **Maps to:** D8-1 (new batch).
- **Test:** harness asserts 404 on stub project name. With a real project, asserts the call completes within 20s OR returns 504.

#### F4 — `POST /voice/transcribe` times out (15s)
- **File:** `app/backend/main.py` line 1505-1509 + `voice_tools.py` lines 73-87
- **Code:**
  ```py
  @app.post("/voice/transcribe")
  async def transcribe_endpoint(file: UploadFile = FileField(...)):
      from voice_tools import transcribe_bytes
      data = await file.read()
      return transcribe_bytes(data, filename=file.filename or "audio.wav")
  ```
  but
  ```py
  def transcribe_bytes(audio_bytes, suffix=".wav", model_size="base.en", language=None): ...
  ```
- **Root cause:** Two bugs:
  1. **Signature mismatch.** Caller passes `filename=`; callee has no `filename` param → `TypeError` on every invocation.
  2. **Format detection missing.** Frontend records `audio/webm;opus`; even if the `filename` bug is fixed, the temp file is always written with `.wav` suffix regardless of actual bytes, so faster-whisper can't decode WebM/Opus.
  3. **Sync call from async handler.** Whisper model init (~5-10s first run) blocks the entire event loop, which is why the harness also sees `/voice/available` go borderline 6s after a transcribe attempt.
- **Fix:**
  1. Change `transcribe_bytes` signature to `(audio_bytes, *, filename: str = "audio.wav", model_size="base.en", language=None)`; infer `suffix` from `Path(filename).suffix or ".wav"`.
  2. Detect mime via magic-bytes (`b"RIFF...WAVE"` → wav, `b"\x1aE\xdf\xa3"` → webm/matroska, `b"OggS"` → ogg). If non-wav, shell out to bundled `ffmpeg.exe` to convert → wav.
  3. Make the endpoint use `await asyncio.to_thread(transcribe_bytes, ...)`.
  4. Move whisper cache to `%LOCALAPPDATA%\CubOS\models\whisper\` (writable in Program Files installs).
- **Maps to:** D1-6 (audio pipeline batch).
- **Test:** harness uploads a real silent WAV → expects 200 with `text` field (may be empty). After fix, also upload a real WebM blob → 200.

#### F5 — `WS /ws/terminal/{project}` handshake timeout (REQUIRED-FAIL)
- **File:** `app/backend/main.py` line 1725, `app/backend/terminal_pty.py` lines 53-100
- **Root cause:** `handle_terminal_session` calls `_run_winpty` which on this machine fails to import `winpty` (or fails to spawn) and falls through to "fallback shell" — but before any output is sent, an upstream send/receive failure causes the connection to drop within the 5s handshake window. Also: harness sends `echo hi\r\n`, but pywinpty needs `\r` only on some shells, and our handler currently only does pure passthrough — no welcome banner means the harness can't detect "ready" state.
- **Fix:**
  1. Send a synchronous `{"type":"ready"}` JSON message immediately after `await websocket.accept()` so clients can detect handshake completion before any PTY init.
  2. Wrap `_run_winpty` with a try/except that surfaces the underlying error as `{"type":"error","detail":...}` and explicitly switches to subprocess fallback.
  3. Log winpty DLL load failures to backend log at startup so they're discoverable.
  4. Add `/ws/terminal/health` simple-echo route (no PTY) for connectivity probing.
- **Maps to:** D1-2.
- **Test:** harness opens WS, expects `{"type":"ready"}` within 2s, then sends `echo hi\r\n`, expects `hi` in any output frame within 5s.

#### F6 — `WS /ws/voice` handshake timeout
- **File:** `app/backend/main.py` lines 1511-1547
- **Root cause:** `await websocket.accept()` succeeds, but the loop is `while True: await websocket.receive()` — no welcome frame, so the harness's `recv()` blocks indefinitely; harness times out the handshake at 5s.
- **Fix:** Send `{"type":"ready","stt_available": is_stt_available()}` immediately after `accept()`. Optional: emit a `{"type":"closed"}` on disconnect.
- **Maps to:** D1-6.
- **Test:** harness expects ready frame within 2s; then sends 1s of silent PCM, sends `__flush__`, expects transcript JSON within 30s.

#### F7 — `GET /voice/available` borderline timeout (6s harness cap)
- **File:** `app/backend/main.py` line 1495 + `voice_tools.py` lines 122-140
- **Root cause:** Synchronous HTTP fetch of HuggingFace `voices.json` (~few hundred KB) over the wider internet from a sync FastAPI handler. On a slow connection it exceeds 6s. Not a bug, but a UX hazard.
- **Fix:** Cache the index on disk under `%LOCALAPPDATA%\CubOS\models\piper\voices_index.json` with 24h TTL. Make handler `async def` + `await asyncio.to_thread(...)`. Add `?refresh=true` query param to bust cache.
- **Maps to:** D1-6 (low-prio item in same batch).
- **Test:** harness asserts response < 2s after first call (cache hit).

### Why no other backend issues

After harness fix + run 3, the 198 PASS items include:
- All 6 core routes (root, projects, settings, models, providers).
- All Git endpoints (8 routes) — return correct 200/400/422 codes.
- All GitHub auth endpoints except `/initiate` (status/callback/pat/repos all validate correctly).
- All Tasks routes (5).
- All file/extract routes.
- All project CRUD (create/get/patch/delete/archive/import/list).
- All settings sub-routes.
- All slash/themes/history/voice-meta/secrets/roles/prompts.
- All wave2/wave3/wave4 routes that have proper validation.
- All scaffold/snapshot/search/runs/tests routes.

The 13 openapi_sweep fails are exactly: 5 thread routes (F2), 1 github (F1), 7 project AI routes (F3) — already covered. Plus voice_transcribe (F4) and two WS (F5, F6) and `/voice/available` (F7). **Total real backend bugs to fix: 7 distinct root causes covering 18 endpoints.**

---

## Comprehensive prioritized fixing plan

### Batch ordering (P0 → P3)

| Order | Batch | Items | Risk | Why first |
|---|---|---|---|---|
| 1 | **D0 — test infra hardening** | T-1 already built; add F-helpers (project-creation fixture, mock-AI fixture, ffmpeg probe) | low | every subsequent fix must be measurable |
| 2 | **D7 — thread routes (F2)** | swap `except Exception` order | trivial | 1-line each × 7 handlers; immediate green on 5 failing endpoints |
| 3 | **D6 — GitHub auth status code (F1)** | 500→503 + config probe endpoint `/api/github/auth/config` | trivial | 5 lines; unblocks frontend "not configured" UI |
| 4 | **D1-PTY — terminal WS (F5)** | ready frame + winpty fallback logging + `/ws/terminal/health` | medium | required-fail; needed for Code Mode |
| 5 | **D1-Voice — voice WS + transcribe + available (F4, F6, F7)** | ready frame, sig fix, ffmpeg pipeline, async wrapping, voices cache | medium | unblocks chat voice input + voice-picker UI |
| 6 | **D8 — project AI routes (F3)** | project-exists guard + `asyncio.to_thread` + ollama timeout → 504 | medium | turns 8 hangs into fast 404/504; pre-req for advanced features |
| 7 | **D9 — re-run harness** | clean run 4 expected: 215/216 (only `/voice/available` may still vary on slow networks) | — | verify all fixes |
| 8 | **D2..D5** as in existing plan above (UI-driven; need Playwright T-2) | — | high (UI) | requires packaged exe + Playwright |

### Acceptance criteria for "fix complete"

For each F item:
1. The exact endpoint in `tools/run_full_test.py` flips from FAIL → PASS without lowering harness strictness.
2. A new regression-test row is added that exercises the *correct* expected behavior (not just "not 500"):
   - F1: 503 + `configured:false`
   - F2: 400 on bad ID, 404 on missing thread
   - F3: 404 on stub project, 504 when AI backend unreachable, 200 when reachable
   - F4: 200 with `text` key on real WAV
   - F5: `{"type":"ready"}` within 2s, then echo round-trip within 3s
   - F6: `{"type":"ready"}` frame, then transcript JSON after `__flush__`
   - F7: < 2s response on warm cache

3. `tools/run_full_test.py` exit code is 0 (no required-fail) before any installer build.

### Estimated effort

| Batch | Files touched | LOC est. | Time |
|---|---|---|---|
| D7 (F2) | 1 (`thread_routes.py`) | ~14 | 10 min |
| D6 (F1) | 1 (`api/github_auth.py`) | ~10 | 10 min |
| D1-PTY (F5) | 2 (`main.py`, `terminal_pty.py`) | ~30 | 30 min |
| D1-Voice (F4,F6,F7) | 3 (`main.py`, `voice_tools.py`, plus ffmpeg bundling) | ~80 | 1-2 h |
| D8 (F3) | 4 (`wave2_routes.py`, `advanced_routes.py`, `main.py`, `ollama_client.py`) + 1 helper | ~60 | 1 h |
| D9 verify | harness re-run | — | 5 min |
| **Total backend bug fixes** | **~11 files, ~190 LOC** | **3-4 hours** |

UI/Playwright work (D1-1, D1-3, D1-4, D1-5, D1-7, D1-8, D1-9, D2-1..3, D3-1, D4-*, D6-2, D6-3) is unchanged and remains gated on T-2 harness.

---

## Greenlight checklist (await approval before coding)

- [ ] User confirms the batch ordering D7 → D6 → D1-PTY → D1-Voice → D8 → D9
- [ ] User confirms F3's "404 on stub project + 504 on AI timeout" is the desired contract (vs. e.g., return-empty-graceful)
- [ ] User confirms ffmpeg.exe bundling is acceptable (~30MB addition to installer) for F4
- [ ] User confirms moving whisper model cache to `%LOCALAPPDATA%` (instead of in-tree) is acceptable
- [ ] Once approved, fixes proceed in declared order, with harness re-run after each batch

