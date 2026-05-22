# CubOS Tests Log

> Every test that has been run, every result, every test we plan to run, every test to be rerun after each fix batch.
> Source of truth for harness coverage. Updated after every run.

---

## Test infrastructure

| Tool | File | Purpose | Coverage |
|---|---|---|---|
| Backend harness | `tools/run_full_test.py` | Spawns uvicorn on free port, hits every backend route via openapi spec + frontend-scanned paths + WS + multipart voice | 216 checks |
| Frontend E2E (planned) | `app/frontend/tests/e2e/` (T-2) | Playwright/CDP launches `win-unpacked\CubOS.exe`, scripts UI flows | TBD |
| Release gate (planned) | `tools/release_check.ps1` (T-3) | Runs backend harness + Playwright + vitest before electron-builder | gates installer |

---

## Run history

| Run | Date | Score | Required-fail | Notes |
|---|---|---|---|---|
| 1 (small) | 2026-05-11 | 26/28 | 2 | Initial 28-route harness; identified voice/WS gaps |
| 2 (exhaustive) | 2026-05-11 | 178/216 | 23 | Full openapi sweep; 22 false-positives from harness bug (per-call isolated client) |
| **3 (clean)** | **2026-05-11** | **198/216** | **1** | Harness fixed (shared warm client, frontend sweep before openapi); current source of truth |
| 4 (target) | TBD | 216/216 | 0 | After D7+D6+D1-PTY+D1-Voice+D8 |

---

## Run 3 — endpoint-by-endpoint results

### Group: core (6/6 PASS)

| # | Method | URL | Status | ms | Result |
|---|---|---|---|---|---|
| 1 | GET | `/` | 200 | 17.9 | PASS |
| 2 | GET | `/projects` | 200 | 8.5 | PASS |
| 3 | GET | `/settings` | 200 | 5.0 | PASS |
| 4 | GET | `/models` | 200 | 306.0 | PASS |
| 5 | GET | `/settings/providers` | 200 | 3.0 | PASS |
| 6 | GET | `/settings/provider` | 200 | 3.0 | PASS |

### Group: frontend_sweep (21/22 PASS)

| # | Method | URL | Status | Result |
|---|---|---|---|---|
| 1 | POST | `/api/git/clone` | 422 | PASS |
| 2 | POST | `/api/git/commit` | 400 | PASS |
| 3 | POST | `/api/git/pull` | 200 | PASS |
| 4 | POST | `/api/git/push` | 200 | PASS |
| 5 | POST | `/api/git/stage` | 400 | PASS |
| 6 | GET | `/api/git/status` | 422 | PASS |
| 7 | POST | `/api/git/unstage` | 400 | PASS |
| 8 | GET | `/api/github/auth/initiate` | 500 | **FAIL (F1)** |
| 9 | POST | `/api/github/auth/pat` | 401 | PASS |
| 10 | GET | `/api/github/auth/status` | 422 | PASS |
| 11 | GET | `/api/tasks` | 422 | PASS |
| 12 | GET | `/api/tasks/test` | 405 | PASS |
| 13 | POST | `/api/threads/test/cancel` | 200 | PASS |
| 14 | GET | `/project/test/directory` | 405 | PASS |
| 15 | GET | `/project/test/file` | 422 | PASS |
| 16 | GET | `/project/test/file/move` | 405 | PASS |
| 17 | GET | `/project/test/file/overwrite` | 405 | PASS |
| 18 | GET | `/project/test/file/write` | 405 | PASS |
| 19 | GET | `/project/test/files` | 200 | PASS |
| 20 | POST | `/project/test/media/transcribe-upload` | 422 | PASS |
| 21 | GET | `/projects` | 200 | PASS |
| 22 | POST | `/projects/import` | 422 | PASS |

### Group: openapi_sweep (171/185 PASS — 14 FAIL)

**All 185 backend routes** from `/openapi.json` were hit with stub inputs. PASS = response code ∈ {200, 400, 401, 403, 404, 405, 422} (correct validation or auth/not-found behavior). FAIL = 5xx or hang/timeout.

#### PASSING (171 routes, grouped)

**Activity / Audit / Approvals:**
- `GET /activity`, `GET /project/_harness/activity`, `GET /project/_harness/approvals`, `POST /project/_harness/approvals/test/approve` (404), `POST /project/_harness/approvals/test/reject` (404), `GET /project/_harness/audit`

**Agent / Chat:**
- `POST /agent/loop` (422), `POST /chat` (422), `GET /project/_harness/chat`, `GET /project/_harness/chat/summary`

**API customization (10 endpoints):**
- `GET/POST /api/customization/agents`, `hooks`, `instructions`, `mcp_servers`, `plugins`, `prompts`, `skills`; `PATCH /api/customization/hooks/test`, `plugins/test`; `DELETE /api/customization/instructions/test` — all 422

**API artifacts:**
- `GET /api/artifacts` (422), `POST /api/artifacts/test/apply` (422)

**Git (8 endpoints):**
- `GET /api/git/branches` (422), `POST /api/git/checkout` (422), `POST /api/git/clone` (422), `POST /api/git/commit` (400), `POST /api/git/init` (422), `POST /api/git/pull` (200), `POST /api/git/push` (200), `POST /api/git/set-remote` (422), `POST /api/git/stage` (400), `GET /api/git/status` (422), `POST /api/git/unstage` (400)
- `GET /project/_harness/git/branch` (200)

**GitHub (12 endpoints — 1 fails):**
- `GET /api/github/auth/callback` (422) PASS
- `POST /api/github/auth/pat` (401) PASS
- `POST /api/github/auth/repos/create` (422) PASS
- `GET /api/github/auth/status` (422) PASS
- `GET /api/github/auth/token` (422) PASS
- `GET /project/_harness/github/branches` (200), `POST /project/_harness/github/commit` (200), `POST /project/_harness/github/pull-request-draft` (422), `GET/POST /project/_harness/github/repo` (200/400), `GET /project/_harness/github/status` (200) — all PASS

**Threads (8 endpoints — 5 fail):**
- `GET /api/projects/_harness/threads` (200) PASS
- `POST /api/projects/_harness/threads` (200) PASS
- `POST /api/threads/1/cancel` (200) PASS
- `POST /api/threads/1/messages` (422) PASS
- `PUT /api/threads/1/title` (422) PASS

**Tasks (5 endpoints):**
- `GET/POST /api/tasks` (422), `PATCH /api/tasks/1` (422), `DELETE /api/tasks/1` (422)
- `GET /project/_harness/tasks` (200), `POST /project/_harness/tasks` (422), `PATCH/DELETE /project/_harness/tasks/1` (404)

**File operations (12 endpoints):**
- `POST /files/extract-absolute` (422)
- `GET /project/_harness/file` (422), `DELETE /project/_harness/file` (422), `POST /project/_harness/file/diff` (422), `POST /project/_harness/file/move` (400), `POST /project/_harness/file/overwrite` (422), `GET /project/_harness/file/range` (422), `POST /project/_harness/file/write` (422)
- `GET /project/_harness/files` (200), `POST /project/_harness/files/extract` (200), `GET /project/_harness/files/search` (422)

**Models / Settings (8 endpoints):**
- `GET /groq/models` (200), `POST /groq/models/active` (422)
- `GET /models` (200), `POST /models/active` (422)
- `GET /ollama/models` (200)
- `GET /settings` (200), `POST /settings` (422)
- `GET/POST /settings/provider` (200/422), `POST /settings/provider/model` (422), `GET /settings/providers` (200)

**Slash / History / Themes (8):**
- `GET /slash/commands` (200), `POST /slash/run` (200)
- `GET /history` (200), `POST /history` (200), `GET /history/search` (200)
- `GET /themes` (200), `POST /themes` (200), `GET /themes/active` (200), `POST /themes/active` (200)

**Coagent (8 — 3 fail):**
- `POST /project/_harness/coagent/cleanup-scan` (200) PASS
- `POST /project/_harness/coagent/coding-memory` (200) PASS
- `POST /project/_harness/coagent/file-targets` (422) PASS
- `POST /project/_harness/coagent/run-command` (422) PASS
- `POST /project/_harness/coagent/why-failing` (422) PASS
- `POST /project/_harness/coagent/wiring-trace` (422) PASS

**CLI / Command:**
- `POST /project/_harness/cli/explain-command` (422), `POST /project/_harness/cli/generate-command` (422), `POST /project/_harness/command/run` (422)

**Pair / Cowork / Workspace (failing — see FAIL section)**

**Data / Diagnostics / Directory:**
- `POST /project/_harness/data/dashboard-summary` (400), `GET /project/_harness/diagnostics` (200), `POST /project/_harness/directory` (400)

**Documents (6):**
- `GET /project/_harness/documents` (200), `GET /project/_harness/documents/search` (422), `GET /project/_harness/documents/test` (404), `GET /project/_harness/documents/test/content` (404), `POST /project/_harness/documents/test/summarize` (404), `GET /project/_harness/documents/test/tabular` (404)

**Index / Ingest (8):**
- `GET /project/_harness/index/status` (200), `POST /project/_harness/index/trigger` (200)
- `POST /project/_harness/ingest/file` (422), `POST /project/_harness/ingest/folder` (422), `GET /project/_harness/ingest/jobs` (200), `GET /project/_harness/ingest/jobs/test` (404), `POST /project/_harness/ingest/zip` (422)

**Media:**
- `POST /project/_harness/media/transcribe-file` (400), `POST /project/_harness/media/transcribe-upload` (422)

**Memory / Messages / Notes:**
- `GET/POST /project/_harness/memory` (200/422), `PATCH/DELETE /project/_harness/memory/test` (404)
- `GET/POST /project/_harness/messages` (200/422)
- `GET/POST /project/_harness/notes` (200/422), `PATCH/DELETE /project/_harness/notes/test` (404)

**Research / Refactor:**
- `POST /project/_harness/pair/refactor-preview` (400) PASS
- `POST /project/_harness/research/deep-report` (400) PASS

**Runs / Scaffold / Scope / Search:**
- `GET /project/_harness/runs` (200), `GET /project/_harness/runs/test` (404)
- `POST /project/_harness/scaffold/app` (200)
- `GET /project/_harness/scope` (200)
- `GET /project/_harness/search` (422)

**Snapshots:**
- `GET /project/_harness/snapshots` (200), `POST /project/_harness/snapshots` (200), `POST /project/_harness/snapshots/test/restore` (404)

**Source / Tests / Voice / Web:**
- `POST /project/_harness/source/link` (422)
- `GET /project/_harness/tests` (200), `POST /project/_harness/tests` (422), `PATCH/DELETE /project/_harness/tests/test` (404), `POST /project/_harness/tests/test/run` (404)
- `POST /project/_harness/voice/chat` (400)
- `POST /project/_harness/web/fetch` (422), `POST /project/_harness/web/search` (422)

**Projects (10):**
- `GET /projects` (200), `POST /projects/clone-git` (422), `POST /projects/create` (200), `POST /projects/import` (422), `POST /projects/import-existing` (422)
- `GET/PATCH/DELETE /projects/_harness` (all 404), `POST /projects/_harness/archive` (404), `POST /projects/_harness/source/link` (422)

**Roles / Secrets:**
- `GET /roles` (200), `GET /roles/architect` (200)
- `GET /secrets` (200), `POST /secrets/test` (200), `DELETE /secrets/test` (200), `POST /secrets/test/reveal` (404)

**Misc:**
- `GET /supported-file-types` (200)
- `GET /voice/voices` (200) — 4.8s (slow but pass)

#### FAILING (14 endpoints)

| # | Method | URL | Status | Latency | Root cause |
|---|---|---|---|---|---|
| 1 | GET | `/api/github/auth/initiate` | 500 | 1ms | F1 — env var missing |
| 2 | GET | `/api/threads/1` | 500 | 2ms | F2 — except swallows HTTPException |
| 3 | DELETE | `/api/threads/1` | 500 | 2.5ms | F2 |
| 4 | GET | `/api/threads/1/messages` | 500 | 3ms | F2 |
| 5 | GET | `/api/threads/1/messages/count` | 500 | 3ms | F2 |
| 6 | POST | `/project/_harness/chat/summary/refresh` | timeout | 6010ms | F3 — sync AI call |
| 7 | POST | `/project/_harness/coagent/api-contracts` | timeout | 6003ms | F3 |
| 8 | POST | `/project/_harness/coagent/project-state` | timeout | 6009ms | F3 |
| 9 | POST | `/project/_harness/coagent/workspace-map` | timeout | 6016ms | F3 |
| 10 | POST | `/project/_harness/cowork/instruction` | timeout | 6014ms | F3 |
| 11 | POST | `/project/_harness/pair/plan` | timeout | 6016ms | F3 |
| 12 | POST | `/project/_harness/pair/review` | timeout | 6010ms | F3 |
| 13 | POST | `/project/_harness/workspace/analyze` | timeout | 5989ms | F3 |
| 14 | GET | `/voice/available` | timeout | 6007ms | F7 — sync HF fetch |

### Group: voice (0/1)

| # | Method | URL | Status | Latency | Root cause |
|---|---|---|---|---|---|
| 1 | POST | `/voice/transcribe` (real silent WAV) | timeout | 15025ms | F4 — sig mismatch + sync whisper |

### Group: websocket (0/2 — 1 required-fail)

| # | URL | Status | Latency | Required | Root cause |
|---|---|---|---|---|---|
| 1 | `ws://.../ws/terminal/_harness` | handshake timeout | 5124ms | **YES** | F5 — no ready frame |
| 2 | `ws://.../ws/voice` | handshake timeout | 5005ms | no | F6 — no ready frame |

---

## Frontend API surface (regex-scanned, all hit in frontend_sweep)

Paths the frontend code references (`apiClient`, `fetch`, `apiUrl`, `axios`):

- `/api/git/*` (8) — clone, commit, pull, push, stage, status, unstage + branches/checkout/init/set-remote (via component)
- `/api/github/auth/*` (5) — initiate, pat, status, callback, repos/create
- `/api/tasks` (CRUD)
- `/api/threads/{id}/cancel` (1) — other threads endpoints via thread_routes (but frontend uses `/api/projects/{name}/threads` for create)
- `/api/projects/{name}/threads` (2)
- `/project/{name}/directory`, `/file*`, `/files`, `/media/transcribe-upload`
- `/projects`, `/projects/import`

All paths declared in component files (`GitHubAuthDialog.tsx`, `TasksPanel.tsx`, `ChatInput.tsx`, etc.) covered.

---

## Test categories planned for run 4 (post-fix)

After all batches land, the same 216 checks rerun. **New rows to be added to harness** (regression tests for the fixes):

| Test ID | Endpoint | Expected | Validates |
|---|---|---|---|
| R-F1-a | `GET /api/github/auth/initiate` (env unset) | 503, body has `configured:false` | D6 fix |
| R-F1-b | `GET /api/github/auth/config` | 200, body has `configured` key | D6 new endpoint |
| R-F2-a | `GET /api/threads/1` (bad ID) | 400 | D7 fix |
| R-F2-b | `GET /api/threads/abc_nope` (well-formed but missing) | 404 | D7 |
| R-F3-a | `POST /project/_harness/workspace/analyze` (stub) | 404 | D8 guard |
| R-F3-b | `POST /project/{real}/workspace/analyze` (Ollama up) | 200 ≤30s | D8 happy path |
| R-F3-c | `POST /project/{real}/workspace/analyze` (Ollama mocked down) | 504 ≤16s | D8 timeout |
| R-F4-a | `POST /voice/transcribe` (silent WAV) | 200 with `text` key | D1-Voice sig fix |
| R-F4-b | `POST /voice/transcribe` (silent WebM) | 200 with `text` key | D1-Voice ffmpeg pipeline |
| R-F5-a | `WS /ws/terminal/{p}` | ready frame ≤2s | D1-PTY |
| R-F5-b | `WS /ws/terminal/{p}` echo | `hi` returned ≤3s | D1-PTY |
| R-F5-c | `WS /ws/terminal/health` | ready+echo ≤1s | D1-PTY new route |
| R-F6-a | `WS /ws/voice` | ready frame ≤2s | D1-Voice |
| R-F7-a | `GET /voice/available` (warm cache) | 200 ≤2s | D1-Voice |
| R-F7-b | `GET /voice/available?refresh=true` | 200 (slower OK) | D1-Voice cache bust |

---

## Tests still pending (need Playwright T-2)

These cannot be auto-tested by the backend harness — they require driving the packaged UI:

| ID | Flow | Validates |
|---|---|---|
| UI-1 | Boot app, no CMD flashes | D1-1 |
| UI-2 | Open terminal, type `echo hi`, see `hi` | D1-2 in UI |
| UI-3 | Run Python `print('x')`, see `x` in output panel | D1-3, D1-8 |
| UI-4 | Save API key in Settings, reload, key shown masked | D1-4 |
| UI-5 | Switch provider Anthropic→Groq, chat reports Groq | D1-5, D2-1 |
| UI-6 | Record audio (mock blob), transcript returned | D1-6, D1-9 |
| UI-7 | Open Self-Upgrade, see backend Python files (not Electron cache) | D1-7, D5-1 |
| UI-8 | Resize Code Mode panels, reload, sizes persist | D3-1 |
| UI-9 | Create 3 projects, all listed on Home | D4-3 |
| UI-10 | Switch projects, chat history isolated | D4-4 |
| UI-11 | GitHub OAuth flow with mock callback | D6-1 |
| UI-12 | PAT field editable without project | D6-2 |
| UI-13 | Git push w/o remote → friendly error | D6-3 |
| UI-14 | Clone `octocat/Hello-World`, project registered | D4-2 |
| UI-15 | Provider dropdown matches `/settings/providers` exactly | D2-3 |

---

## Tests outside scope (manual only)

- Installer signing
- Auto-update flow
- Network failure handling during long downloads
- Multi-monitor / DPI scaling

---

## Maintenance

After every batch:
1. Append a "Run N" section to this file with full pass/fail counts.
2. Update the "Run history" table at the top.
3. Mark fix items in `FIX_PLAN.md` `[x]` only if their harness rows are PASS in this log.
