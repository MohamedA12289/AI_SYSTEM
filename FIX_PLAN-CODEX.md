# CubOS Fix Plan - Codex

> Codex-owned fixing plan for the copied workspace at `D:\AI_SYSTEM - Codex`.
> This does not replace `FIX_PLAN.md`; it tightens the next repair pass around
> copy isolation, endpoint contracts, frontend wiring, and test readiness.
>
> Created: 2026-05-12
> Current empirical baseline: `TEST_REPORT.md` from 2026-05-11, 198/216 pass,
> 18 fail, 1 required-fail.

Sprint 1 status:
- `[x]` Codex preflight passed using the copied backend venv outside the sandbox.
- `[x]` Narrow Sprint 1 backend smoke passed for GitHub auth config, thread ID
  errors, project import routing, registry path safety, and duplicate-route guard.
- Full endpoint-suite verification is still reserved for an approved
  `TEST_REPORT-CODEX.md` run because it can trigger live model/network work.

Sprint 2 status:
- `[x]` Focused Python syntax checks passed for the touched backend modules and
  `tools/run_sprint2_smoke_codex.py`.
- `[x]` Sprint 2 backend smoke passed 12/12:
  AI timeout -> 504, project AI guards -> 404, `/voice/available` warm path under
  2 seconds, terminal health ready/pong, terminal ready plus `echo hi`, and
  `/ws/voice` ready frame.
- `[x]` Codex preflight still passes after Sprint 2.
- Full endpoint-suite verification remains the next heavier backend gate; do not
  run it silently because voice transcription may download faster-whisper model
  weights and WebM conversion may require ffmpeg.

Sprint 3 status:
- `[x]` Project import UI callers now route through `api.projects.importExisting`
  and the canonical `POST /projects/import` payload normalizer.
- `[x]` Main Git service now resolves project metadata to `workspace_root` before
  calling `/api/git/*`; BranchSwitcher checkout now uses the backend checkout
  route instead of a placeholder toast.
- `[x]` Frontend backend-base initialization is awaited by shared API requests,
  stream calls, terminal websocket construction, GitHub auth, file/editor panels,
  source control, tasks, and clone dialogs.
- `[x]` Provider/model UI wiring now uses backend provider state and backend
  provider/model mutation routes.
- `[x]` Frontend contract tests pass: 4/4 via `npm.cmd --prefix app\frontend run test`.
- `[x]` Production frontend build passes via `npm.cmd --prefix app\frontend run build`.
- `[ ]` Playwright/Electron UI E2E is still reserved for Sprint 4/final gate.

## Ground Rules

- Do not run destructive or write-capable tests against the original `D:\AI_SYSTEM`.
- Repair copy isolation before any endpoint harness run that can create projects,
  memory, snapshots, ingest records, or git state.
- A bug is only marked fixed after the backend harness or UI/E2E flow proves the
  exact behavior changed.
- Backend endpoint fixes land before UI polish so the frontend is not built on
  unstable contracts.
- Existing user or generated work must not be reverted unless explicitly asked.

## P0 - Copy Isolation And Testability

### C0-1 [x] Registry still points at the original system

Problem:
- `configs/projects_registry.json` in this copy still contains paths under
  `D:\AI_SYSTEM`, while the active workspace is `D:\AI_SYSTEM - Codex`.
- The `self_upgrade` entry points at `D:\`, which is too broad for a safe copy.
- Legacy memory, ingest, snapshot, and log files also contain old absolute paths.

Fix:
- Add a one-time copy-safety normalization step or script that rewrites registry
  entries from `D:\AI_SYSTEM` to `D:\AI_SYSTEM - Codex` only when the target exists.
- Narrow `self_upgrade.workspace_root` and `scope_root` to the copy root, not `D:\`.
- Keep old memory/chat text as historical content, but do not let runtime registry
  state use the original path.
- Add a preflight check to the test harness that fails fast if any active registry
  workspace/memory/scope path points outside `D:\AI_SYSTEM - Codex` or approved
  temp directories.

Acceptance:
- `GET /projects` returns only projects whose active paths are inside the copy or
  explicitly imported by the test fixture.
- The harness cannot create or mutate anything under `D:\AI_SYSTEM`.

### C0-2 [x] Copied Python venv is broken

Problem:
- `python` is not on PATH.
- `py -3 --version` reports no installed Python.
- `app/backend/venv/Scripts/python.exe` points to
  `C:\Users\moham\AppData\Local\Programs\Python\Python312\python.exe`, which is
  missing, so backend tests cannot start reliably.

Fix:
- Rebuild the backend venv in the copy or point the harness to a known good Python.
- Update `tools/run_full_test.py` to print the chosen Python executable and fail
  with a clear repair message if it cannot run `-m uvicorn`.
- Do not trust old `TEST_REPORT.md` results for this copy until the venv is repaired.

Acceptance:
- `tools/run_full_test.py --preflight-only` or equivalent confirms Python,
  uvicorn, FastAPI, and backend importability before spawning the full suite.

Sprint 1 note:
- The copied venv works when Codex runs it with user-approved outside-sandbox
  execution. Normal sandbox execution still cannot launch that interpreter, so
  backend harness runs should use the approved venv execution path.

### C0-3 [x] Harness writes reports directly during test runs

Problem:
- `tools/run_full_test.py` always overwrites `TEST_REPORT.md`.
- That is fine for approved verification, but bad for planning or exploratory
  route discovery.

Fix:
- Add CLI flags:
  - `--report TEST_REPORT-CODEX.md`
  - `--no-write-report`
  - `--preflight-only`
  - `--base-path "D:\AI_SYSTEM - Codex"`
- Set `CUBOS_BASE_PATH` in the harness environment so runtime data is isolated.

Acceptance:
- Route discovery can run without mutating reports.
- Approved full runs write to a Codex-named report first, then the canonical report
  can be updated intentionally.

## P1 - Backend Endpoint Failures From Current Baseline

### C1-1 [x] GitHub OAuth unconfigured returns 500

Affected:
- `GET /api/github/auth/initiate`
- `GET /api/github/auth/callback` when env is missing
- `GitHubAuthDialog.tsx` assumes successful JSON and opens `data.auth_url`

Fix:
- Return `503 Service Unavailable` with `{configured:false}` when OAuth env is not set.
- Add `GET /api/github/auth/config` returning OAuth readiness.
- Frontend checks `response.ok` and shows a configuration message instead of trying
  to open an undefined URL.

Acceptance:
- Env missing: `/api/github/auth/initiate` returns 503, not 500.
- Frontend OAuth button shows a controlled unconfigured state.
- PAT auth remains usable without OAuth config.

### C1-2 [x] Thread routes rewrap intended 400/404 errors as 500

Affected:
- `GET /api/threads/{thread_id}`
- `DELETE /api/threads/{thread_id}`
- `GET /api/threads/{thread_id}/messages`
- `GET /api/threads/{thread_id}/messages/count`
- Similar risk in title, send-message, and stream handlers.

Fix:
- In every thread handler, add `except HTTPException: raise` before the generic
  `except Exception`.
- Keep invalid ID format as 400 and missing thread as 404.

Acceptance:
- Bad ID `1` returns 400.
- Well-formed missing ID returns 404.
- No thread route returns 500 for validation failures.

### C1-3 [x] Project AI routes hang on unregistered project names

Affected:
- `/project/{project_name}/workspace/analyze`
- `/project/{project_name}/pair/review`
- `/project/{project_name}/pair/plan`
- `/project/{project_name}/cowork/instruction`
- `/project/{project_name}/chat/summary/refresh`
- `/project/{project_name}/coagent/api-contracts`
- `/project/{project_name}/coagent/project-state`
- `/project/{project_name}/coagent/workspace-map`

Fix:
- Add a central `assert_project_registered(project_name)` helper.
- Call it before `ensure_project_memory` or any LLM work in project-scoped AI routes.
- Wrap blocking LLM calls with bounded timeout behavior and return 504 for upstream
  AI timeout.
- Run blocking AI work in `asyncio.to_thread` where handlers are async.

Acceptance:
- Harness stub project `_harness` returns 404 quickly unless explicitly created.
- Real project plus unavailable AI returns 504 within the configured timeout.
- Real project plus available AI returns 200 without blocking unrelated requests.

Sprint 2 verification:
- `tools/run_sprint2_smoke_codex.py` proves unregistered project AI routes return
  404 quickly and `ask_ollama(..., timeout=...)` raises FastAPI 504 on timeout.

### C1-4 [x] Voice transcription endpoint is broken and blocking

Affected:
- `POST /voice/transcribe`
- `WS /ws/voice`
- Chat/code voice upload flows

Fix:
- Align `transcribe_bytes` signature with callers: accept keyword-only `filename`.
- Infer suffix from filename and detect actual audio format from bytes.
- Convert WebM/Ogg/M4A/MP3 to WAV through a bundled or discovered ffmpeg.
- Run transcription in a worker thread instead of blocking the FastAPI event loop.
- Send a `ready` frame on `/ws/voice` immediately after accept.

Acceptance:
- Silent WAV upload returns 200 with a `text` key.
- Browser-recorded WebM upload returns 200 with a `text` key or a clear 422 if
  ffmpeg is unavailable.
- WebSocket voice returns a ready frame within 2 seconds.

Sprint 2 verification:
- Signature mismatch is fixed by accepting `filename`.
- Voice websocket sends a ready frame within 2 seconds.
- Transcription runs in a worker thread and non-WAV formats get a controlled
  ffmpeg-based conversion path or a 422 error.
- Live WAV/WebM transcription still needs the approved full endpoint suite because
  the first run can download faster-whisper model weights.

### C1-5 [x] Voice availability can block on network

Affected:
- `GET /voice/available`
- `GET /voice/voices`
- voice picker UI

Fix:
- Cache the remote Piper voices index under the active CubOS base path.
- Use a 24h TTL and a `refresh=true` option.
- Return installed voices quickly even if remote refresh fails.

Acceptance:
- Warm `/voice/available` completes under 2 seconds.
- Offline mode returns cached or installed voices without a 5xx.

Sprint 2 verification:
- `/voice/available` returned 200 in 16-19ms in the Sprint 2 smoke after cache and
  lazy STT import changes.

### C1-6 [x] Terminal WebSocket has no deterministic readiness contract

Affected:
- `WS /ws/terminal/{project_name}`
- Code Mode terminal
- run/debug output flows

Fix:
- Send a ready frame immediately after websocket accept.
- Add `/ws/terminal/health` lightweight echo websocket.
- Surface winpty import/spawn failures as structured websocket messages.
- Keep subprocess fallback, with Windows no-window creation flags.

Acceptance:
- Harness receives ready frame within 2 seconds.
- `echo hi` round-trips through the terminal websocket.
- UI can distinguish connection, PTY failure, and fallback mode.

Sprint 2 verification:
- `/ws/terminal/health` returned ready plus pong.
- `/ws/terminal/{project_name}` returned ready and completed `echo hi`.
- WinPTY import/spawn/close and PTY read/write now run without blocking the event
  loop.

### C1-7 [x] Duplicate backend routes shadow intended implementations

Affected:
- `/projects/import`
- `/project/{project_name}/workspace/analyze`
- `/project/{project_name}/pair/*`
- `/project/{project_name}/cowork/instruction`
- `/projects/{project_name}/source/link`
- media/research/scaffold duplicates from wave routers

Fix:
- Decide canonical handler per route and remove or rename duplicates.
- For `/projects/import`, keep one frontend-compatible contract accepting
  `{path, display_name?, description?}` and optionally aliases for
  `{source_path, project_name?, access_mode?}`.
- Add a duplicate-route detector to tests that fails on identical method/path unless
  explicitly allowlisted.

Acceptance:
- OpenAPI shows one canonical route per method/path unless allowlisted.
- Frontend import works from Home, New Project, Welcome, and Code Mode.

## P2 - Frontend/Backend Contract Drift

### C2-1 [x] Main Git panel calls endpoints that mostly do not exist

Problem:
- `api.git.status/branches/commit/push/pull` call `/project/{project}/git/*`.
- Backend only exposes `/project/{project}/git/branch` in that family.
- The working git API is mostly `/api/git/*` with `project_path`.

Fix:
- Pick one canonical frontend git service:
  - Preferred: keep `/api/git/*`, resolve `project_path` from `api.projects.get`.
  - Optional backend compatibility: add project-name wrappers for all git actions.
- Retire or merge overlapping `GitPanel` and `SourceControlPanel` behavior.

Acceptance:
- Git status, stage, unstage, commit, branches, checkout, pull, push, init, set-remote
  are all tested from the frontend service and from backend endpoints.

Sprint 3 verification:
- `api.git.status/branches/checkout/stage/unstage/commit/push/pull` now resolve
  `workspace_root` through `/projects/{project_name}` and call `/api/git/*`.
- `app/frontend/src/services/api.contracts-codex.test.ts` covers git status and
  selected-file commit contract behavior.
- `npm.cmd --prefix app\frontend run test` and `npm.cmd --prefix app\frontend run build`
  both pass.

### C2-2 [x] Project import payloads are inconsistent

Problem:
- Frontend screens send `{path, display_name, description}`.
- `advanced_routes.py` duplicate route expects `{project_name, source_path, ...}` and
  is registered earlier than `main.py`.

Fix:
- One backend contract accepts both old and new shapes, then normalizes internally.
- Frontend uses the normalized service method instead of raw fetches.

Acceptance:
- Home, Welcome, New Project, and Code Mode import all call the same API service.
- Both `path` and `source_path` compatibility tests pass.

Sprint 3 verification:
- Home, Welcome, New Project, and Code Mode all call
  `api.projects.importExisting(...)`.
- The frontend contract suite proves `source_path` normalizes into the canonical
  `POST /projects/import` request body.

### C2-3 [x] Dynamic backend port initialization can race

Problem:
- `api.ts` initializes `BASE` asynchronously after module import.
- Early calls may hit `127.0.0.1:8000` even when Electron launched a different port.

Fix:
- Make API initialization explicit and awaited before first backend call.
- Or expose synchronous preload state once backend port is known.
- Show the actual dynamic port in startup error UI, not hardcoded 8000.

Acceptance:
- Packaged app never attempts frontend calls to port 8000 when backend is on a
  dynamic port.

Sprint 3 verification:
- Shared API requests now await the backend port lookup before `fetch`.
- Remaining frontend callers that bypass the shared request helper use
  `getApiBaseAsync()`.
- The only remaining `127.0.0.1:8000` frontend references are fallback defaults in
  `api.ts` and `TerminalPanel.tsx`, not eager call sites.

### C2-4 [x] Provider lists and settings are split

Problem:
- Frontend settings include providers not supported by backend.
- Backend valid providers are `ollama`, `groq`, `openai`, `anthropic`, `openrouter`.

Fix:
- Frontend provider dropdowns must come from `GET /settings/providers`.
- Settings writes must use backend provider/model routes only.
- Provider/model display must use backend canonical state after reload.

Acceptance:
- Provider UI exactly matches backend providers.
- Switching provider/model persists and survives reload.

Sprint 3 verification:
- Settings provider options are refreshed from `GET /settings/providers`.
- Provider/model changes use `POST /settings/provider`,
  `POST /settings/provider/model`, or `POST /models/active` for Ollama.

### C2-5 [ ] Code Mode central component is too large for safe broad edits

Problem:
- `CodeModePage.tsx` owns file tree, Monaco editor, AI chat, thread list, terminal,
  git, debug, panels, command palette, and import flow.

Fix:
- Do only targeted repairs during this fix pass.
- Avoid broad refactors until endpoint contracts and E2E coverage exist.
- When touching Code Mode, cover the changed flow with Playwright.

Acceptance:
- No Code Mode change lands without a frontend flow test or explicit manual
  verification checklist.

Sprint 3 progress:
- Code Mode import wiring was touched narrowly and now uses the canonical project
  import service.
- Visual/Playwright coverage for the Code Mode import path remains in Sprint 4.

## P3 - Windows Process And Packaging Hygiene

### C3-1 [ ] Subprocesses can create visible windows or hang

Affected:
- `command_tools.py`
- `api/git.py`
- `git_tools.py`
- `settings_store.py`
- `wave1_ingest.py`
- `wave2_routes.py`
- `main.py`
- `media_tools.py`

Fix:
- Centralize subprocess creation helpers for Windows:
  - `run_hidden(...)`
  - `popen_hidden(...)`
- Use `creationflags=CREATE_NO_WINDOW` on Windows.
- Preserve timeouts and captured output.

Acceptance:
- No direct `subprocess.run/Popen` remains in app code without an explicit reason.
- Packaged smoke test shows no command window flashes during boot, git, terminal,
  command run, model list, media probe, or clone.

Sprint 2 progress:
- Added `app/backend/process_utils.py`.
- Applied hidden subprocess handling to touched git, clone, diagnostics, terminal
  fallback, and voice ffmpeg conversion paths.
- Full app-wide subprocess sweep remains in Sprint 4.

### C3-2 [ ] Packaged voice/media dependencies are ambiguous

Problem:
- Voice transcription needs faster-whisper and ffmpeg-like decoding.
- PyInstaller spec must include required runtime modules and binaries.

Fix:
- Confirm packaging includes faster-whisper dependencies actually used at runtime.
- Bundle or locate ffmpeg deterministically.
- Store large downloaded model/cache files under user data, not Program Files.

Acceptance:
- Packaged app can transcribe a small WAV and WebM without developer tools installed.

### C3-3 [ ] Mojibake/encoding artifacts in UI and docs

Problem:
- Many files show corrupted close-button, copyright, dash, and ellipsis characters.

Fix:
- Sweep user-facing UI strings after functional bugs are green.
- Do not mechanically rewrite logs or historical generated reports unless needed.

Acceptance:
- Packaged UI no longer shows mojibake in window text, buttons, dialogs, package
  metadata, or common error messages.

## Codex Sprint Execution Plan

This repair should happen in four Codex runs, not eight separate handoffs.

### Codex Sprint 1 - Safety, Harness, And Fast Backend Fixes

Scope:
- C0-1 copy isolation and registry/path safety.
- C0-2 Python/venv preflight repair plan or implementation.
- C0-3 harness flags for `TEST_REPORT-CODEX.md`, `--preflight-only`, and
  `CUBOS_BASE_PATH`.
- C1-2 thread HTTPException handling.
- C1-1 GitHub OAuth unconfigured 500 -> controlled config/503 behavior.
- C1-7 canonical `/projects/import` route and duplicate-route detector.

Why this is one run:
- These are small, high-leverage fixes.
- They make the copy safe before any test run can mutate project, memory, or
  workspace state.

End of sprint verification:
- Run only the approved Codex preflight and narrow backend smoke checks.
- Do not run the full endpoint suite until the user approves it.

### Codex Sprint 2 - Backend Reliability Pass

Scope:
- C1-6 terminal websocket ready frame, terminal health socket, and fallback errors.
- C1-4 voice transcribe signature/format/threading fixes.
- C1-5 voice availability cache.
- C1-3 project AI route registration guard and AI timeout behavior.
- C3-1 shared hidden subprocess helpers where touched by terminal, git, AI, media,
  and command flows.

Why this is one run:
- These all involve backend runtime behavior and timeout control.
- They share the same verification style: endpoints should respond quickly,
  websocket sessions should announce readiness, and long-running work should not
  block the app.

End of sprint verification:
- Run the focused Sprint 2 backend smoke plus Codex preflight.
- Run the full backend endpoint suite into `TEST_REPORT-CODEX.md` only after the
  user approves possible model/network downloads.

### Codex Sprint 3 - Frontend Contract And UI Flow Wiring

Scope:
- C2-1 canonical git service and main Git panel endpoint repair.
- C2-2 frontend project import callers unified through one service method.
- C2-3 dynamic backend port initialization made deterministic.
- C2-4 provider/model settings sourced from backend only.
- C2-5 targeted Code Mode fixes only where needed by the above.
- Add the frontend contract suite and first Playwright/Electron E2E flows from
  `TESTING_PLAN-CODEX.md`.

Why this is one run:
- These are frontend/backend wiring fixes; doing them together prevents fixing
  one call path while leaving another stale raw fetch behind.

End of sprint verification:
- Frontend contract tests passed: `npm.cmd --prefix app\frontend run test`.
- Frontend production build passed: `npm.cmd --prefix app\frontend run build`.
- Playwright flows for boot, import, threads, terminal, git panel, settings, and
  voice upload are still pending for Sprint 4/final release gate.

### Codex Sprint 4 - Packaging, Polish, And Final Release Gate

Scope:
- C3-2 packaged voice/media dependencies.
- C3-3 user-facing mojibake cleanup.
- Packaged app smoke checks.
- Final full endpoint rerun.
- Final frontend unit/build/E2E pass.
- Repackage only after all gates pass.

Why this is one run:
- Packaging should happen after behavior is stable.
- This sprint is the "prove it and ship the copy" pass.

End of sprint verification:
- `TEST_REPORT-CODEX.md` shows 0 required failures.
- Frontend contract and Playwright flows pass.
- Packaged app starts, uses the dynamic backend port, and does not touch the
  original `D:\AI_SYSTEM`.

## Done Definition

- Backend harness passes with 0 required failures.
- Frontend API sweep proves every frontend call reaches the intended backend route.
- Playwright E2E covers boot, project create/import, chat/thread, file open/save,
  terminal echo, run command, git status/commit path, settings provider, GitHub auth
  unconfigured/PAT, and voice upload.
- No active config path in the copy points to `D:\AI_SYSTEM`.
- The final report is written as `TEST_REPORT-CODEX.md` before canonical docs are
  updated.

## Manual Or User-Approved Codex Items

These are the things Codex should not do silently. Some may be fully automatable
after approval, but they should be called out before a sprint starts.

### Manual Setup Needed From User

- Install or restore a working Python 3.12 runtime if Codex cannot rebuild the
  copied backend venv from an approved Python source.
- Provide API keys through the app settings or `secrets/.env`; do not paste raw
  secrets into chat. Likely keys:
  - `GITHUB_TOKEN` for PAT-based GitHub work.
  - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` only if OAuth should work.
  - `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, or
    `OPENROUTER_API_KEY` for the providers you want active.
- Create/register a GitHub OAuth app if OAuth is desired. The callback/protocol
  details should be confirmed during Sprint 3 before packaging.
- Confirm whether live network tests are allowed for GitHub, HuggingFace, Ollama,
  npm, PyPI, and external git clone tests.
- Manually smoke-test the final packaged `.exe` after Sprint 4 because window
  flashes, installer behavior, and desktop integration are partly visual.

### Downloads Or Installs Requiring Approval

- Rebuild backend dependencies into a fresh venv if the copied venv remains broken.
- Download Python packages from PyPI if missing from the repaired venv.
- Download npm packages or Playwright browsers if frontend/E2E dependencies are
  missing.
- Download or bundle ffmpeg for WebM/Ogg/M4A/MP3 voice conversion.
- Download faster-whisper model weights into the user-data model cache.
- Download Piper voices or the Piper voice index for the voice picker.
- Download or rebuild PyInstaller/Electron packaging artifacts.
- Clone any external repository for live clone/git tests.

### Codex Naming Rule Going Forward

- New planning, audit, and report files created for this copied workspace should
  include `-CODEX` in the filename.
- Test reports should write to `TEST_REPORT-CODEX.md` first.
- New harness logs should use names like `harness-codex-run-4.log`.
- Any future release notes or fix summaries for this copy should use a Codex label
  so they are not confused with the original `D:\AI_SYSTEM` version.
