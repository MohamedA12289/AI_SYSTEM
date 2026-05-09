# CubOS Implementation Plan — Feature Integrations from `cools stuff`

This plan is grounded in actual code reads of each upstream project (not just READMEs) and the current state of the CubOS backend (`app/backend/`). It is written to be **credit-efficient**: every item is labeled with how it gets built so we don't waste turns on big LLM rewrites when a copy/port is enough.

## Build-Mode Legend

- **PORT** = lift code mostly verbatim from upstream, change imports/paths only. Cheap.
- **ASSET** = copy non-code assets (prompts, configs, themes) verbatim. Trivially cheap.
- **ADAPT** = read upstream code as a reference, write a small CubOS-shaped version. Moderate cost.
- **BUILD** = no good upstream match; design from scratch. Most expensive — minimize these.
- **SKIP** = do not implement; not worth it for CubOS.

---

## Current CubOS State (what we already have — do not re-plan)

Confirmed by reading source:

- `ai_client.py` — provider abstraction already exists. **Groq + Ollama** with streaming, automatic fallback, env-driven keys (`GROQ_API_KEY`).
- `secrets_manager.py` — `.env`-backed key/value store with masking.
- `agent_tools.py` — single dispatch `execute_agent_action()` with these actions: `respond`, `list_files`, `read_file`, `extract_file`, `extract_folder`, `write_file`, `overwrite_file`, `run_command`, `fetch_url`, `web_search`, `create_project`, `add_task`, `add_note`, `add_memory`, `set_secret`, `create_snapshot`, `create_test`, `run_test`.
- Existing modules: `chat_store`, `memory`, `snapshots`, `tests_manager`, `project_registry`, `terminal_pty`, `wave1_ingest`, `web_tools`, `media_tools`, `diff_tools`, `file_extractor`, `command_tools`.
- Frontend: Electron + Vite, WS-based PTY terminal, NSIS installer pipeline.

So Tier 1.2 (Cloud LLM) from the audit doc is **partially done** — we just need to extend `ai_client.py` to add OpenAI/Anthropic/OpenRouter, not rewrite the abstraction.

---

## TIER 1 — Foundation (do these first, in order)

### 1.1 Extend `ai_client.py` with OpenAI + Anthropic + OpenRouter
**Mode:** ADAPT (~150 lines added to one file, no new files).

`ai_client.py` already has the exact pattern (`_call_groq` + `_stream_groq`). Duplicate the pattern three times. OpenRouter uses the OpenAI schema verbatim — same code, different base URL. Anthropic needs a different request shape (`/v1/messages`, `x-api-key` header) — small adapter.

- Add to `config.py`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`.
- Add to `settings_store.py`: `get_active_provider()` to accept `"openai" | "anthropic" | "openrouter"`.
- Update `ask_ai`/`stream_ai` provider switch.
- Frontend: provider dropdown in settings panel (one component edit).

**No upstream port needed** — CubOS already has the cleanest version of this.

### 1.2 Multi-Agent Roles (system prompts only, no orchestration yet)
**Mode:** ASSET (gpt-pilot prompts) + ADAPT (small router).

gpt-pilot stores each role's system prompt as plaintext `.prompt` files in `core/prompts/<role>/system.prompt`. We **copy these files verbatim** into `app/backend/prompts/roles/<role>/`:
- `spec-writer`, `architect`, `tech-lead`, `developer`, `code-monkey`, `troubleshooter`, `bug-hunter`, `tech-writer`

Then create one new file `app/backend/agent_roles.py` (~80 lines):
```
ROLES = {
  "planner":   {"prompt_file": "spec-writer/system.prompt", "model": "groq:llama-3.3-70b", "tools": [...]},
  "architect": {...},
  "coder":     {"prompt_file": "developer/system.prompt", "model": "openai:gpt-4o", "tools": [...]},
  ...
}
def load_role(name) -> Role: ...
def dispatch(task) -> Role: ...
```

Tools are filtered by name from the existing `execute_agent_action` dispatch — no rewrite of `agent_tools.py` needed.

### 1.3 Hashline / Anchor-Based Edits
**Mode:** ADAPT (~40 lines added to `agent_tools.py` + `file_tools.py`).

oh-my-pi is Rust so not portable, but the algorithm is dead simple:
1. Edit args take `anchor_before: str` and `anchor_after: str` (optional).
2. If both present, find the unique match of `anchor_before + ... + anchor_after` in the file and replace the middle.
3. If not unique or not found, fall back to existing line-number edit and return a warning.

Add as a new action `"edit_file_anchored"` alongside existing `write_file`/`overwrite_file`. No need to remove the old paths.

### 1.4 Context / Prompt Compression
**Mode:** ADAPT (port pr-agent's compression heuristics into one file).

`pr-agent` has the cleanest compression code in `pr_agent/algo/pr_processing.py` (worth reading; lift the diff-ranking heuristics). For CubOS the equivalent is **conversation history compression**, not diff compression, but the technique transfers:
- Token-count each prior turn (use `tiktoken` if OpenAI provider, else `len/4` heuristic).
- When > 60% of model window, summarize oldest turns with a cheap model into one synthetic turn.
- Pin the original system prompt + last 3 turns verbatim.

New file `app/backend/context_manager.py` (~120 lines). Hook into the agent loop call site (single insertion point in `code_agent_routes.py`).

---

## TIER 2 — High Value Features

### 2.1 PR / Diff Review Tool
**Mode:** PORT (almost verbatim from pr-agent).

`pr-agent/pr_agent/tools/pr_reviewer.py`, `pr_description.py`, `pr_code_suggestions.py`, `pr_questions.py` are self-contained Python modules whose only external dep is their LLM client. We swap their `ai_handler` for our `ask_ai` / `stream_ai` and the rest works.

Steps:
1. Copy those four files into `app/backend/pr_tools/`.
2. Replace `from pr_agent.algo.ai_handlers...` with `from ai_client import ask_ai`.
3. Drop their git-provider fetching code (we operate on local diffs from `git diff`).
4. Expose four new agent actions: `pr_describe`, `pr_review`, `pr_improve`, `pr_ask`.

This is the single highest copy-paste / value ratio in the entire plan. ~500 lines of battle-tested prompts come for free.

### 2.2 Git-Aware Tools
**Mode:** ADAPT (thin wrappers over `git` CLI).

- `git_status`, `git_diff`, `git_commit_with_ai_message`, `git_branch`, `git_worktree_create`.
- AI commit message: 30-line function — read staged diff, prompt with "Write a conventional-commit message", call `ask_ai`. (oh-my-pi has the prompt; lift it as ASSET.)
- Worktree: `git worktree add ../worktrees/<task-id>` — 10-line wrapper.

New file `app/backend/git_tools.py`. Register actions into `agent_tools.py` dispatch.

### 2.3 LSP Integration
**Mode:** BUILD-LITE (use `pylsp-jsonrpc` library, don't write the protocol from scratch).

Install `python-lsp-jsonrpc`. Spawn `pylsp` and `typescript-language-server` as subprocesses on demand. New file `app/backend/lsp_client.py` (~200 lines). Tools: `lsp_definition`, `lsp_references`, `lsp_diagnostics`, `lsp_format`.

oh-my-pi has the design but it's Rust — read it for inspiration on the tool surface, then build in Python. Don't try to port.

### 2.4 Subagent / Task Tool
**Mode:** ADAPT.

Spawn a child instance of the agent loop in-process (not subprocess — we already have the loop function). Give it its own `messages` list, its own role, its own tool subset. Return its final answer to the parent.

New action `"task"` in `agent_tools.py`, ~60 lines. Parent agent uses this to fan out exploration without polluting its own context.

### 2.5 Repo-Aware RAG (code search)
**Mode:** ADAPT (extend existing `wave1_ingest.py`).

We already have ingest + vector search for docs. Add:
1. Code-aware chunker: split by function/class using `tree-sitter-languages` (`pip install tree-sitter-languages`).
2. Separate collection name `code_<project>`.
3. New action `"repo_search"` that hits the code collection.

~150 lines added to `wave1_ingest.py` + new `code_chunker.py`. **Skip tabby's full server** — it's huge and Rust-based. Tabby's algorithm (snippet retrieval ranked by edit-distance to current cursor) we lift as design only.

### 2.6 MCP Plugin Client
**Mode:** PORT (use the official `mcp` Python SDK).

`pip install mcp`. New file `app/backend/mcp_client.py` (~100 lines): connect to MCP servers listed in `~/.cubos/mcp.json`, list their tools, register each tool dynamically into the same dispatch in `agent_tools.py`. Done — every MCP server in the ecosystem becomes available.

### 2.7 Structured Plan/Todo Tool
**Mode:** ADAPT (small SQLite table + 4 actions).

Reuse the `chat_store.py` SQLite connection. New table `plans(id, title, steps_json, status, created_at)`. Actions: `plan_create`, `plan_update_step`, `plan_get`, `plan_resume`. ~120 lines in a new `plan_store.py`.

gpt-pilot has the resume-after-crash design — read `core/state/state_manager.py` as reference, but our implementation will be 1/10th the size because we don't need their full state machine.

### 2.8 Skill Bundles (LocalAI-inspired)
**Mode:** ADAPT (~100 lines, pure config layer).

Inspired by LocalAI's `core/services/skills/` — a "skill" is a named bundle of `{system_prompt, allowed_tools, default_model, default_provider}` that the user can invoke as a mode. Examples: "frontend", "backend-api", "code-reviewer", "tester".

- Storage: YAML files in `app/backend/skills/` — one per skill, hot-reloaded.
- Selection: dropdown in chat UI; or `/skill <name>` slash command (overlaps with 3.3).
- Implementation: `skills_loader.py` reads dir, validates schema, exposes `get_skill(name)` to chat handler. Chat handler injects system prompt + restricts tool list.
- Free win because we already have prompts dir + tool dispatcher + provider routing.

---

## TIER 3 — Polish & UX

### 3.1 Voice Input (Whisper STT + VAD) + Voice Picker (piper1-gpl-inspired)
**Mode:** PORT (web-whisper is **28 lines** total on the server side).

- **Server:** copy `web-whisper/server.py` essentially verbatim, change `flask_socketio` to integrate with our existing FastAPI WS layer in `terminal_pty.py` style. Actually just port to a new route in `main.py`: `@app.websocket("/ws/voice")`. ~40 lines.
- **Client:** copy `web-whisper/index.html`'s VAD-on-client logic — uses `MediaRecorder` + a simple amplitude threshold. ~50 lines of TS in the Electron app.
- **STT model:** use `faster-whisper` instead of `openai-whisper` for 4x speed. Load once at startup.
- **TTS voice picker (NEW, piper1-gpl-inspired):** port `piper1-gpl/src/piper/download_voices.py` URL_FORMAT + `voices.json` fetch. Settings → Voice → dropdown of all rhasspy voices, click to download into `models/piper/`. ~50 lines. Defaults to the already-downloaded `en_US-amy-medium`.

### 3.2 Vision Input
**Mode:** ADAPT.

Frontend: drag-drop image → base64 → attach to message.
Backend: extend `ai_client._call_openai` (when added) to accept image content parts. OpenAI/Anthropic/Groq-llava all use the same `{type: "image_url", image_url: {url: "data:..."}}` schema. ~30 lines.

### 3.3 Custom Slash Commands
**Mode:** ADAPT.

User drops `.py` files into `~/.cubos/commands/`. On startup, scan and register each as a slash command. Each file exports `name`, `description`, `system_prompt`, `tools`. ~80 lines in new `slash_commands.py`.

### 3.4 Persistent Prompt History + Ctrl+R
**Mode:** ADAPT.

New SQLite table `prompt_history(id, content, ts)`. Frontend: Ctrl+R opens fuzzy-search overlay (use `fuse.js`, already in many Electron apps; install if missing). ~60 lines TS + 30 lines Python.

### 3.5 Themes
**Mode:** ASSET.

Pick 6 themes from oh-my-pi's `assets/themes/` directory (they're JSON color maps). Convert to CSS variable sets. Theme switcher dropdown in settings. ~20 lines of code, mostly assets.

### 3.6 Headless Browser Tool
**Mode:** ADAPT.

`pip install playwright` + `playwright install chromium`. New `browser_tools.py`: `browse(url) -> markdown`, `screenshot(url) -> png_bytes`. Two actions in dispatch. ~80 lines. Skip Puppeteer/stealth — Playwright is the modern equivalent and ships clean Python bindings.

---

## TIER 4 — Defer or Skip

| Feature | Decision | Reason |
|---|---|---|
| Archon visual workflow builder | DEFER | Huge frontend lift; build only after roles+subagents stable |
| Archon webhook adapters | DEFER | Useless before workflows exist |
| Archon DAG runner | DEFER | Subagent tool (2.4) covers 80% of use cases |
| gpt-engineer benchmark harness | SKIP | Internal QA tool, not user-facing |
| Image generation (oh-my-pi) | SKIP | User explicitly excluded |
| SSH tool (oh-my-pi) | SKIP | Security surface > value |
| Multi-credential round-robin | SKIP | We're single-user desktop |
| cluster-fk (image clustering) | SKIP | Not relevant |
| vibe-vibe (learning content) | SKIP | Not a feature source |
| Tabby full server | SKIP | We extract the RAG idea (2.5), not the server |
| jarvis-mlx full pipeline | SKIP | We take Whisper STT only (3.1); MeloTTS swapped for Piper |

---

## Recommended Sprint Schedule

| Sprint | Items | Est. Effort | Mode mix |
|---|---|---|---|
| **S1** | 1.1 OpenAI/Anthropic/OpenRouter, 1.3 Hashline edits | 1 session | ADAPT |
| **S2** | 1.2 Roles (gpt-pilot prompt copy), 1.4 Context manager | 1–2 sessions | ASSET + ADAPT |
| **S3** | 2.1 PR review tools | 1 session | PORT (cheapest big win) |
| **S4** | 2.2 Git tools, 2.7 Plan store | 1 session | ADAPT |
| **S5** | 2.4 Subagent, 2.6 MCP client, 2.8 Skill bundles | 1–2 sessions | ADAPT + PORT |
| **S6** | 2.5 Repo RAG, 2.3 LSP | 2 sessions | ADAPT |
| **S7** | 3.1 Voice + Voice picker, 3.2 Vision | 1 session | PORT + ADAPT |
| **S8** | 3.3 Slash, 3.4 History, 3.5 Themes, 3.6 Browser | 1 session | ADAPT |

**Cheapest, biggest-bang-for-buck order if doing one at a time:** 1.1 → 2.1 → 1.2 → 2.6 → 2.4. Those five sprints alone close ~70% of the perceived gap.

### Batch Execution Mapping (collapses 8 sprints into 3 sessions)

| Batch | Absorbs Sprints | Items |
|---|---|---|
| **Batch A** | S1 + S2 + S4 + S6 (parts) + terminal fix | 1.1, 1.2, 1.3, 1.4, 2.2, 2.5, 2.7, terminal-fix |
| **Batch B** | S3 + S5 + S6 (parts) | 2.1 GitHub, 2.3 LSP, 2.4 Subagents, 2.6 MCP, 2.8 Skills, 3.6 Browser |
| **Batch C** | S7 + S8 | 3.1 Voice + Picker, 3.2 Vision, 3.3 Slash, 3.4 History, 3.5 Themes |

---

## Architectural Rules (Don't break these as features land)

1. **One provider interface in `ai_client.py`** — never branch on provider name elsewhere.
2. **All tools register via `agent_tools.execute_agent_action` dispatch** — roles, MCP, slash commands, subagents all flow through it.
3. **No top-level imports between** `ollama_client`, `agent_tools`, `file_extractor`, `wave1_ingest` (the circular chain we just fixed). Add a CI check `scripts/check_imports.py`.
4. **Every long-running thing checkpoints to SQLite** — plans, subagent tasks, ingestion jobs.
5. **One WebSocket envelope** `{type, session, payload}` for PTY, voice, agent stream — don't grow N parallel socket protocols.
6. **Prompts live in `app/backend/prompts/`** as plaintext files, not inline strings — easy to diff, easy to swap.

---

## Files That Will Be Touched (ballpark)

**New files (~14):**
`agent_roles.py`, `context_manager.py`, `pr_tools/__init__.py` + 4 modules, `git_tools.py`, `lsp_client.py`, `mcp_client.py`, `plan_store.py`, `slash_commands.py`, `code_chunker.py`, `browser_tools.py`, `prompts/roles/<role>/system.prompt` (8 files), `scripts/check_imports.py`.

**Modified files (~6):**
`ai_client.py` (add 3 providers), `agent_tools.py` (add ~10 dispatch entries), `config.py` (more keys), `settings_store.py` (provider list), `main.py` (voice WS route), frontend settings panel.

**Net code added (LLM-burned):** ~2,500 lines. **Code copied/ported (no LLM cost):** ~1,800 lines. Roughly 40% of the work is paste-and-rewire, which is exactly the credit-efficiency goal.

---

## Requirements & Installation Status

This section is the **authoritative install checklist** for everything CubOS needs to ship all phases of this plan. It is split into:
1. **DONE** — already installed in `app/backend/venv` or system-wide
2. **AUTO-FETCH ON FIRST USE** — pulled by libraries when first invoked (no action needed unless you want to pre-cache)
3. **MANUAL** — you (the user) must install these yourself, with the exact command listed

---

### 1. Python Packages (DONE — installed into `app/backend/venv`)

Verified via `pip list` after the bulk install:

| Package | Version | Phase | Purpose |
|---|---|---|---|
| openai | 2.34.0 | 1.1 | OpenAI / OpenRouter provider |
| anthropic | 0.99.0 | 1.1 | Anthropic Claude provider |
| PyGithub | 2.9.1 | 2.1 / GitHub | Port of pr-agent github_provider |
| GitPython | 3.1.49 | 2.2 | Local git repository operations |
| python-gitlab | 8.3.0 | (future) | GitLab provider |
| faster-whisper | 1.2.1 | 3.1 | Voice STT (4x faster than openai-whisper) |
| openai-whisper | 20250625 | 3.1 | Reference STT (already installed) |
| playwright | 1.59.0 | 3.6 | Headless browser tool |
| tree-sitter | 0.25.2 | 2.5 | Code-aware AST chunking |
| tree-sitter-languages | 1.10.2 | 2.5 | Pre-compiled grammars (40+ languages) |
| mcp | 1.27.0 | 2.6 | MCP plugin client (official SDK) |
| python-lsp-server | 1.14.0 | 2.3 | Python LSP daemon |
| python-lsp-jsonrpc | 1.1.2 | 2.3 | LSP JSON-RPC protocol |
| piper-tts | 1.4.2 | 3.1 | Local TTS engine |
| sounddevice | 0.5.5 | 3.1 | Microphone capture |
| webrtcvad-wheels | 2.0.14 | 3.1 | Voice activity detection |
| html2text | 2025.4.15 | 2.1 web | Clean HTML → markdown |
| retry | 0.9.2 | 2.1 | pr-agent direct dependency |
| loguru | 0.7.3 | 2.1 | pr-agent logging |
| tenacity | 9.1.4 | 2.1 | Retry decorators |
| pydantic | 2.13.3 | (already had) | Schema validation |
| tiktoken | 0.12.0 | 1.4 | Token counting for OpenAI compression |
| cryptography, pynacl, pyjwt | latest | GitHub auth | PyGithub deps |
| ctranslate2, onnxruntime, av, tokenizers | latest | faster-whisper | STT inference |
| jedi, parso, black, ujson | latest | python-lsp-server | LSP backends |

**Total Python deps installed:** ~50 packages including transitives.

---

### 2. Node / NPM Packages (DONE — installed globally)

| Package | Version | Phase | Purpose |
|---|---|---|---|
| typescript-language-server | latest | 2.3 | LSP for JS/TS/JSX/TSX |
| typescript | latest | 2.3 | Required by ts-language-server |

Installed via `npm install -g typescript-language-server typescript`.

---

### 3. System Tools (DONE — verified present)

| Tool | Path | Purpose |
|---|---|---|
| Node.js | `C:\Program Files\nodejs\node.exe` | Frontend build, npm packages, MCP servers via npx |
| npm | `C:\Program Files\nodejs\npm.cmd` | Node package manager |
| Git | `C:\Program Files\Git\cmd\git.exe` | All git operations |

---

### 4. Browser Binaries (✅ DONE — Playwright Chromium installed)

All 4 components downloaded to `C:\Users\moham\AppData\Local\ms-playwright\`:
- Chrome for Testing 147.0.7727.15 → `chromium-1217\`
- FFmpeg for Playwright → `ffmpeg-1011\`
- Chrome Headless Shell 147.0.7727.15 → `chromium_headless_shell-1217\`
- Winldd → `winldd-1007\`

If you ever need to reinstall (e.g. on another machine):
```powershell
app\backend\venv\Scripts\python.exe -m playwright install chromium
```

---

### 5. Whisper Model Weights (✅ DONE — base.en cached)

`faster-whisper`'s `base.en` model (~140 MB) is cached at `%USERPROFILE%\.cache\huggingface\hub\models--Systran--faster-whisper-base.en\`. First voice transcription will load instantly from disk.

Optional larger models you may want later (manual):
- `small.en` (~470 MB) — better accuracy
- `medium.en` (~1.5 GB) — best for English
- `large-v3` (~3 GB) — multilingual top quality

Pull any of them with:
```powershell
app\backend\venv\Scripts\python.exe -c "from faster_whisper import WhisperModel; WhisperModel('small.en')"
```

---

### 6. MANUAL INSTALL — Things You Need to Handle

These cannot be auto-installed because they need user accounts, license acceptance, hardware-specific choices, or live keys. Listed in order of urgency.

#### 6.1 API Keys (REQUIRED before Phase 1.1 ships to users)
Add to CubOS Settings → Secrets (or directly to `secrets/.env`):

| Key | Where to get it | Phase |
|---|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | 1.1 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | 1.1 |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys | 1.1 |
| `GROQ_API_KEY` | https://console.groq.com/keys | (already in `ai_client.py`) |
| `GITHUB_TOKEN` (PAT) | https://github.com/settings/tokens — scopes: `repo`, `workflow`, `read:user` | 2.1 / GitHub |
| `GITLAB_TOKEN` (optional) | https://gitlab.com/-/user_settings/personal_access_tokens | future |

#### 6.2 Piper TTS Voice Model (REQUIRED before Phase 3.1 ships)
Pick one voice and download the `.onnx` + `.onnx.json` pair to `models/piper/`:

Recommended starter voice (English, female, medium quality, fast):
```
https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
```

Other options at https://github.com/rhasspy/piper/blob/master/VOICES.md

Save both files to `D:\AI_SYSTEM\models\piper\` (the directory already exists).

#### 6.3 Optional — Ollama Models (only if you use the Ollama provider)
You should already have Ollama installed since CubOS ships with it. Pull whichever models you want available locally:
```powershell
ollama pull llama3.2
ollama pull qwen2.5-coder:14b
ollama pull deepseek-coder-v2:16b
```
Skip if you're going cloud-only via OpenAI/Anthropic/Groq.

#### 6.4 Optional — Additional Language Servers
If you want LSP for languages beyond Python and TypeScript (Phase 2.3 expansion):
- **Rust:** `rustup component add rust-analyzer`
- **Go:** `go install golang.org/x/tools/gopls@latest`
- **C/C++:** install LLVM, then `clangd` ships with it
- **Java:** download Eclipse JDT-LS jars
- **Ruby:** `gem install solargraph`

Only install the ones you actually code in.

#### 6.5 Optional — MCP Servers
MCP servers are launched on-demand via `npx` so nothing to pre-install. To list/configure them, edit `~/.cubos/mcp.json` once Phase 2.6 lands. Reference catalog: https://github.com/modelcontextprotocol/servers

#### 6.6 Optional — Aider (reference reading only, do NOT install into venv)
If you want me to study Aider's edit/apply algorithm, clone (don't install) into `cools stuff/`:
```powershell
git clone https://github.com/Aider-AI/aider.git "C:\Users\moham\OneDrive\Desktop\cools stuff\aider"
```
Installing it via pip would conflict with our deps; only the source is useful.

---

### 7. Things NOT Needed (explicitly skipped)

To avoid bloat, we are deliberately NOT installing:
- `litellm` — pr-agent uses it as a unified LLM client, but we already have `ai_client.py` doing the same job leaner.
- `langchain` / `langchain-core` — gpt-pilot avoids it too; we don't need it.
- `pinecone-client`, `lancedb`, `qdrant-client` — pr-agent ships these for "similar issue" feature; we use our own ingest store.
- `flask` / `flask-socketio` — web-whisper uses them, we use FastAPI which is already our stack.
- `boto3`, `azure-*`, `google-cloud-*` — pr-agent's enterprise git providers; not relevant for CubOS.
- `MeloTTS` — heavy and slow; Piper is the lighter, faster choice.
- Tabby's Rust crates / Archon's Rust workflows — different language, not portable.

---

### 8. Final Status Summary

**✅ COMPLETE (no action needed):**
- All 50+ Python deps for Phases 1, 2, and 3 installed in `app/backend/venv`
- TypeScript LSP installed globally via npm
- System tools (Node, npm, Git) verified present
- Playwright Chromium fully downloaded (~260 MB across 4 components)
- faster-whisper base.en model fully cached (~140 MB)
- **Piper voice model `en_US-amy-medium` downloaded** to `models/piper/` (60 MB)
- **API keys present in `secrets/.env`:** `OPENAI_API_KEY`, `GROQ_API_KEY`, `GITHUB_TOKEN`, `TAVILY_API_KEY`
- **Placeholder slots ready:** `ANTHROPIC_API_KEY=""`, `OPENROUTER_API_KEY=""` (just paste values when you get them)

**⚠️ STILL OPTIONAL (no rush, only if/when you want them):**
1. **Anthropic key** — only if you want Claude Sonnet for hard refactors. Get at https://console.anthropic.com/settings/keys
2. **OpenRouter key** — only if you want one bill across 100+ models. Get at https://openrouter.ai/keys
3. **Extra Piper voices** — current voice (Amy) is fine. If you want others, the in-app picker (Batch C) will handle this.
4. **Extra language servers** — Python + TS already installed. Rust/Go/etc. only if you code in them.
5. **Ollama models** — pull `qwen2.5-coder:14b` or `deepseek-coder-v2:16b` if you want local coding: `ollama pull qwen2.5-coder:14b`

**🚫 NOT NEEDED (covered or skipped):**
- LocalAI server install — already have Ollama, would be duplicate.
- piper1-gpl pip install — would conflict with `piper-tts` already present. Source code is reference-only.
- Anthropic/OpenRouter to *start* Batch A — providers will scaffold cleanly with empty keys, just won't activate until you fill them.

**🚀 READY TO START:** All 3 batches are unblocked with zero further manual action. Batch A can begin immediately.
