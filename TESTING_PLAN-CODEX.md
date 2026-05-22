# CubOS Testing Plan - Codex

> Endpoint-first testing plan for the copied workspace at `D:\AI_SYSTEM - Codex`.
> No full test run should begin until the user approves it.
>
> Created: 2026-05-12

## Purpose

The goal is to prove both halves of the system:

1. Backend endpoints behave correctly when called directly.
2. Frontend code calls the right endpoints with the right HTTP method, payload,
   path params, query params, and websocket protocol.

The existing `tools/run_full_test.py` is the right foundation, but it needs a
Codex preflight and better frontend contract checks before we rely on it for the
copy.

## Phase 0 - Preflight Before Any Full Run

Do not run the full suite until these pass:

- Python runtime:
  - Confirm a working Python executable.
  - Confirm `python -m uvicorn main:app` works from `app/backend`.
  - If copied venv is broken, rebuild it before continuing.
- Isolation:
  - Set `CUBOS_BASE_PATH=D:\AI_SYSTEM - Codex`.
  - Fail fast if active registry paths point to `D:\AI_SYSTEM`.
  - Create harness projects under `D:\AI_SYSTEM - Codex\workspaces`.
- Report safety:
  - Default to `TEST_REPORT-CODEX.md`.
  - Only update `TEST_REPORT.md` after the user approves canonical replacement.
- Network controls:
  - Mark GitHub, Ollama, HuggingFace, and external clone calls as mocked, skipped,
    or explicitly live.

## Phase 1 - Endpoint Discovery

Backend discovery:
- Start the backend on a free localhost port with `CUBOS_BASE_PATH` set.
- Fetch `/openapi.json`.
- Enumerate every HTTP method/path pair.
- Compare runtime OpenAPI routes against static decorators found in:
  - `app/backend/main.py`
  - `app/backend/thread_routes.py`
  - `app/backend/api/*.py`
  - `app/backend/wave*_routes.py`
  - `app/backend/code_agent_routes.py`
  - `app/backend/advanced_routes.py`
- Fail if duplicate method/path pairs appear without an allowlist.

Frontend discovery:
- Scan `app/frontend/src` for:
  - `api.*` service calls
  - `fetch(...)`
  - websocket URL construction
  - direct `getApiBase()` usage
- Normalize dynamic segments to placeholders.
- Map every frontend call to one backend route.
- Flag raw fetches that bypass `services/api.ts`.

Artifacts:
- Write the discovered matrix to `ENDPOINT_AUDIT-CODEX.md`.
- Include route source, frontend caller, method, path, expected status class, and
  test fixture used.

## Phase 2 - Backend Direct Endpoint Suite

For every discovered backend HTTP endpoint:

- Send a direct request with schema-aware payloads.
- Treat these as acceptable for generic sweeps:
  - 200/201/204 for success
  - 400/401/403/404/405/409/422 for validation/auth/not-found conflicts
- Treat these as failures:
  - 500/502/503 unless explicitly expected for unavailable optional integration
  - timeout
  - connection reset
  - response body that is not valid JSON where JSON is expected

Endpoint groups:
- Core: `/`, `/projects`, `/settings`, `/models`
- Projects: create/import/get/update/archive/delete/clone/source-link
- Threads: list/create/get/title/delete/messages/count/stream/cancel
- Files: list/read/range/write/overwrite/diff/delete/move/search/extract
- Memory/tasks/notes/tests/snapshots/activity/approvals
- AI/chat/agent/code-agent/wave2/wave34 advanced routes
- Settings/providers/models/secrets/roles/themes/slash/history
- Git and GitHub auth
- Ingest/documents/media/voice/web/search
- WebSockets: terminal and voice

Regression rows required for known failures:

| ID | Target | Expected |
|---|---|---|
| R-C1-1a | `GET /api/github/auth/initiate` with OAuth env missing | 503 with `configured:false` |
| R-C1-1b | `GET /api/github/auth/config` | 200 with readiness booleans |
| R-C1-2a | `GET /api/threads/1` | 400 |
| R-C1-2b | `GET /api/threads/missing_nope` | 404 or documented invalid-id result |
| R-C1-3a | AI route with unregistered project | 404 under 1s |
| R-C1-3b | AI route with real project and provider down | 504 under configured timeout |
| R-C1-4a | `POST /voice/transcribe` WAV | 200 with `text` key |
| R-C1-4b | `POST /voice/transcribe` WebM | 200 with `text` key or controlled 422 if ffmpeg unavailable |
| R-C1-5a | warm `GET /voice/available` | 200 under 2s |
| R-C1-6a | `WS /ws/terminal/{project}` | ready frame under 2s |
| R-C1-6b | terminal websocket echo | returns `hi` under 5s |
| R-C1-6c | `WS /ws/terminal/health` | ready plus echo under 1s |
| R-C1-4c | `WS /ws/voice` | ready frame under 2s |
| R-C1-7a | duplicate route detector | no unapproved duplicate method/path |

Sprint 2 smoke coverage now exists in `tools/run_sprint2_smoke_codex.py`.
It is intentionally narrower than the full endpoint suite and avoids live model
downloads:

- `ask_ollama(..., timeout=...)` returns 504 on timeout.
- Unregistered project AI routes return 404 quickly.
- `/voice/available` returns 200 under the warm-path latency target.
- `/ws/terminal/health` returns ready plus pong.
- `/ws/terminal/{project_name}` returns ready and echoes `hi`.
- `/ws/voice` returns ready.

## Phase 3 - Frontend API Contract Suite

This is not visual E2E yet. It verifies frontend wiring.

Sprint 3 status:
- Implemented `app/frontend/src/services/api.contracts-codex.test.ts`.
- Current passing coverage:
  - project import normalizes `source_path`/`path` into `POST /projects/import`;
  - Git status resolves project metadata and calls `/api/git/status` with
    `project_path`;
  - Git commit stages selected files before `POST /api/git/commit`.
- Runtime result: `npm.cmd --prefix app\frontend run test` passed 4/4 tests.
- Build result: `npm.cmd --prefix app\frontend run build` passed after the
  TypeScript check.

For every frontend call site:

- Resolve the current backend base URL after Electron dynamic-port init.
- Call through the same frontend service method when one exists.
- For raw fetches, either:
  - migrate them into `services/api.ts`, or
  - add a targeted contract test proving the raw call is correct.
- Assert the backend sees the expected method/path/body.

Required contract tests:

| Flow | Frontend source | Backend expectation |
|---|---|---|
| Project list | `api.projects.list` | `GET /projects` |
| Project create | `api.projects.create` | `POST /projects/create` |
| Project import | Home/NewProject/Welcome/CodeMode | one canonical `POST /projects/import` body |
| Thread list/create | project workspace and code mode | `/api/projects/{project}/threads` |
| Thread stream/cancel | chat/code mode | `/api/threads/{id}/stream` and `/cancel` |
| File list/read/write/overwrite | file tree/editor | `/project/{project}/file*` |
| Terminal | terminal components | `WS /ws/terminal/{project}` ready frame |
| Git status/commit/push/pull | main git panel | chosen canonical git API, no 404s |
| GitHub OAuth | auth dialog | config-aware 503 or auth URL |
| GitHub PAT | auth dialog | PAT auth route remains editable and callable |
| Settings provider/model | settings/model selector | backend provider endpoints only |
| Voice upload | chat/code voice flows | media upload or voice transcribe contract |
| Analysis/code-agent | project right panel | project AI routes return 404/504/200 as expected |

Pass criteria:
- No frontend call returns 404.
- No frontend call depends on hardcoded port 8000 after Electron gives a port.
- No frontend call uses an endpoint shape that differs from backend request models.

Remaining contract expansion:
- Add contract coverage for file tree/editor read-write calls.
- Add contract coverage for thread stream/cancel and chat stream calls.
- Add contract coverage for GitHub OAuth unconfigured/PAT flows.
- Add contract coverage for settings provider/model persistence.
- Add contract coverage for terminal websocket ready-frame behavior.

## Phase 4 - Playwright/Electron UI E2E

Run only after backend and contract suites pass.

Launch modes:
- Dev mode: Vite frontend plus backend on a free port.
- Packaged mode: `dist-electron/win-unpacked/CubOS.exe` with backend spawned by Electron.

UI flows:
- Boot app and wait for backend readiness.
- Create project, reload, confirm it remains in project list.
- Import existing folder and confirm files appear.
- Open project chat, create thread, stream/cancel a response.
- Switch between two projects and confirm thread history is isolated.
- Open Code Mode, list files, open file, save file through overwrite endpoint.
- Terminal connects, receives ready frame, echoes `hi`.
- Run/debug routes output into the intended panel.
- Git panel loads status and does not call missing endpoints.
- Settings loads masked secrets and provider list from backend.
- OAuth unconfigured state displays cleanly; PAT field is usable.
- Voice upload/transcribe path displays success or controlled unsupported-format error.
- Self-upgrade shows copy code files, not Electron cache/user-data folders.
- Resize panels and verify persisted layout.

Artifacts:
- Playwright HTML report.
- Screenshots on failure.
- Optional trace zip for failed flows.

## Phase 5 - Release Gate

After fixes and approved testing:

1. Backend direct endpoint suite: 0 required failures.
2. Frontend contract suite: 0 unmapped or 404 frontend calls.
3. Playwright/Electron E2E: all required flows pass.
4. Frontend unit/build:
   - `npm.cmd run test`
   - `npm.cmd run build`
5. Backend packaging smoke:
   - PyInstaller build imports backend.
   - Packaged app starts backend on dynamic port.
6. Final path-safety check:
   - no active runtime state points to original `D:\AI_SYSTEM`.

## Commands To Run Later After Approval

These are intentionally not run yet:

```powershell
# Preflight only
tools\run_full_test.py --preflight-only --base-path "D:\AI_SYSTEM - Codex"

# Backend endpoint suite, Codex report
tools\run_full_test.py --base-path "D:\AI_SYSTEM - Codex" --report "TEST_REPORT-CODEX.md"

# Sprint 2 focused backend smoke
tools\run_sprint2_smoke_codex.py

# Frontend unit tests
npm.cmd --prefix app\frontend run test

# Frontend build
npm.cmd --prefix app\frontend run build

# Playwright/Electron E2E, after it exists
npm.cmd --prefix app\frontend run test:e2e
```

Note: the Codex harness flags have been added and preflight passed with the copied
backend venv when run through the user-approved outside-sandbox execution path.
The Sprint 2 focused smoke also passed 12/12 through that same approved execution
path.
