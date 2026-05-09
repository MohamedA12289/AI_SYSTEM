"""Batch A smoke test: import every new module and exercise basic functions."""
import os, sys, tempfile, traceback, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

results = []

def check(name, fn):
    try:
        fn()
        results.append((name, "OK", ""))
    except Exception as e:
        results.append((name, "FAIL", f"{type(e).__name__}: {e}"))
        traceback.print_exc()

# 1. code_chunker
def t_chunker():
    import code_chunker
    txt = "def foo():\n    return 1\n\nclass Bar:\n    def baz(self):\n        return 2\n"
    chunks = code_chunker.chunk_text("test.py", txt)
    assert isinstance(chunks, list) and len(chunks) >= 1, f"got {chunks!r}"
    print(f"  chunker ts_available={code_chunker.is_tree_sitter_available()} chunks={len(chunks)}")
check("code_chunker", t_chunker)

# 2. compression
def t_compression():
    import compression
    msgs = [{"role": "user", "content": "hello " * 5000}, {"role": "assistant", "content": "hi"}]
    n = compression.messages_token_count(msgs)
    assert n > 0
    out = compression.compress_messages(msgs, max_tokens=100, keep_recent=1)
    assert isinstance(out, list) and len(out) <= len(msgs)
    print(f"  compression in_tok={n} out_msgs={len(out)}")
check("compression", t_compression)

# 3. edit_tools
def t_edit_tools():
    import edit_tools
    assert callable(edit_tools.edit_file)
    assert callable(edit_tools.preview_edit_file)
check("edit_tools", t_edit_tools)

# 4. git_tools
def t_git_tools():
    import git_tools
    assert callable(git_tools.run_git_op)
check("git_tools", t_git_tools)

# 5. plan_store
def t_plan_store():
    import plan_store
    with tempfile.TemporaryDirectory() as td:
        # plan_store uses memory/projects/<name>/plans.sqlite — patch base if it has one
        os.environ["CUBOS_MEMORY_ROOT"] = td
        try:
            r = plan_store.run_plan_op("smoke_proj", "create", {"title": "Test plan"})
        except TypeError:
            # signature might differ; try alt
            r = plan_store.run_plan_op("smoke_proj", "create", title="Test plan")
        assert isinstance(r, dict)
        print(f"  plan_store create -> {list(r.keys())}")
check("plan_store", t_plan_store)

# 6. role_prompts
def t_role_prompts():
    import role_prompts
    roles = role_prompts.list_roles()
    assert isinstance(roles, list) and len(roles) >= 5, f"only {len(roles)} roles"
    sample = role_prompts.get_role_prompt(roles[0])
    assert isinstance(sample, str) and len(sample) > 0
    print(f"  role_prompts {len(roles)} roles")
check("role_prompts", t_role_prompts)

# 7. settings_store providers
def t_settings():
    import settings_store
    assert hasattr(settings_store, "VALID_PROVIDERS")
    vp = settings_store.VALID_PROVIDERS
    for p in ("ollama", "groq", "openai", "anthropic", "openrouter"):
        assert p in vp, f"missing {p}"
    assert callable(settings_store.list_provider_models)
    print(f"  providers={sorted(vp)}")
check("settings_store", t_settings)

# 8. ai_client provider handlers
def t_ai_client():
    import ai_client
    assert hasattr(ai_client, "_PROVIDER_HANDLERS"), "missing _PROVIDER_HANDLERS"
    h = ai_client._PROVIDER_HANDLERS
    for p in ("ollama", "groq", "openai", "anthropic", "openrouter"):
        assert p in h, f"handler missing for {p}"
        call_fn, stream_fn = h[p]
        assert callable(call_fn) and callable(stream_fn)
    print(f"  ai_client handlers={sorted(h.keys())}")
check("ai_client", t_ai_client)

# 9. agent_tools wired
def t_agent_tools():
    import agent_tools
    schema = agent_tools.TOOL_SCHEMA_TEXT
    for tok in ("edit_file", "git", "plan"):
        assert tok in schema, f"{tok} missing from TOOL_SCHEMA_TEXT"
check("agent_tools", t_agent_tools)

# 10. main importable (FastAPI app construction)
def t_main():
    import main
    app = getattr(main, "app", None)
    assert app is not None
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in ("/settings/providers", "/settings/provider/model", "/roles"):
        assert p in paths, f"route {p} missing (have {sorted(paths)[:20]}...)"
    print(f"  main routes_total={len(paths)}")
check("main", t_main)

# Report
print("\n=== Batch A Smoke Test Results ===")
ok = sum(1 for _,s,_ in results if s == "OK")
fail = sum(1 for _,s,_ in results if s == "FAIL")
for name, status, msg in results:
    print(f"  [{status}] {name}{(' - ' + msg) if msg else ''}")
print(f"\n{ok} OK / {fail} FAIL")
sys.exit(0 if fail == 0 else 1)
