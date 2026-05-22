# CubOS Tests Log - Codex

> Codex-owned run log for the copied workspace at `D:\AI_SYSTEM - Codex`.
> Full endpoint-suite runs should still write to `TEST_REPORT-CODEX.md`.

## 2026-05-15 - Sprint 3 Frontend Contract Pass

Commands run:

- `npm.cmd --prefix app\frontend run test`
- `npm.cmd --prefix app\frontend run build`
- `npm.cmd --prefix app\frontend run test`

Results:

- Frontend unit/contract tests passed: 2 test files, 4 tests.
- New Codex contract tests passed for project import normalization, Git status
  `project_path` resolution, and selected-file commit staging.
- Frontend production build passed after TypeScript test mock typings were fixed.

Build notes:

- Vite emitted existing non-fatal warnings about stale `caniuse-lite`, large chunk
  size, and dynamic/static import overlap for `api.ts`.
- No frontend source caller still invokes synchronous `getApiBase()` directly.
- The remaining hardcoded `127.0.0.1:8000` frontend references are fallback defaults,
  not eager requests.

Still pending:

- Full backend endpoint suite into `TEST_REPORT-CODEX.md`.
- Playwright/Electron UI E2E for boot, import, threads, terminal, git panel,
  settings, GitHub auth, and voice upload.
