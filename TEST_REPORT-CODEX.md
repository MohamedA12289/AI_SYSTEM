# CubOS Codex Test Report

Generated: 2026-05-22T12:04:45.108672

**Total checks:** 216  ·  **Passed:** 216  ·  **Failed:** 0  ·  **Required-failed:** 0

## Summary by group

| Group | Total | Pass | Fail | Required-fail |
|---|---|---|---|---|
| core | 6 | 6 | 0 | 0 |
| frontend_sweep | 20 | 20 | 0 | 0 |
| openapi_sweep | 187 | 187 | 0 | 0 |
| voice | 1 | 1 | 0 | 0 |
| websocket | 2 | 2 | 0 | 0 |

## Group: core

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/` | 200 | 8.5 | PASS | yes |  |
| 2 | GET | `/projects` | 200 | 16.0 | PASS | yes |  |
| 3 | GET | `/settings` | 200 | 0.0 | PASS | yes |  |
| 4 | GET | `/models` | 200 | 191.8 | PASS | yes |  |
| 5 | GET | `/settings/providers` | 200 | 0.0 | PASS | yes |  |
| 6 | GET | `/settings/provider` | 200 | 0.0 | PASS | yes |  |

## Group: frontend_sweep

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/git/clone` | 422 | 0.0 | PASS | no |  |
| 2 | POST | `/api/git/commit` | 400 | 129.8 | PASS | no |  |
| 3 | POST | `/api/git/pull` | 200 | 306.1 | PASS | no |  |
| 4 | POST | `/api/git/push` | 200 | 1548.0 | PASS | no |  |
| 5 | POST | `/api/git/stage` | 400 | 33.2 | PASS | no |  |
| 6 | GET | `/api/git/status` | 422 | 8.4 | PASS | no |  |
| 7 | POST | `/api/git/unstage` | 400 | 33.2 | PASS | no |  |
| 8 | GET | `/api/github/auth/initiate` | 503 | 0.0 | PASS | no |  |
| 9 | POST | `/api/github/auth/pat` | 401 | 284.4 | PASS | no |  |
| 10 | GET | `/api/github/auth/status` | 422 | 0.0 | PASS | no |  |
| 11 | GET | `/api/tasks` | 422 | 0.0 | PASS | no |  |
| 12 | GET | `/api/tasks/test` | 405 | 6.6 | PASS | no |  |
| 13 | POST | `/api/threads/test/cancel` | 200 | 0.9 | PASS | no |  |
| 14 | GET | `/project/test/directory` | 405 | 0.0 | PASS | no |  |
| 15 | GET | `/project/test/file` | 422 | 0.0 | PASS | no |  |
| 16 | GET | `/project/test/file/move` | 405 | 0.0 | PASS | no |  |
| 17 | GET | `/project/test/file/overwrite` | 405 | 0.0 | PASS | no |  |
| 18 | GET | `/project/test/file/write` | 405 | 0.0 | PASS | no |  |
| 19 | GET | `/project/test/files` | 200 | 33.2 | PASS | no |  |
| 20 | POST | `/project/test/media/transcribe-upload` | 422 | 0.0 | PASS | no |  |

## Group: openapi_sweep

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/` | 200 | 0.0 | PASS | no |  |
| 2 | GET | `/activity` | 200 | 13.4 | PASS | no |  |
| 3 | POST | `/agent/loop` | 422 | 1.1 | PASS | no |  |
| 4 | GET | `/api/artifacts` | 422 | 0.0 | PASS | no |  |
| 5 | POST | `/api/artifacts/test/apply` | 422 | 0.0 | PASS | no |  |
| 6 | GET | `/api/customization/agents` | 422 | 0.0 | PASS | no |  |
| 7 | POST | `/api/customization/agents` | 422 | 8.1 | PASS | no |  |
| 8 | GET | `/api/customization/hooks` | 422 | 0.0 | PASS | no |  |
| 9 | POST | `/api/customization/hooks` | 422 | 0.0 | PASS | no |  |
| 10 | PATCH | `/api/customization/hooks/test` | 422 | 0.0 | PASS | no |  |
| 11 | GET | `/api/customization/instructions` | 422 | 0.0 | PASS | no |  |
| 12 | POST | `/api/customization/instructions` | 422 | 0.0 | PASS | no |  |
| 13 | DELETE | `/api/customization/instructions/test` | 422 | 7.5 | PASS | no |  |
| 14 | GET | `/api/customization/mcp_servers` | 422 | 0.4 | PASS | no |  |
| 15 | POST | `/api/customization/mcp_servers` | 422 | 0.0 | PASS | no |  |
| 16 | GET | `/api/customization/plugins` | 422 | 0.0 | PASS | no |  |
| 17 | POST | `/api/customization/plugins` | 422 | 0.0 | PASS | no |  |
| 18 | PATCH | `/api/customization/plugins/test` | 422 | 0.0 | PASS | no |  |
| 19 | GET | `/api/customization/prompts` | 422 | 0.0 | PASS | no |  |
| 20 | POST | `/api/customization/prompts` | 422 | 8.9 | PASS | no |  |
| 21 | GET | `/api/customization/skills` | 422 | 0.0 | PASS | no |  |
| 22 | POST | `/api/customization/skills` | 422 | 0.0 | PASS | no |  |
| 23 | GET | `/api/git/branches` | 422 | 0.0 | PASS | no |  |
| 24 | POST | `/api/git/checkout` | 422 | 0.0 | PASS | no |  |
| 25 | POST | `/api/git/clone` | 422 | 0.0 | PASS | no |  |
| 26 | POST | `/api/git/commit` | 400 | 107.9 | PASS | no |  |
| 27 | POST | `/api/git/init` | 422 | 7.8 | PASS | no |  |
| 28 | POST | `/api/git/pull` | 200 | 284.2 | PASS | no |  |
| 29 | POST | `/api/git/push` | 200 | 808.1 | PASS | no |  |
| 30 | POST | `/api/git/set-remote` | 422 | 8.3 | PASS | no |  |
| 31 | POST | `/api/git/stage` | 400 | 41.9 | PASS | no |  |
| 32 | GET | `/api/git/status` | 422 | 0.0 | PASS | no |  |
| 33 | POST | `/api/git/unstage` | 400 | 53.6 | PASS | no |  |
| 34 | GET | `/api/github/auth/callback` | 422 | 0.0 | PASS | no |  |
| 35 | GET | `/api/github/auth/config` | 200 | 4.0 | PASS | no |  |
| 36 | GET | `/api/github/auth/initiate` | 503 | 0.6 | PASS | no |  |
| 37 | POST | `/api/github/auth/pat` | 401 | 242.0 | PASS | no |  |
| 38 | POST | `/api/github/auth/repos/create` | 422 | 8.3 | PASS | no |  |
| 39 | GET | `/api/github/auth/status` | 422 | 0.0 | PASS | no |  |
| 40 | GET | `/api/github/auth/token` | 422 | 0.0 | PASS | no |  |
| 41 | GET | `/api/projects/_harness/threads` | 200 | 8.3 | PASS | no |  |
| 42 | POST | `/api/projects/_harness/threads` | 200 | 8.0 | PASS | no |  |
| 43 | GET | `/api/tasks` | 422 | 0.0 | PASS | no |  |
| 44 | POST | `/api/tasks` | 422 | 0.0 | PASS | no |  |
| 45 | PATCH | `/api/tasks/1` | 422 | 0.0 | PASS | no |  |
| 46 | DELETE | `/api/tasks/1` | 422 | 8.7 | PASS | no |  |
| 47 | GET | `/api/threads/1` | 400 | 0.0 | PASS | no |  |
| 48 | DELETE | `/api/threads/1` | 400 | 0.0 | PASS | no |  |
| 49 | POST | `/api/threads/1/cancel` | 200 | 0.0 | PASS | no |  |
| 50 | GET | `/api/threads/1/messages` | 400 | 0.0 | PASS | no |  |
| 51 | POST | `/api/threads/1/messages` | 422 | 0.0 | PASS | no |  |
| 52 | GET | `/api/threads/1/messages/count` | 400 | 8.2 | PASS | no |  |
| 53 | PUT | `/api/threads/1/title` | 422 | 0.0 | PASS | no |  |
| 54 | POST | `/chat` | 422 | 0.0 | PASS | no |  |
| 55 | POST | `/files/extract-absolute` | 422 | 0.0 | PASS | no |  |
| 56 | GET | `/groq/models` | 200 | 0.0 | PASS | no |  |
| 57 | POST | `/groq/models/active` | 422 | 7.3 | PASS | no |  |
| 58 | GET | `/history` | 200 | 0.5 | PASS | no |  |
| 59 | POST | `/history` | 200 | 13.9 | PASS | no |  |
| 60 | GET | `/history/search` | 200 | 4.7 | PASS | no |  |
| 61 | GET | `/models` | 200 | 140.0 | PASS | no |  |
| 62 | POST | `/models/active` | 422 | 0.0 | PASS | no |  |
| 63 | GET | `/ollama/models` | 200 | 29.5 | PASS | no |  |
| 64 | GET | `/project/_harness/activity` | 200 | 3.9 | PASS | no |  |
| 65 | GET | `/project/_harness/approvals` | 200 | 7.7 | PASS | no |  |
| 66 | POST | `/project/_harness/approvals/test/approve` | 404 | 2.2 | PASS | no |  |
| 67 | POST | `/project/_harness/approvals/test/reject` | 404 | 0.0 | PASS | no |  |
| 68 | GET | `/project/_harness/audit` | 200 | 0.0 | PASS | no |  |
| 69 | GET | `/project/_harness/chat` | 200 | 6.3 | PASS | no |  |
| 70 | GET | `/project/_harness/chat/summary` | 200 | 0.0 | PASS | no |  |
| 71 | POST | `/project/_harness/chat/summary/refresh` | 404 | 18.5 | PASS | no |  |
| 72 | POST | `/project/_harness/cli/explain-command` | 422 | 0.0 | PASS | no |  |
| 73 | POST | `/project/_harness/cli/generate-command` | 422 | 5.6 | PASS | no |  |
| 74 | POST | `/project/_harness/coagent/api-contracts` | 404 | 17.3 | PASS | no |  |
| 75 | POST | `/project/_harness/coagent/cleanup-scan` | 404 | 16.6 | PASS | no |  |
| 76 | POST | `/project/_harness/coagent/coding-memory` | 404 | 16.7 | PASS | no |  |
| 77 | POST | `/project/_harness/coagent/file-targets` | 422 | 0.0 | PASS | no |  |
| 78 | POST | `/project/_harness/coagent/project-state` | 404 | 18.1 | PASS | no |  |
| 79 | POST | `/project/_harness/coagent/run-command` | 422 | 0.0 | PASS | no |  |
| 80 | POST | `/project/_harness/coagent/why-failing` | 422 | 7.1 | PASS | no |  |
| 81 | POST | `/project/_harness/coagent/wiring-trace` | 422 | 0.0 | PASS | no |  |
| 82 | POST | `/project/_harness/coagent/workspace-map` | 404 | 16.5 | PASS | no |  |
| 83 | POST | `/project/_harness/command/run` | 422 | 0.0 | PASS | no |  |
| 84 | POST | `/project/_harness/cowork/instruction` | 404 | 17.3 | PASS | no |  |
| 85 | POST | `/project/_harness/data/dashboard-summary` | 400 | 7.2 | PASS | no |  |
| 86 | GET | `/project/_harness/diagnostics` | 200 | 17.3 | PASS | no |  |
| 87 | POST | `/project/_harness/directory` | 400 | 0.0 | PASS | no |  |
| 88 | GET | `/project/_harness/documents` | 200 | 0.0 | PASS | no |  |
| 89 | GET | `/project/_harness/documents/search` | 422 | 0.0 | PASS | no |  |
| 90 | GET | `/project/_harness/documents/test` | 404 | 8.4 | PASS | no |  |
| 91 | GET | `/project/_harness/documents/test/content` | 404 | 0.0 | PASS | no |  |
| 92 | POST | `/project/_harness/documents/test/summarize` | 404 | 0.0 | PASS | no |  |
| 93 | GET | `/project/_harness/documents/test/tabular` | 404 | 0.0 | PASS | no |  |
| 94 | GET | `/project/_harness/file` | 422 | 0.0 | PASS | no |  |
| 95 | DELETE | `/project/_harness/file` | 422 | 9.1 | PASS | no |  |
| 96 | POST | `/project/_harness/file/diff` | 422 | 0.0 | PASS | no |  |
| 97 | POST | `/project/_harness/file/move` | 400 | 0.0 | PASS | no |  |
| 98 | POST | `/project/_harness/file/overwrite` | 422 | 0.0 | PASS | no |  |
| 99 | GET | `/project/_harness/file/range` | 422 | 0.0 | PASS | no |  |
| 100 | POST | `/project/_harness/file/write` | 422 | 6.9 | PASS | no |  |
| 101 | GET | `/project/_harness/files` | 200 | 26.9 | PASS | no |  |
| 102 | POST | `/project/_harness/files/extract` | 200 | 48.5 | PASS | no |  |
| 103 | GET | `/project/_harness/files/search` | 422 | 0.0 | PASS | no |  |
| 104 | GET | `/project/_harness/git/branch` | 200 | 58.4 | PASS | no |  |
| 105 | GET | `/project/_harness/github/branches` | 200 | 57.8 | PASS | no |  |
| 106 | POST | `/project/_harness/github/commit` | 200 | 587.7 | PASS | no |  |
| 107 | POST | `/project/_harness/github/pull-request-draft` | 422 | 5.0 | PASS | no |  |
| 108 | GET | `/project/_harness/github/repo` | 200 | 0.0 | PASS | no |  |
| 109 | POST | `/project/_harness/github/repo` | 400 | 0.0 | PASS | no |  |
| 110 | GET | `/project/_harness/github/status` | 200 | 162.7 | PASS | no |  |
| 111 | GET | `/project/_harness/index/status` | 200 | 2.9 | PASS | no |  |
| 112 | POST | `/project/_harness/index/trigger` | 200 | 0.0 | PASS | no |  |
| 113 | POST | `/project/_harness/ingest/file` | 422 | 0.0 | PASS | no |  |
| 114 | POST | `/project/_harness/ingest/folder` | 422 | 0.0 | PASS | no |  |
| 115 | GET | `/project/_harness/ingest/jobs` | 200 | 0.0 | PASS | no |  |
| 116 | GET | `/project/_harness/ingest/jobs/test` | 404 | 9.4 | PASS | no |  |
| 117 | POST | `/project/_harness/ingest/zip` | 422 | 0.5 | PASS | no |  |
| 118 | POST | `/project/_harness/media/transcribe-file` | 400 | 2.2 | PASS | no |  |
| 119 | POST | `/project/_harness/media/transcribe-upload` | 422 | 0.0 | PASS | no |  |
| 120 | GET | `/project/_harness/memory` | 200 | 4.8 | PASS | no |  |
| 121 | POST | `/project/_harness/memory` | 422 | 0.0 | PASS | no |  |
| 122 | PATCH | `/project/_harness/memory/test` | 404 | 0.0 | PASS | no |  |
| 123 | DELETE | `/project/_harness/memory/test` | 404 | 0.0 | PASS | no |  |
| 124 | GET | `/project/_harness/messages` | 200 | 8.2 | PASS | no |  |
| 125 | POST | `/project/_harness/messages` | 422 | 0.0 | PASS | no |  |
| 126 | GET | `/project/_harness/notes` | 200 | 0.0 | PASS | no |  |
| 127 | POST | `/project/_harness/notes` | 422 | 0.0 | PASS | no |  |
| 128 | PATCH | `/project/_harness/notes/test` | 404 | 8.3 | PASS | no |  |
| 129 | DELETE | `/project/_harness/notes/test` | 404 | 2.9 | PASS | no |  |
| 130 | POST | `/project/_harness/pair/plan` | 404 | 13.9 | PASS | no |  |
| 131 | POST | `/project/_harness/pair/refactor-preview` | 404 | 16.3 | PASS | no |  |
| 132 | POST | `/project/_harness/pair/review` | 404 | 16.8 | PASS | no |  |
| 133 | POST | `/project/_harness/research/deep-report` | 400 | 8.8 | PASS | no |  |
| 134 | GET | `/project/_harness/runs` | 200 | 0.0 | PASS | no |  |
| 135 | GET | `/project/_harness/runs/test` | 404 | 0.0 | PASS | no |  |
| 136 | POST | `/project/_harness/scaffold/app` | 200 | 22.3 | PASS | no |  |
| 137 | GET | `/project/_harness/scope` | 200 | 19.1 | PASS | no |  |
| 138 | GET | `/project/_harness/search` | 422 | 0.0 | PASS | no |  |
| 139 | GET | `/project/_harness/snapshots` | 200 | 0.0 | PASS | no |  |
| 140 | POST | `/project/_harness/snapshots` | 200 | 25.2 | PASS | no |  |
| 141 | POST | `/project/_harness/snapshots/test/restore` | 404 | 14.1 | PASS | no |  |
| 142 | POST | `/project/_harness/source/link` | 422 | 2.4 | PASS | no |  |
| 143 | GET | `/project/_harness/tasks` | 200 | 0.0 | PASS | no |  |
| 144 | POST | `/project/_harness/tasks` | 422 | 3.2 | PASS | no |  |
| 145 | PATCH | `/project/_harness/tasks/1` | 404 | 2.0 | PASS | no |  |
| 146 | DELETE | `/project/_harness/tasks/1` | 404 | 4.0 | PASS | no |  |
| 147 | GET | `/project/_harness/tests` | 200 | 3.0 | PASS | no |  |
| 148 | POST | `/project/_harness/tests` | 422 | 1.5 | PASS | no |  |
| 149 | PATCH | `/project/_harness/tests/test` | 404 | 2.0 | PASS | no |  |
| 150 | DELETE | `/project/_harness/tests/test` | 404 | 2.8 | PASS | no |  |
| 151 | POST | `/project/_harness/tests/test/run` | 404 | 0.0 | PASS | no |  |
| 152 | POST | `/project/_harness/voice/chat` | 400 | 5.6 | PASS | no |  |
| 153 | POST | `/project/_harness/web/fetch` | 422 | 0.9 | PASS | no |  |
| 154 | POST | `/project/_harness/web/search` | 422 | 0.0 | PASS | no |  |
| 155 | POST | `/project/_harness/workspace/analyze` | 404 | 16.2 | PASS | no |  |
| 156 | GET | `/projects` | 200 | 17.3 | PASS | no |  |
| 157 | POST | `/projects/clone-git` | 422 | 0.0 | PASS | no |  |
| 158 | POST | `/projects/create` | 200 | 249.8 | PASS | no |  |
| 159 | POST | `/projects/import` | 422 | 0.0 | PASS | no |  |
| 160 | POST | `/projects/import-existing` | 422 | 0.0 | PASS | no |  |
| 161 | POST | `/projects/import-linked` | 422 | 7.4 | PASS | no |  |
| 162 | GET | `/projects/_harness` | 404 | 25.9 | PASS | no |  |
| 163 | PATCH | `/projects/_harness` | 404 | 27.6 | PASS | no |  |
| 164 | DELETE | `/projects/_harness` | 404 | 23.0 | PASS | no |  |
| 165 | POST | `/projects/_harness/archive` | 404 | 24.8 | PASS | no |  |
| 166 | POST | `/projects/_harness/source/link` | 422 | 0.0 | PASS | no |  |
| 167 | GET | `/roles` | 200 | 4.8 | PASS | no |  |
| 168 | GET | `/roles/architect` | 200 | 3.3 | PASS | no |  |
| 169 | GET | `/secrets` | 200 | 3.0 | PASS | no |  |
| 170 | POST | `/secrets/test` | 200 | 0.0 | PASS | no |  |
| 171 | DELETE | `/secrets/test` | 200 | 7.4 | PASS | no |  |
| 172 | POST | `/secrets/test/reveal` | 404 | 3.0 | PASS | no |  |
| 173 | GET | `/settings` | 200 | 1.6 | PASS | no |  |
| 174 | POST | `/settings` | 422 | 0.3 | PASS | no |  |
| 175 | GET | `/settings/provider` | 200 | 0.0 | PASS | no |  |
| 176 | POST | `/settings/provider` | 422 | 0.0 | PASS | no |  |
| 177 | POST | `/settings/provider/model` | 422 | 7.5 | PASS | no |  |
| 178 | GET | `/settings/providers` | 200 | 0.0 | PASS | no |  |
| 179 | GET | `/slash/commands` | 200 | 5.0 | PASS | no |  |
| 180 | POST | `/slash/run` | 200 | 3.6 | PASS | no |  |
| 181 | GET | `/supported-file-types` | 200 | 0.0 | PASS | no |  |
| 182 | GET | `/themes` | 200 | 8.1 | PASS | no |  |
| 183 | POST | `/themes` | 200 | 7.4 | PASS | no |  |
| 184 | GET | `/themes/active` | 200 | 4.7 | PASS | no |  |
| 185 | POST | `/themes/active` | 200 | 3.9 | PASS | no |  |
| 186 | GET | `/voice/available` | 200 | 6.1 | PASS | no |  |
| 187 | GET | `/voice/voices` | 200 | 0.0 | PASS | no |  |

## Group: voice

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/voice/transcribe` | 200 | 2358.6 | PASS | no |  |

## Group: websocket

| # | Method | URL | Status | ms | OK | Required | Note |
|---|---|---|---|---|---|---|---|
| 1 | WS | `ws://127.0.0.1:63416/ws/terminal/_harness` | 200 | 3091.0 | PASS | yes | echo roundtrip |
| 2 | WS | `ws://127.0.0.1:63416/ws/voice` | 200 | 0.0 | PASS | no | received response |

## Failures
