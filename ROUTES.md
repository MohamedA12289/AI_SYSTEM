# CubOS Route Manifest

Backend routes: **189**  ·  Frontend call sites: **37**  ·  Unique frontend paths: **27**
Frontend paths with NO matching backend route: **13**

## Backend routes

| Method | Path | Source |
|---|---|---|
| GET | `/` | app\backend\advanced_routes.py:317 |
| GET | `/` | app\backend\main.py:628 |
| GET | `/activity` | app\backend\main.py:1249 |
| POST | `/agent/chat` | app\backend\main.py:1561 |
| POST | `/agent/loop` | app\backend\main.py:1625 |
| GET | `/agents` | app\backend\api\customization.py:205 |
| POST | `/agents` | app\backend\api\customization.py:212 |
| GET | `/api/projects/{project_name}/threads` | app\backend\thread_routes.py:58 |
| POST | `/api/projects/{project_name}/threads` | app\backend\thread_routes.py:68 |
| DELETE | `/api/threads/{thread_id}` | app\backend\thread_routes.py:124 |
| GET | `/api/threads/{thread_id}` | app\backend\thread_routes.py:85 |
| POST | `/api/threads/{thread_id}/cancel` | app\backend\thread_routes.py:404 |
| GET | `/api/threads/{thread_id}/messages` | app\backend\thread_routes.py:146 |
| POST | `/api/threads/{thread_id}/messages` | app\backend\thread_routes.py:166 |
| GET | `/api/threads/{thread_id}/messages/count` | app\backend\thread_routes.py:411 |
| POST | `/api/threads/{thread_id}/stream` | app\backend\thread_routes.py:205 |
| PUT | `/api/threads/{thread_id}/title` | app\backend\thread_routes.py:102 |
| GET | `/branches` | app\backend\api\git.py:159 |
| GET | `/callback` | app\backend\api\github_auth.py:39 |
| POST | `/chat` | app\backend\main.py:707 |
| POST | `/chat/stream` | app\backend\main.py:723 |
| POST | `/checkout` | app\backend\api\git.py:170 |
| POST | `/clone` | app\backend\api\git.py:197 |
| POST | `/commit` | app\backend\api\git.py:138 |
| POST | `/files/extract-absolute` | app\backend\file_extractor_routes.py:53 |
| GET | `/groq/models` | app\backend\main.py:1365 |
| POST | `/groq/models/active` | app\backend\main.py:1372 |
| GET | `/history` | app\backend\main.py:1468 |
| POST | `/history` | app\backend\main.py:1478 |
| GET | `/history/search` | app\backend\main.py:1473 |
| GET | `/hooks` | app\backend\api\customization.py:130 |
| POST | `/hooks` | app\backend\api\customization.py:137 |
| PATCH | `/hooks/{hook_id}` | app\backend\api\customization.py:147 |
| POST | `/init` | app\backend\api\git.py:208 |
| GET | `/initiate` | app\backend\api\github_auth.py:26 |
| GET | `/instructions` | app\backend\api\customization.py:86 |
| POST | `/instructions` | app\backend\api\customization.py:93 |
| DELETE | `/instructions/{instruction_id}` | app\backend\api\customization.py:103 |
| GET | `/mcp_servers` | app\backend\api\customization.py:159 |
| POST | `/mcp_servers` | app\backend\api\customization.py:166 |
| GET | `/models` | app\backend\main.py:1312 |
| POST | `/models/active` | app\backend\main.py:1316 |
| GET | `/ollama/models` | app\backend\main.py:1321 |
| POST | `/pat` | app\backend\api\github_auth.py:97 |
| GET | `/plugins` | app\backend\api\customization.py:176 |
| POST | `/plugins` | app\backend\api\customization.py:183 |
| PATCH | `/plugins/{plugin_id}` | app\backend\api\customization.py:193 |
| GET | `/project/{project_name}/activity` | app\backend\main.py:1245 |
| GET | `/project/{project_name}/approvals` | app\backend\main.py:1179 |
| POST | `/project/{project_name}/approvals/{approval_id}/approve` | app\backend\main.py:1183 |
| POST | `/project/{project_name}/approvals/{approval_id}/reject` | app\backend\main.py:1214 |
| GET | `/project/{project_name}/audit` | app\backend\main.py:1253 |
| GET | `/project/{project_name}/chat` | app\backend\main.py:761 |
| GET | `/project/{project_name}/chat/summary` | app\backend\main.py:777 |
| POST | `/project/{project_name}/chat/summary/refresh` | app\backend\main.py:781 |
| POST | `/project/{project_name}/cli/explain-command` | app\backend\wave2_routes.py:556 |
| POST | `/project/{project_name}/cli/generate-command` | app\backend\wave2_routes.py:584 |
| POST | `/project/{project_name}/coagent/api-contracts` | app\backend\code_agent_routes.py:380 |
| POST | `/project/{project_name}/coagent/cleanup-scan` | app\backend\code_agent_routes.py:335 |
| POST | `/project/{project_name}/coagent/coding-memory` | app\backend\code_agent_routes.py:520 |
| POST | `/project/{project_name}/coagent/file-targets` | app\backend\code_agent_routes.py:173 |
| POST | `/project/{project_name}/coagent/project-state` | app\backend\code_agent_routes.py:445 |
| POST | `/project/{project_name}/coagent/run-command` | app\backend\code_agent_routes.py:503 |
| POST | `/project/{project_name}/coagent/why-failing` | app\backend\code_agent_routes.py:227 |
| POST | `/project/{project_name}/coagent/wiring-trace` | app\backend\code_agent_routes.py:286 |
| POST | `/project/{project_name}/coagent/workspace-map` | app\backend\code_agent_routes.py:109 |
| POST | `/project/{project_name}/command/run` | app\backend\main.py:1057 |
| POST | `/project/{project_name}/command/stream` | app\backend\main.py:1066 |
| POST | `/project/{project_name}/cowork/instruction` | app\backend\advanced_routes.py:136 |
| POST | `/project/{project_name}/cowork/instruction` | app\backend\wave2_routes.py:515 |
| POST | `/project/{project_name}/data/dashboard-summary` | app\backend\advanced_routes.py:188 |
| POST | `/project/{project_name}/data/dashboard-summary` | app\backend\wave34_routes.py:258 |
| GET | `/project/{project_name}/diagnostics` | app\backend\main.py:1097 |
| POST | `/project/{project_name}/directory` | app\backend\main.py:1016 |
| GET | `/project/{project_name}/documents` | app\backend\wave1_router.py:114 |
| GET | `/project/{project_name}/documents/search` | app\backend\hotfix_routes.py:42 |
| GET | `/project/{project_name}/documents/{document_id}` | app\backend\wave1_router.py:119 |
| GET | `/project/{project_name}/documents/{document_id}/content` | app\backend\wave1_router.py:127 |
| POST | `/project/{project_name}/documents/{document_id}/summarize` | app\backend\wave1_router.py:142 |
| GET | `/project/{project_name}/documents/{document_id}/tabular` | app\backend\wave1_router.py:152 |
| DELETE | `/project/{project_name}/file` | app\backend\main.py:1002 |
| GET | `/project/{project_name}/file` | app\backend\main.py:918 |
| POST | `/project/{project_name}/file/diff` | app\backend\main.py:970 |
| POST | `/project/{project_name}/file/move` | app\backend\main.py:1034 |
| POST | `/project/{project_name}/file/overwrite` | app\backend\main.py:989 |
| GET | `/project/{project_name}/file/range` | app\backend\main.py:929 |
| POST | `/project/{project_name}/file/write` | app\backend\main.py:978 |
| GET | `/project/{project_name}/files` | app\backend\main.py:907 |
| POST | `/project/{project_name}/files/extract` | app\backend\file_extractor_routes.py:24 |
| GET | `/project/{project_name}/files/search` | app\backend\main.py:941 |
| GET | `/project/{project_name}/git/branch` | app\backend\main.py:950 |
| GET | `/project/{project_name}/github/branches` | app\backend\wave2_routes.py:642 |
| POST | `/project/{project_name}/github/commit` | app\backend\wave2_routes.py:650 |
| POST | `/project/{project_name}/github/pull-request-draft` | app\backend\wave2_routes.py:685 |
| GET | `/project/{project_name}/github/repo` | app\backend\wave2_routes.py:615 |
| POST | `/project/{project_name}/github/repo` | app\backend\wave2_routes.py:621 |
| GET | `/project/{project_name}/github/status` | app\backend\wave2_routes.py:635 |
| GET | `/project/{project_name}/index/status` | app\backend\main.py:1339 |
| POST | `/project/{project_name}/index/trigger` | app\backend\main.py:1334 |
| POST | `/project/{project_name}/ingest/file` | app\backend\wave1_router.py:56 |
| POST | `/project/{project_name}/ingest/folder` | app\backend\wave1_router.py:71 |
| GET | `/project/{project_name}/ingest/jobs` | app\backend\wave1_router.py:101 |
| GET | `/project/{project_name}/ingest/jobs/{job_id}` | app\backend\wave1_router.py:106 |
| POST | `/project/{project_name}/ingest/zip` | app\backend\wave1_router.py:86 |
| POST | `/project/{project_name}/media/transcribe-file` | app\backend\advanced_routes.py:217 |
| POST | `/project/{project_name}/media/transcribe-file` | app\backend\wave34_routes.py:126 |
| POST | `/project/{project_name}/media/transcribe-upload` | app\backend\main.py:1765 |
| GET | `/project/{project_name}/memory` | app\backend\main.py:867 |
| POST | `/project/{project_name}/memory` | app\backend\main.py:871 |
| DELETE | `/project/{project_name}/memory/{memory_id}` | app\backend\main.py:896 |
| PATCH | `/project/{project_name}/memory/{memory_id}` | app\backend\main.py:880 |
| GET | `/project/{project_name}/messages` | app\backend\main.py:768 |
| POST | `/project/{project_name}/messages` | app\backend\main.py:772 |
| GET | `/project/{project_name}/notes` | app\backend\main.py:831 |
| POST | `/project/{project_name}/notes` | app\backend\main.py:835 |
| DELETE | `/project/{project_name}/notes/{note_id}` | app\backend\main.py:856 |
| PATCH | `/project/{project_name}/notes/{note_id}` | app\backend\main.py:844 |
| POST | `/project/{project_name}/pair/plan` | app\backend\advanced_routes.py:95 |
| POST | `/project/{project_name}/pair/plan` | app\backend\wave2_routes.py:439 |
| POST | `/project/{project_name}/pair/refactor-preview` | app\backend\advanced_routes.py:115 |
| POST | `/project/{project_name}/pair/refactor-preview` | app\backend\wave2_routes.py:472 |
| POST | `/project/{project_name}/pair/review` | app\backend\advanced_routes.py:75 |
| POST | `/project/{project_name}/pair/review` | app\backend\wave2_routes.py:406 |
| POST | `/project/{project_name}/research/deep-report` | app\backend\advanced_routes.py:156 |
| POST | `/project/{project_name}/research/deep-report` | app\backend\wave34_routes.py:176 |
| GET | `/project/{project_name}/runs` | app\backend\main.py:1549 |
| GET | `/project/{project_name}/runs/{run_id}` | app\backend\main.py:1554 |
| POST | `/project/{project_name}/scaffold/app` | app\backend\advanced_routes.py:344 |
| POST | `/project/{project_name}/scaffold/app` | app\backend\wave34_routes.py:302 |
| GET | `/project/{project_name}/scope` | app\backend\main.py:700 |
| GET | `/project/{project_name}/search` | app\backend\main.py:1297 |
| GET | `/project/{project_name}/snapshots` | app\backend\main.py:1223 |
| POST | `/project/{project_name}/snapshots` | app\backend\main.py:1227 |
| POST | `/project/{project_name}/snapshots/{snapshot_id}/restore` | app\backend\main.py:1236 |
| POST | `/project/{project_name}/source/link` | app\backend\wave34_routes.py:97 |
| GET | `/project/{project_name}/tasks` | app\backend\main.py:791 |
| POST | `/project/{project_name}/tasks` | app\backend\main.py:795 |
| DELETE | `/project/{project_name}/tasks/{task_id}` | app\backend\main.py:820 |
| PATCH | `/project/{project_name}/tasks/{task_id}` | app\backend\main.py:804 |
| GET | `/project/{project_name}/tests` | app\backend\main.py:1257 |
| POST | `/project/{project_name}/tests` | app\backend\main.py:1261 |
| DELETE | `/project/{project_name}/tests/{test_id}` | app\backend\main.py:1279 |
| PATCH | `/project/{project_name}/tests/{test_id}` | app\backend\main.py:1270 |
| POST | `/project/{project_name}/tests/{test_id}/run` | app\backend\main.py:1288 |
| POST | `/project/{project_name}/voice/chat` | app\backend\advanced_routes.py:246 |
| POST | `/project/{project_name}/voice/chat` | app\backend\wave34_routes.py:145 |
| POST | `/project/{project_name}/web/fetch` | app\backend\main.py:1136 |
| POST | `/project/{project_name}/web/search` | app\backend\main.py:1145 |
| POST | `/project/{project_name}/workspace/analyze` | app\backend\advanced_routes.py:55 |
| POST | `/project/{project_name}/workspace/analyze` | app\backend\wave2_routes.py:368 |
| GET | `/projects` | app\backend\main.py:632 |
| POST | `/projects/clone-git` | app\backend\main.py:1737 |
| POST | `/projects/create` | app\backend\main.py:636 |
| POST | `/projects/import` | app\backend\advanced_routes.py:384 |
| POST | `/projects/import` | app\backend\main.py:647 |
| POST | `/projects/import-existing` | app\backend\wave1_router.py:40 |
| DELETE | `/projects/{project_name}` | app\backend\main.py:680 |
| GET | `/projects/{project_name}` | app\backend\main.py:660 |
| PATCH | `/projects/{project_name}` | app\backend\main.py:669 |
| POST | `/projects/{project_name}/archive` | app\backend\main.py:691 |
| POST | `/projects/{project_name}/source/link` | app\backend\advanced_routes.py:285 |
| POST | `/projects/{project_name}/source/link` | app\backend\wave34_routes.py:96 |
| GET | `/prompts` | app\backend\api\customization.py:113 |
| POST | `/prompts` | app\backend\api\customization.py:120 |
| POST | `/pull` | app\backend\api\git.py:153 |
| POST | `/push` | app\backend\api\git.py:147 |
| POST | `/repos/create` | app\backend\api\github_auth.py:144 |
| GET | `/roles` | app\backend\main.py:1421 |
| GET | `/roles/{role}` | app\backend\main.py:1427 |
| GET | `/secrets` | app\backend\main.py:1154 |
| DELETE | `/secrets/{key}` | app\backend\main.py:1165 |
| POST | `/secrets/{key}` | app\backend\main.py:1158 |
| POST | `/secrets/{key}/reveal` | app\backend\main.py:1172 |
| POST | `/set-remote` | app\backend\api\git.py:234 |
| GET | `/settings` | app\backend\main.py:1304 |
| POST | `/settings` | app\backend\main.py:1308 |
| GET | `/settings/provider` | app\backend\main.py:1343 |
| POST | `/settings/provider` | app\backend\main.py:1350 |
| POST | `/settings/provider/model` | app\backend\main.py:1385 |
| GET | `/settings/providers` | app\backend\main.py:1359 |
| GET | `/skills` | app\backend\api\customization.py:222 |
| POST | `/skills` | app\backend\api\customization.py:229 |
| GET | `/slash/commands` | app\backend\main.py:1457 |
| POST | `/slash/run` | app\backend\main.py:1462 |
| POST | `/stage` | app\backend\api\git.py:124 |
| GET | `/status` | app\backend\api\git.py:65 |
| GET | `/status` | app\backend\api\github_auth.py:87 |
| GET | `/supported-file-types` | app\backend\wave1_router.py:35 |
| GET | `/themes` | app\backend\main.py:1436 |
| POST | `/themes` | app\backend\main.py:1451 |
| GET | `/themes/active` | app\backend\main.py:1441 |
| POST | `/themes/active` | app\backend\main.py:1446 |
| GET | `/token` | app\backend\api\github_auth.py:129 |
| POST | `/unstage` | app\backend\api\git.py:131 |
| GET | `/voice/available` | app\backend\main.py:1495 |
| POST | `/voice/download` | app\backend\main.py:1500 |
| POST | `/voice/transcribe` | app\backend\main.py:1505 |
| GET | `/voice/voices` | app\backend\main.py:1490 |
| WEBSOCKET | `/ws/terminal/{project_name}` | app\backend\main.py:1725 |
| WEBSOCKET | `/ws/voice` | app\backend\main.py:1511 |
| POST | `/{artifact_id}/apply` | app\backend\api\artifacts.py:28 |
| DELETE | `/{task_id}` | app\backend\api\tasks.py:75 |
| PATCH | `/{task_id}` | app\backend\api\tasks.py:58 |

## Frontend call sites

| Method | Path | Source | Raw |
|---|---|---|---|
| WS | `//${wsHost}/ws/terminal/${projectId}` | app\frontend\src\components\Terminal.tsx:71 | `${wsProtocol}//${wsHost}/ws/terminal/${projectId}` |
| POST | `/api/git/clone` | app\frontend\src\components\CloneRepositoryDialog.tsx:40 | `${getApiBase()}/api/git/clone` |
| POST | `/api/git/clone` | app\frontend\src\components\GitHub\CloneRepoDialog.tsx:38 | `${getApiBase()}/api/git/clone` |
| POST | `/api/git/commit` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:80 | `${getApiBase()}/api/git/commit` |
| POST | `/api/git/pull` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:113 | `${getApiBase()}/api/git/pull` |
| POST | `/api/git/push` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:98 | `${getApiBase()}/api/git/push` |
| POST | `/api/git/stage` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:45 | `${getApiBase()}/api/git/stage` |
| GET | `/api/git/status` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:32 | `${getApiBase()}/api/git/status?project_path=${encodeURIComponent(projectPath)}` |
| POST | `/api/git/unstage` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:62 | `${getApiBase()}/api/git/unstage` |
| GET | `/api/github/auth/initiate` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:20 | `${getApiBase()}/api/github/auth/initiate` |
| POST | `/api/github/auth/pat` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:62 | `${getApiBase()}/api/github/auth/pat` |
| GET | `/api/github/auth/status` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:37 | `${getApiBase()}/api/github/auth/status?state=${state}` |
| GET | `/api/tasks` | app\frontend\src\components\Tasks\TasksPanel.tsx:28 | `${getApiBase()}/api/tasks?project_path=${encodeURIComponent(projectPath)}` |
| GET | `/api/tasks` | app\frontend\src\components\Tasks\TasksPanel.tsx:50 | `${getApiBase()}/api/tasks?project_path=${encodeURIComponent(projectPath)}` |
| GET | `/api/tasks/${taskId}` | app\frontend\src\components\Tasks\TasksPanel.tsx:68 | `${getApiBase()}/api/tasks/${taskId}?project_path=${encodeURIComponent(projectPath)}` |
| POST | `/api/threads/${threadId}/cancel` | app\frontend\src\services\api.ts:216 | `${BASE}/api/threads/${threadId}/cancel` |
| POST | `/api/threads/${threadId}/stream` | app\frontend\src\services\api.ts:184 | `${BASE}/api/threads/${threadId}/stream` |
| POST | `/chat/stream` | app\frontend\src\pages\ChatsPage.tsx:53 | `${base}/chat/stream` |
| POST | `/chat/stream` | app\frontend\src\services\api.ts:129 | `${BASE}/chat/stream` |
| POST | `/project/${projectName}/command/stream` | app\frontend\src\services\api.ts:252 | `${BASE}/project/${projectName}/command/stream` |
| GET | `/project/${projectName}/directory` | app\frontend\src\components\FileTree.tsx:190 | `${getApiBase()}/project/${projectName}/directory` |
| GET | `/project/${projectName}/file` | app\frontend\src\components\FileTree.tsx:242 | `${getApiBase()}/project/${projectName}/file?path=${encodeURIComponent(item.path)}` |
| GET | `/project/${projectName}/file` | app\frontend\src\components\Editor\EditorPanel.tsx:182 | `${getApiBase()}/project/${projectName}/file?path=${encodeURIComponent(filePath)}` |
| GET | `/project/${projectName}/file/move` | app\frontend\src\components\FileTree.tsx:219 | `${getApiBase()}/project/${projectName}/file/move` |
| GET | `/project/${projectName}/file/overwrite` | app\frontend\src\components\Editor\EditorPanel.tsx:209 | `${getApiBase()}/project/${projectName}/file/overwrite` |
| GET | `/project/${projectName}/file/write` | app\frontend\src\components\FileTree.tsx:166 | `${getApiBase()}/project/${projectName}/file/write` |
| GET | `/project/${projectName}/file/write` | app\frontend\src\components\FileTree.tsx:405 | `${getApiBase()}/project/${projectName}/file/write` |
| GET | `/project/${projectName}/files` | app\frontend\src\components\FileTree.tsx:122 | `${getApiBase()}/project/${projectName}/files?subpath=${encodeURIComponent(item.path)}` |
| GET | `/project/${projectName}/files` | app\frontend\src\components\FileTree.tsx:347 | `${getApiBase()}/project/${projectName}/files` |
| POST | `/project/${projectName}/media/transcribe-upload` | app\frontend\src\services\api.ts:360 | `${BASE}/project/${projectName}/media/transcribe-upload` |
| GET | `/projects` | app\frontend\src\pages\WelcomePage.tsx:20 | `/projects` |
| POST | `/projects/import` | app\frontend\src\pages\CodeModePage.tsx:939 | `${BASE}/projects/import` |
| POST | `/projects/import` | app\frontend\src\pages\HomePage.tsx:64 | `${getApiBase()}/projects/import` |
| POST | `/projects/import` | app\frontend\src\pages\NewProjectPage.tsx:45 | `${getApiBase()}/projects/import` |
| POST | `/projects/import` | app\frontend\src\pages\NewProjectPage.tsx:81 | `${getApiBase()}/projects/import` |
| POST | `/projects/import` | app\frontend\src\pages\WelcomePage.tsx:70 | `/projects/import` |
| WS | `/ws/terminal/${projectName}` | app\frontend\src\components\Terminal\TerminalPanel.tsx:90 | `${backendUrl}/ws/terminal/${projectName}` |

## Frontend paths with NO matching backend route (likely 404s)

| Method | Path | Sites |
|---|---|---|
| GET | `/api/git/status` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:32 |
| GET | `/api/github/auth/initiate` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:20 |
| GET | `/api/github/auth/status` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:37 |
| GET | `/api/tasks` | app\frontend\src\components\Tasks\TasksPanel.tsx:28<br>app\frontend\src\components\Tasks\TasksPanel.tsx:50 |
| GET | `/api/tasks/${taskId}` | app\frontend\src\components\Tasks\TasksPanel.tsx:68 |
| POST | `/api/git/clone` | app\frontend\src\components\CloneRepositoryDialog.tsx:40<br>app\frontend\src\components\GitHub\CloneRepoDialog.tsx:38 |
| POST | `/api/git/commit` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:80 |
| POST | `/api/git/pull` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:113 |
| POST | `/api/git/push` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:98 |
| POST | `/api/git/stage` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:45 |
| POST | `/api/git/unstage` | app\frontend\src\components\SourceControl\SourceControlPanel.tsx:62 |
| POST | `/api/github/auth/pat` | app\frontend\src\components\GitHub\GitHubAuthDialog.tsx:62 |
| WS | `//${wsHost}/ws/terminal/${projectId}` | app\frontend\src\components\Terminal.tsx:71 |