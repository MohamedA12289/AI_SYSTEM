# CubOS Endpoint Audit - Codex

> Static and document-backed endpoint audit for `D:\AI_SYSTEM - Codex`.
> This file is the planning inventory for `TESTING_PLAN-CODEX.md`; runtime
> counts must be refreshed from `/openapi.json` after the Python/venv preflight
> is repaired.
>
> Created: 2026-05-12

## Current Counts

- Existing `ROUTES.md`: 189 backend routes, 37 frontend call sites, 27 unique
  frontend paths.
- Existing `TEST_REPORT.md`: 216 checks, 198 passed, 18 failed, 1 required-failed.
- Current static decorator scan confirms the same broad backend surface, with
  duplicate routes in multiple wave/advanced modules.

## Known Failing Endpoint Roots

| Root | Endpoint area | Current symptom | Planned fix |
|---|---|---|---|
| C1-1 | `/api/github/auth/initiate` | 500 when OAuth env missing | 503/config contract plus frontend handling |
| C1-2 | `/api/threads/{id}` family | intended 400 rewrapped as 500 | preserve `HTTPException` |
| C1-3 | project AI routes | timeouts on unregistered project | fixed in Sprint 2: project guard plus AI timeout |
| C1-4 | `/voice/transcribe`, `/ws/voice` | timeout/signature mismatch/no ready frame | fixed in Sprint 2: filename support, format handling, worker thread, ready frame |
| C1-5 | `/voice/available` | network/cache timeout | fixed in Sprint 2: local cache, lazy STT import, refresh option |
| C1-6 | `/ws/terminal/{project}` | handshake timeout/no ready frame | fixed in Sprint 2: ready frame, health socket, fallback errors |
| C1-7 | duplicate method/path routes | wrong handler can win | canonicalize or allowlist duplicates |
| C2-1 | frontend Git service | main Git panel called missing `/project/{project}/git/*` routes | fixed in Sprint 3: resolve `workspace_root`, call `/api/git/*` |
| C2-2 | frontend project import | screens mixed raw fetches and payload shapes | fixed in Sprint 3: canonical `api.projects.importExisting` |
| C2-3 | dynamic backend port | early calls could hit fallback port 8000 | fixed in Sprint 3 for shared API plus remaining raw callers |
| C2-4 | provider/model UI | frontend provider list drifted from backend providers | fixed in Sprint 3: provider catalog/settings routes |

## Backend Route Groups To Cover

Core:
- `GET /`
- `GET /activity`

Projects:
- `GET /projects`
- `POST /projects/create`
- `POST /projects/import`
- `POST /projects/import-existing`
- `POST /projects/clone-git`
- `GET/PATCH/DELETE /projects/{project_name}`
- `POST /projects/{project_name}/archive`
- `POST /projects/{project_name}/source/link`

Threads:
- `GET/POST /api/projects/{project_name}/threads`
- `GET/DELETE /api/threads/{thread_id}`
- `PUT /api/threads/{thread_id}/title`
- `GET/POST /api/threads/{thread_id}/messages`
- `GET /api/threads/{thread_id}/messages/count`
- `POST /api/threads/{thread_id}/stream`
- `POST /api/threads/{thread_id}/cancel`

Chat and agent:
- `POST /chat`
- `POST /chat/stream`
- `POST /agent/chat`
- `POST /agent/loop`

Project chat/data:
- `GET /project/{project_name}/scope`
- `GET /project/{project_name}/chat`
- `GET/POST /project/{project_name}/messages`
- `GET /project/{project_name}/chat/summary`
- `POST /project/{project_name}/chat/summary/refresh`

Files:
- `GET /project/{project_name}/files`
- `GET /project/{project_name}/file`
- `GET /project/{project_name}/file/range`
- `POST /project/{project_name}/file/write`
- `POST /project/{project_name}/file/overwrite`
- `POST /project/{project_name}/file/diff`
- `POST /project/{project_name}/file/move`
- `DELETE /project/{project_name}/file`
- `GET /project/{project_name}/files/search`
- `POST /project/{project_name}/files/extract`
- `POST /files/extract-absolute`

Project state:
- `GET/POST/PATCH/DELETE /project/{project_name}/tasks*`
- `GET/POST/PATCH/DELETE /project/{project_name}/notes*`
- `GET/POST/PATCH/DELETE /project/{project_name}/memory*`
- `GET/POST /project/{project_name}/snapshots`
- `POST /project/{project_name}/snapshots/{snapshot_id}/restore`
- `GET /project/{project_name}/activity`
- `GET /project/{project_name}/audit`
- `GET/POST /project/{project_name}/approvals*`
- `GET/POST/PATCH/DELETE /project/{project_name}/tests*`
- `GET /project/{project_name}/runs`
- `GET /project/{project_name}/runs/{run_id}`

AI analysis and coagent:
- `POST /project/{project_name}/workspace/analyze`
- `POST /project/{project_name}/pair/review`
- `POST /project/{project_name}/pair/plan`
- `POST /project/{project_name}/pair/refactor-preview`
- `POST /project/{project_name}/cowork/instruction`
- `POST /project/{project_name}/research/deep-report`
- `POST /project/{project_name}/data/dashboard-summary`
- `POST /project/{project_name}/coagent/workspace-map`
- `POST /project/{project_name}/coagent/file-targets`
- `POST /project/{project_name}/coagent/why-failing`
- `POST /project/{project_name}/coagent/wiring-trace`
- `POST /project/{project_name}/coagent/cleanup-scan`
- `POST /project/{project_name}/coagent/api-contracts`
- `POST /project/{project_name}/coagent/project-state`
- `POST /project/{project_name}/coagent/run-command`
- `POST /project/{project_name}/coagent/coding-memory`

Command/terminal:
- `POST /project/{project_name}/command/run`
- `POST /project/{project_name}/command/stream`
- `WS /ws/terminal/{project_name}`
- `WS /ws/terminal/health`

Git:
- `/api/git/status`
- `/api/git/stage`
- `/api/git/unstage`
- `/api/git/commit`
- `/api/git/push`
- `/api/git/pull`
- `/api/git/branches`
- `/api/git/checkout`
- `/api/git/clone`
- `/api/git/init`
- `/api/git/set-remote`
- `GET /project/{project_name}/git/branch`

GitHub:
- `GET /api/github/auth/initiate`
- `GET /api/github/auth/callback`
- `GET /api/github/auth/status`
- `POST /api/github/auth/pat`
- `GET /api/github/auth/token`
- `POST /api/github/auth/repos/create`
- `GET /api/github/auth/config`
- project-level GitHub helpers under `/project/{project_name}/github/*`

Settings/models/secrets:
- `GET/POST /settings`
- `GET/POST /settings/provider`
- `POST /settings/provider/model`
- `GET /settings/providers`
- `GET/POST /models*`
- `GET /ollama/models`
- `GET/POST /groq/models*`
- `GET/POST/DELETE /secrets*`
- `POST /secrets/{key}/reveal`

Customization/tasks/artifacts APIs:
- `/api/customization/instructions*`
- `/api/customization/prompts*`
- `/api/customization/hooks*`
- `/api/customization/mcp_servers*`
- `/api/customization/plugins*`
- `/api/customization/agents*`
- `/api/customization/skills*`
- `/api/tasks*`
- `/api/artifacts*`

Ingest/documents/media/voice/web:
- `GET /supported-file-types`
- `POST /projects/import-existing`
- `POST /project/{project_name}/ingest/file`
- `POST /project/{project_name}/ingest/folder`
- `POST /project/{project_name}/ingest/zip`
- `GET /project/{project_name}/ingest/jobs*`
- `GET /project/{project_name}/documents*`
- `GET /project/{project_name}/documents/search`
- `POST /project/{project_name}/media/transcribe-file`
- `POST /project/{project_name}/media/transcribe-upload`
- `POST /project/{project_name}/voice/chat`
- `GET /voice/voices`
- `GET /voice/available`
- `POST /voice/download`
- `POST /voice/transcribe`
- `WS /ws/voice`
- `POST /project/{project_name}/web/fetch`
- `POST /project/{project_name}/web/search`

Other:
- `GET /roles`
- `GET /roles/{role}`
- `GET/POST /themes*`
- `GET/POST /slash/*`
- `GET/POST /history*`
- `GET /project/{project_name}/diagnostics`
- `POST /project/{project_name}/directory`
- `GET /project/{project_name}/search`
- `GET/POST /project/{project_name}/index/*`
- `POST /project/{project_name}/scaffold/app`

## Duplicate Route Watchlist

These method/path pairs appear in more than one module or are vulnerable to route
order deciding behavior:

- `POST /projects/import`
- `POST /project/{project_name}/workspace/analyze`
- `POST /project/{project_name}/pair/review`
- `POST /project/{project_name}/pair/plan`
- `POST /project/{project_name}/pair/refactor-preview`
- `POST /project/{project_name}/cowork/instruction`
- `POST /projects/{project_name}/source/link`
- `POST /project/{project_name}/source/link`
- `POST /project/{project_name}/media/transcribe-file`
- `POST /project/{project_name}/voice/chat`
- `POST /project/{project_name}/research/deep-report`
- `POST /project/{project_name}/data/dashboard-summary`
- `POST /project/{project_name}/scaffold/app`
- `GET /` appears in generated/example strings and `main.py`; runtime OpenAPI must
  be used to confirm the actual handler.

## Frontend Call Sites To Verify

Central service:
- `app/frontend/src/services/api.ts` covers most intended calls.
- Sprint 3 changed Git wrappers to resolve `/projects/{project_name}` and call
  `/api/git/*` with `project_path`.
- Sprint 3 changed shared request/stream helpers to await backend dynamic-port
  initialization before issuing `fetch`.

Raw fetches and direct callers:
- `HomePage.tsx`, `WelcomePage.tsx`, `NewProjectPage.tsx`, and `CodeModePage.tsx`
  now call `api.projects.importExisting(...)`.
- `GitHubAuthDialog.tsx` still calls `/api/github/auth/initiate`, `/status`, and
  `/pat` directly, but now waits for `getApiBaseAsync()`.
- `CloneRepositoryDialog.tsx` and `GitHub/CloneRepoDialog.tsx` call
  `/api/git/clone` directly and wait for `getApiBaseAsync()`.
- `SourceControlPanel.tsx` calls `/api/git/*` directly and waits for
  `getApiBaseAsync()`.
- `TasksPanel.tsx` calls `/api/tasks*` directly and waits for `getApiBaseAsync()`.
- `FileTree.tsx` and `EditorPanel.tsx` call project file endpoints directly and
  wait for `getApiBaseAsync()`.
- `Terminal.tsx` and `TerminalPanel.tsx` build websocket URLs directly.

Frontend contract risks:
- Direct raw fetches bypass shared response/error handling.
- Import route drift has a Sprint 3 contract test.
- Git panel wrappers have Sprint 3 contract tests for status and selected-file commit.
- Backend dynamic port race is reduced by awaiting shared initialization; packaged
  Electron E2E still needs to prove no startup call hits the fallback port.
- Some route scans mis-detect methods because method is inside fetch options; the
  contract suite must parse options, not just URL strings.

## Test Fixture Policy

- Use `_codex_harness` as the test project name prefix.
- Create real temporary project fixtures for routes that require a registered project.
- Use unregistered project names only for negative 404 tests.
- Mock or explicitly skip network-dependent integrations unless the user approves
  live network testing.
- Never use existing user projects as mutation targets.
- Clean up harness-created projects, memory, ingest records, and temp files after
  successful test runs.
