# CubOS Test Report

Generated: 2026-05-11T13:08:39.028469

**Total checks:** 216  ·  **Passed:** 198  ·  **Failed:** 18  ·  **Required-failed:** 1

## Summary by group

| Group | Total | Pass | Fail | Required-fail |
|---|---|---|---|---|
| core | 6 | 6 | 0 | 0 |
| frontend_sweep | 22 | 21 | 1 | 0 |
| openapi_sweep | 185 | 171 | 14 | 0 |
| voice | 1 | 0 | 1 | 0 |
| websocket | 2 | 0 | 2 | 1 |

## Group: core

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/` | 200 | 17.9 | PASS | yes |  |
| 2 | GET | `/projects` | 200 | 8.5 | PASS | yes |  |
| 3 | GET | `/settings` | 200 | 5.0 | PASS | yes |  |
| 4 | GET | `/models` | 200 | 306.0 | PASS | yes |  |
| 5 | GET | `/settings/providers` | 200 | 3.0 | PASS | yes |  |
| 6 | GET | `/settings/provider` | 200 | 3.0 | PASS | yes |  |

## Group: frontend_sweep

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/git/clone` | 422 | 3.0 | PASS | no |  |
| 2 | POST | `/api/git/commit` | 400 | 145.5 | PASS | no |  |
| 3 | POST | `/api/git/pull` | 200 | 492.3 | PASS | no |  |
| 4 | POST | `/api/git/push` | 200 | 1259.4 | PASS | no |  |
| 5 | POST | `/api/git/stage` | 400 | 45.6 | PASS | no |  |
| 6 | GET | `/api/git/status` | 422 | 2.5 | PASS | no |  |
| 7 | POST | `/api/git/unstage` | 400 | 48.4 | PASS | no |  |
| 8 | GET | `/api/github/auth/initiate` | 500 | 2.6 | FAIL | no | server error (app\frontend\src\components\GitHub\GitHubAuthDialog.tsx) |
| 9 | POST | `/api/github/auth/pat` | 401 | 380.4 | PASS | no |  |
| 10 | GET | `/api/github/auth/status` | 422 | 2.0 | PASS | no |  |
| 11 | GET | `/api/tasks` | 422 | 3.0 | PASS | no |  |
| 12 | GET | `/api/tasks/test` | 405 | 2.0 | PASS | no |  |
| 13 | POST | `/api/threads/test/cancel` | 200 | 3.5 | PASS | no |  |
| 14 | GET | `/project/test/directory` | 405 | 2.0 | PASS | no |  |
| 15 | GET | `/project/test/file` | 422 | 3.0 | PASS | no |  |
| 16 | GET | `/project/test/file/move` | 405 | 1.0 | PASS | no |  |
| 17 | GET | `/project/test/file/overwrite` | 405 | 2.5 | PASS | no |  |
| 18 | GET | `/project/test/file/write` | 405 | 2.0 | PASS | no |  |
| 19 | GET | `/project/test/files` | 200 | 15.5 | PASS | no |  |
| 20 | POST | `/project/test/media/transcribe-upload` | 422 | 4.5 | PASS | no |  |
| 21 | GET | `/projects` | 200 | 8.2 | PASS | no |  |
| 22 | POST | `/projects/import` | 422 | 3.0 | PASS | no |  |

## Group: openapi_sweep

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/` | 200 | 1.5 | PASS | no |  |
| 2 | GET | `/activity` | 200 | 15.5 | PASS | no |  |
| 3 | POST | `/agent/loop` | 422 | 3.0 | PASS | no |  |
| 4 | GET | `/api/artifacts` | 422 | 1.5 | PASS | no |  |
| 5 | POST | `/api/artifacts/test/apply` | 422 | 3.0 | PASS | no |  |
| 6 | GET | `/api/customization/agents` | 422 | 2.0 | PASS | no |  |
| 7 | POST | `/api/customization/agents` | 422 | 2.5 | PASS | no |  |
| 8 | GET | `/api/customization/hooks` | 422 | 1.0 | PASS | no |  |
| 9 | POST | `/api/customization/hooks` | 422 | 3.6 | PASS | no |  |
| 10 | PATCH | `/api/customization/hooks/test` | 422 | 3.0 | PASS | no |  |
| 11 | GET | `/api/customization/instructions` | 422 | 2.0 | PASS | no |  |
| 12 | POST | `/api/customization/instructions` | 422 | 3.0 | PASS | no |  |
| 13 | DELETE | `/api/customization/instructions/test` | 422 | 2.2 | PASS | no |  |
| 14 | GET | `/api/customization/mcp_servers` | 422 | 2.0 | PASS | no |  |
| 15 | POST | `/api/customization/mcp_servers` | 422 | 3.0 | PASS | no |  |
| 16 | GET | `/api/customization/plugins` | 422 | 1.0 | PASS | no |  |
| 17 | POST | `/api/customization/plugins` | 422 | 3.5 | PASS | no |  |
| 18 | PATCH | `/api/customization/plugins/test` | 422 | 1.0 | PASS | no |  |
| 19 | GET | `/api/customization/prompts` | 422 | 2.0 | PASS | no |  |
| 20 | POST | `/api/customization/prompts` | 422 | 2.0 | PASS | no |  |
| 21 | GET | `/api/customization/skills` | 422 | 2.5 | PASS | no |  |
| 22 | POST | `/api/customization/skills` | 422 | 3.0 | PASS | no |  |
| 23 | GET | `/api/git/branches` | 422 | 2.0 | PASS | no |  |
| 24 | POST | `/api/git/checkout` | 422 | 1.0 | PASS | no |  |
| 25 | POST | `/api/git/clone` | 422 | 1.5 | PASS | no |  |
| 26 | POST | `/api/git/commit` | 400 | 122.2 | PASS | no |  |
| 27 | POST | `/api/git/init` | 422 | 3.0 | PASS | no |  |
| 28 | POST | `/api/git/pull` | 200 | 367.3 | PASS | no |  |
| 29 | POST | `/api/git/push` | 200 | 1093.6 | PASS | no |  |
| 30 | POST | `/api/git/set-remote` | 422 | 3.0 | PASS | no |  |
| 31 | POST | `/api/git/stage` | 400 | 58.4 | PASS | no |  |
| 32 | GET | `/api/git/status` | 422 | 1.0 | PASS | no |  |
| 33 | POST | `/api/git/unstage` | 400 | 59.7 | PASS | no |  |
| 34 | GET | `/api/github/auth/callback` | 422 | 3.5 | PASS | no |  |
| 35 | GET | `/api/github/auth/initiate` | 500 | 1.0 | FAIL | no | 5xx server error |
| 36 | POST | `/api/github/auth/pat` | 401 | 390.3 | PASS | no |  |
| 37 | POST | `/api/github/auth/repos/create` | 422 | 4.0 | PASS | no |  |
| 38 | GET | `/api/github/auth/status` | 422 | 2.5 | PASS | no |  |
| 39 | GET | `/api/github/auth/token` | 422 | 3.0 | PASS | no |  |
| 40 | GET | `/api/projects/_harness/threads` | 200 | 21.0 | PASS | no |  |
| 41 | POST | `/api/projects/_harness/threads` | 200 | 21.8 | PASS | no |  |
| 42 | GET | `/api/tasks` | 422 | 1.0 | PASS | no |  |
| 43 | POST | `/api/tasks` | 422 | 3.4 | PASS | no |  |
| 44 | PATCH | `/api/tasks/1` | 422 | 2.0 | PASS | no |  |
| 45 | DELETE | `/api/tasks/1` | 422 | 1.0 | PASS | no |  |
| 46 | GET | `/api/threads/1` | 500 | 2.0 | FAIL | no | 5xx server error |
| 47 | DELETE | `/api/threads/1` | 500 | 2.5 | FAIL | no | 5xx server error |
| 48 | POST | `/api/threads/1/cancel` | 200 | 2.0 | PASS | no |  |
| 49 | GET | `/api/threads/1/messages` | 500 | 3.0 | FAIL | no | 5xx server error |
| 50 | POST | `/api/threads/1/messages` | 422 | 3.5 | PASS | no |  |
| 51 | GET | `/api/threads/1/messages/count` | 500 | 3.0 | FAIL | no | 5xx server error |
| 52 | PUT | `/api/threads/1/title` | 422 | 2.0 | PASS | no |  |
| 53 | POST | `/chat` | 422 | 2.0 | PASS | no |  |
| 54 | POST | `/files/extract-absolute` | 422 | 3.0 | PASS | no |  |
| 55 | GET | `/groq/models` | 200 | 3.0 | PASS | no |  |
| 56 | POST | `/groq/models/active` | 422 | 3.5 | PASS | no |  |
| 57 | GET | `/history` | 200 | 14.4 | PASS | no |  |
| 58 | POST | `/history` | 200 | 8.5 | PASS | no |  |
| 59 | GET | `/history/search` | 200 | 7.5 | PASS | no |  |
| 60 | GET | `/models` | 200 | 303.5 | PASS | no |  |
| 61 | POST | `/models/active` | 422 | 3.0 | PASS | no |  |
| 62 | GET | `/ollama/models` | 200 | 13.5 | PASS | no |  |
| 63 | GET | `/project/_harness/activity` | 200 | 20.6 | PASS | no |  |
| 64 | GET | `/project/_harness/approvals` | 200 | 7.0 | PASS | no |  |
| 65 | POST | `/project/_harness/approvals/test/approve` | 404 | 7.5 | PASS | no |  |
| 66 | POST | `/project/_harness/approvals/test/reject` | 404 | 5.5 | PASS | no |  |
| 67 | GET | `/project/_harness/audit` | 200 | 4.0 | PASS | no |  |
| 68 | GET | `/project/_harness/chat` | 200 | 6.5 | PASS | no |  |
| 69 | GET | `/project/_harness/chat/summary` | 200 | 6.0 | PASS | no |  |
| 70 | POST | `/project/_harness/chat/summary/refresh` | 0 | 6010.8 | FAIL | no |  |
| 71 | POST | `/project/_harness/cli/explain-command` | 422 | 6.5 | PASS | no |  |
| 72 | POST | `/project/_harness/cli/generate-command` | 422 | 3.0 | PASS | no |  |
| 73 | POST | `/project/_harness/coagent/api-contracts` | 0 | 6003.5 | FAIL | no |  |
| 74 | POST | `/project/_harness/coagent/cleanup-scan` | 200 | 33.0 | PASS | no |  |
| 75 | POST | `/project/_harness/coagent/coding-memory` | 200 | 5.4 | PASS | no |  |
| 76 | POST | `/project/_harness/coagent/file-targets` | 422 | 183.1 | PASS | no |  |
| 77 | POST | `/project/_harness/coagent/project-state` | 0 | 6009.5 | FAIL | no |  |
| 78 | POST | `/project/_harness/coagent/run-command` | 422 | 5.5 | PASS | no |  |
| 79 | POST | `/project/_harness/coagent/why-failing` | 422 | 5.0 | PASS | no |  |
| 80 | POST | `/project/_harness/coagent/wiring-trace` | 422 | 5.0 | PASS | no |  |
| 81 | POST | `/project/_harness/coagent/workspace-map` | 0 | 6016.0 | FAIL | no |  |
| 82 | POST | `/project/_harness/command/run` | 422 | 6.5 | PASS | no |  |
| 83 | POST | `/project/_harness/cowork/instruction` | 0 | 6014.8 | FAIL | no |  |
| 84 | POST | `/project/_harness/data/dashboard-summary` | 400 | 7.5 | PASS | no |  |
| 85 | GET | `/project/_harness/diagnostics` | 200 | 18.6 | PASS | no |  |
| 86 | POST | `/project/_harness/directory` | 400 | 3.5 | PASS | no |  |
| 87 | GET | `/project/_harness/documents` | 200 | 11.5 | PASS | no |  |
| 88 | GET | `/project/_harness/documents/search` | 422 | 5.0 | PASS | no |  |
| 89 | GET | `/project/_harness/documents/test` | 404 | 10.5 | PASS | no |  |
| 90 | GET | `/project/_harness/documents/test/content` | 404 | 11.5 | PASS | no |  |
| 91 | POST | `/project/_harness/documents/test/summarize` | 404 | 11.0 | PASS | no |  |
| 92 | GET | `/project/_harness/documents/test/tabular` | 404 | 9.0 | PASS | no |  |
| 93 | GET | `/project/_harness/file` | 422 | 5.5 | PASS | no |  |
| 94 | DELETE | `/project/_harness/file` | 422 | 3.0 | PASS | no |  |
| 95 | POST | `/project/_harness/file/diff` | 422 | 4.5 | PASS | no |  |
| 96 | POST | `/project/_harness/file/move` | 400 | 5.0 | PASS | no |  |
| 97 | POST | `/project/_harness/file/overwrite` | 422 | 3.5 | PASS | no |  |
| 98 | GET | `/project/_harness/file/range` | 422 | 5.0 | PASS | no |  |
| 99 | POST | `/project/_harness/file/write` | 422 | 4.5 | PASS | no |  |
| 100 | GET | `/project/_harness/files` | 200 | 28.1 | PASS | no |  |
| 101 | POST | `/project/_harness/files/extract` | 200 | 112.1 | PASS | no |  |
| 102 | GET | `/project/_harness/files/search` | 422 | 4.0 | PASS | no |  |
| 103 | GET | `/project/_harness/git/branch` | 200 | 151.9 | PASS | no |  |
| 104 | GET | `/project/_harness/github/branches` | 200 | 130.9 | PASS | no |  |
| 105 | POST | `/project/_harness/github/commit` | 200 | 625.4 | PASS | no |  |
| 106 | POST | `/project/_harness/github/pull-request-draft` | 422 | 4.0 | PASS | no |  |
| 107 | GET | `/project/_harness/github/repo` | 200 | 7.5 | PASS | no |  |
| 108 | POST | `/project/_harness/github/repo` | 400 | 8.5 | PASS | no |  |
| 109 | GET | `/project/_harness/github/status` | 200 | 132.9 | PASS | no |  |
| 110 | GET | `/project/_harness/index/status` | 200 | 7.5 | PASS | no |  |
| 111 | POST | `/project/_harness/index/trigger` | 200 | 5.0 | PASS | no |  |
| 112 | POST | `/project/_harness/ingest/file` | 422 | 4.5 | PASS | no |  |
| 113 | POST | `/project/_harness/ingest/folder` | 422 | 4.0 | PASS | no |  |
| 114 | GET | `/project/_harness/ingest/jobs` | 200 | 8.5 | PASS | no |  |
| 115 | GET | `/project/_harness/ingest/jobs/test` | 404 | 9.0 | PASS | no |  |
| 116 | POST | `/project/_harness/ingest/zip` | 422 | 4.5 | PASS | no |  |
| 117 | POST | `/project/_harness/media/transcribe-file` | 400 | 7.5 | PASS | no |  |
| 118 | POST | `/project/_harness/media/transcribe-upload` | 422 | 4.0 | PASS | no |  |
| 119 | GET | `/project/_harness/memory` | 200 | 8.5 | PASS | no |  |
| 120 | POST | `/project/_harness/memory` | 422 | 4.0 | PASS | no |  |
| 121 | PATCH | `/project/_harness/memory/test` | 404 | 11.4 | PASS | no |  |
| 122 | DELETE | `/project/_harness/memory/test` | 404 | 11.5 | PASS | no |  |
| 123 | GET | `/project/_harness/messages` | 200 | 7.5 | PASS | no |  |
| 124 | POST | `/project/_harness/messages` | 422 | 4.0 | PASS | no |  |
| 125 | GET | `/project/_harness/notes` | 200 | 7.5 | PASS | no |  |
| 126 | POST | `/project/_harness/notes` | 422 | 4.0 | PASS | no |  |
| 127 | PATCH | `/project/_harness/notes/test` | 404 | 13.9 | PASS | no |  |
| 128 | DELETE | `/project/_harness/notes/test` | 404 | 9.0 | PASS | no |  |
| 129 | POST | `/project/_harness/pair/plan` | 0 | 6016.2 | FAIL | no |  |
| 130 | POST | `/project/_harness/pair/refactor-preview` | 400 | 10.5 | PASS | no |  |
| 131 | POST | `/project/_harness/pair/review` | 0 | 6010.3 | FAIL | no |  |
| 132 | POST | `/project/_harness/research/deep-report` | 400 | 7.5 | PASS | no |  |
| 133 | GET | `/project/_harness/runs` | 200 | 8.5 | PASS | no |  |
| 134 | GET | `/project/_harness/runs/test` | 404 | 3.0 | PASS | no |  |
| 135 | POST | `/project/_harness/scaffold/app` | 200 | 26.6 | PASS | no |  |
| 136 | GET | `/project/_harness/scope` | 200 | 11.5 | PASS | no |  |
| 137 | GET | `/project/_harness/search` | 422 | 4.0 | PASS | no |  |
| 138 | GET | `/project/_harness/snapshots` | 200 | 12.2 | PASS | no |  |
| 139 | POST | `/project/_harness/snapshots` | 200 | 169.5 | PASS | no |  |
| 140 | POST | `/project/_harness/snapshots/test/restore` | 404 | 33.1 | PASS | no |  |
| 141 | POST | `/project/_harness/source/link` | 422 | 4.0 | PASS | no |  |
| 142 | GET | `/project/_harness/tasks` | 200 | 9.5 | PASS | no |  |
| 143 | POST | `/project/_harness/tasks` | 422 | 3.5 | PASS | no |  |
| 144 | PATCH | `/project/_harness/tasks/1` | 404 | 9.5 | PASS | no |  |
| 145 | DELETE | `/project/_harness/tasks/1` | 404 | 9.5 | PASS | no |  |
| 146 | GET | `/project/_harness/tests` | 200 | 11.4 | PASS | no |  |
| 147 | POST | `/project/_harness/tests` | 422 | 6.5 | PASS | no |  |
| 148 | PATCH | `/project/_harness/tests/test` | 404 | 8.0 | PASS | no |  |
| 149 | DELETE | `/project/_harness/tests/test` | 404 | 9.5 | PASS | no |  |
| 150 | POST | `/project/_harness/tests/test/run` | 404 | 11.5 | PASS | no |  |
| 151 | POST | `/project/_harness/voice/chat` | 400 | 4.5 | PASS | no |  |
| 152 | POST | `/project/_harness/web/fetch` | 422 | 4.5 | PASS | no |  |
| 153 | POST | `/project/_harness/web/search` | 422 | 4.5 | PASS | no |  |
| 154 | POST | `/project/_harness/workspace/analyze` | 0 | 5989.6 | FAIL | no |  |
| 155 | GET | `/projects` | 200 | 9.5 | PASS | no |  |
| 156 | POST | `/projects/clone-git` | 422 | 3.5 | PASS | no |  |
| 157 | POST | `/projects/create` | 200 | 272.4 | PASS | no |  |
| 158 | POST | `/projects/import` | 422 | 2.6 | PASS | no |  |
| 159 | POST | `/projects/import-existing` | 422 | 2.0 | PASS | no |  |
| 160 | GET | `/projects/_harness` | 404 | 20.0 | PASS | no |  |
| 161 | PATCH | `/projects/_harness` | 404 | 8.0 | PASS | no |  |
| 162 | DELETE | `/projects/_harness` | 404 | 7.0 | PASS | no |  |
| 163 | POST | `/projects/_harness/archive` | 404 | 7.5 | PASS | no |  |
| 164 | POST | `/projects/_harness/source/link` | 422 | 1.0 | PASS | no |  |
| 165 | GET | `/roles` | 200 | 12.0 | PASS | no |  |
| 166 | GET | `/roles/architect` | 200 | 3.0 | PASS | no |  |
| 167 | GET | `/secrets` | 200 | 4.0 | PASS | no |  |
| 168 | POST | `/secrets/test` | 200 | 3.0 | PASS | no |  |
| 169 | DELETE | `/secrets/test` | 200 | 6.0 | PASS | no |  |
| 170 | POST | `/secrets/test/reveal` | 404 | 2.0 | PASS | no |  |
| 171 | GET | `/settings` | 200 | 4.5 | PASS | no |  |
| 172 | POST | `/settings` | 422 | 2.0 | PASS | no |  |
| 173 | GET | `/settings/provider` | 200 | 5.0 | PASS | no |  |
| 174 | POST | `/settings/provider` | 422 | 1.5 | PASS | no |  |
| 175 | POST | `/settings/provider/model` | 422 | 3.0 | PASS | no |  |
| 176 | GET | `/settings/providers` | 200 | 3.0 | PASS | no |  |
| 177 | GET | `/slash/commands` | 200 | 20.1 | PASS | no |  |
| 178 | POST | `/slash/run` | 200 | 3.5 | PASS | no |  |
| 179 | GET | `/supported-file-types` | 200 | 2.0 | PASS | no |  |
| 180 | GET | `/themes` | 200 | 14.1 | PASS | no |  |
| 181 | POST | `/themes` | 200 | 5.5 | PASS | no |  |
| 182 | GET | `/themes/active` | 200 | 8.5 | PASS | no |  |
| 183 | POST | `/themes/active` | 200 | 6.0 | PASS | no |  |
| 184 | GET | `/voice/available` | 0 | 6007.7 | FAIL | no |  |
| 185 | GET | `/voice/voices` | 200 | 4780.1 | PASS | no |  |

## Group: voice

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/voice/transcribe` | 0 | 15025.8 | FAIL | no |  |

## Group: websocket

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | WS | `ws://127.0.0.1:60244/ws/terminal/_harness` | 0 | 5124.2 | FAIL | yes | timed out during opening handshake |
| 2 | WS | `ws://127.0.0.1:60244/ws/voice` | 0 | 5005.0 | FAIL | no | timed out during opening handshake |

## Failures

### [frontend_sweep] GET /api/github/auth/initiate
- status: `500` · latency: `2.6ms` · required: `False`
- note: server error (app\frontend\src\components\GitHub\GitHubAuthDialog.tsx)
- body: `{"detail": "GitHub OAuth not configured"}`

### [openapi_sweep] GET /api/github/auth/initiate
- status: `500` · latency: `1.0ms` · required: `False`
- note: 5xx server error
- body: `{"detail": "GitHub OAuth not configured"}`

### [openapi_sweep] GET /api/threads/1
- status: `500` · latency: `2.0ms` · required: `False`
- note: 5xx server error
- body: `{"detail": "400: Invalid thread ID format"}`

### [openapi_sweep] DELETE /api/threads/1
- status: `500` · latency: `2.5ms` · required: `False`
- note: 5xx server error
- body: `{"detail": "400: Invalid thread ID format"}`

### [openapi_sweep] GET /api/threads/1/messages
- status: `500` · latency: `3.0ms` · required: `False`
- note: 5xx server error
- body: `{"detail": "400: Invalid thread ID format"}`

### [openapi_sweep] GET /api/threads/1/messages/count
- status: `500` · latency: `3.0ms` · required: `False`
- note: 5xx server error
- body: `{"detail": "400: Invalid thread ID format"}`

### [openapi_sweep] POST /project/_harness/chat/summary/refresh
- status: `0` · latency: `6010.8ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/coagent/api-contracts
- status: `0` · latency: `6003.5ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/coagent/project-state
- status: `0` · latency: `6009.5ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/coagent/workspace-map
- status: `0` · latency: `6016.0ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/cowork/instruction
- status: `0` · latency: `6014.8ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/pair/plan
- status: `0` · latency: `6016.2ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/pair/review
- status: `0` · latency: `6010.3ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] POST /project/_harness/workspace/analyze
- status: `0` · latency: `5989.6ms` · required: `False`
- note: 
- body: ``

### [openapi_sweep] GET /voice/available
- status: `0` · latency: `6007.7ms` · required: `False`
- note: 
- body: ``

### [voice] POST /voice/transcribe
- status: `0` · latency: `15025.8ms` · required: `False`
- note: 
- body: ``

### [websocket] WS ws://127.0.0.1:60244/ws/terminal/_harness
- status: `0` · latency: `5124.2ms` · required: `True`
- note: timed out during opening handshake
- body: ``

### [websocket] WS ws://127.0.0.1:60244/ws/voice
- status: `0` · latency: `5005.0ms` · required: `False`
- note: timed out during opening handshake
- body: ``
