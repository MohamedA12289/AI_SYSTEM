"""Batch B smoke test."""
import os, sys, traceback
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

# pr_tools
def t_pr():
    import pr_tools
    assert callable(pr_tools.run_pr_op)
    assert callable(pr_tools.pr_describe)
    # Empty diff path doesn't call AI
    out = pr_tools.pr_describe("")
    assert "text" in out
check("pr_tools", t_pr)

# lsp_client
def t_lsp():
    import lsp_client
    assert callable(lsp_client.run_lsp_op)
    avail = lsp_client.run_lsp_op("smoke", "available", {})
    assert isinstance(avail, dict) and "python" in avail
    print(f"  lsp available={avail}")
check("lsp_client", t_lsp)

# subagent (no network: just verify import + signature; don't actually call AI)
def t_subagent():
    import subagent
    assert callable(subagent.run_subagent)
    assert callable(subagent.run_subagent_op)
    # list_roles op doesn't hit AI
    out = subagent.run_subagent_op("smoke", "list_roles", {})
    assert "roles" in out
    print(f"  subagent roles={len(out['roles'])}")
check("subagent", t_subagent)

# mcp_client
def t_mcp():
    import mcp_client
    assert callable(mcp_client.run_mcp_op)
    out = mcp_client.run_mcp_op("smoke", "list_servers", {})
    assert "available" in out
    print(f"  mcp available={out['available']} servers={out['servers']}")
check("mcp_client", t_mcp)

# skills
def t_skills():
    import skills_loader
    out = skills_loader.run_skill_op("smoke", "list", {})
    assert "skills" in out
    names = [s["name"] for s in out["skills"]]
    for must in ("frontend", "backend-api", "code-reviewer"):
        assert must in names, f"missing skill {must} in {names}"
    print(f"  skills={names}")
check("skills_loader", t_skills)

# browser
def t_browser():
    import browser_tools
    out = browser_tools.run_browser_op("smoke", "available", {})
    assert "available" in out
    print(f"  browser available={out['available']}")
check("browser_tools", t_browser)

# agent_tools dispatch wired
def t_dispatch():
    import agent_tools
    schema = agent_tools.TOOL_SCHEMA_TEXT
    for tok in ("pr", "lsp", "subagent", "mcp", "skill", "browser"):
        assert tok in schema, f"{tok} missing"
    # invoke pr/lsp/skill via dispatch (read-only ops)
    res = agent_tools.execute_agent_action("smoke", {"action": "skill", "args": {"op": "list"}})
    assert res.get("executed") and res.get("action") == "skill"
    res2 = agent_tools.execute_agent_action("smoke", {"action": "lsp", "args": {"op": "available"}})
    assert res2.get("executed") and res2.get("action") == "lsp"
    res3 = agent_tools.execute_agent_action("smoke", {"action": "mcp", "args": {"op": "list_servers"}})
    assert res3.get("executed") and res3.get("action") == "mcp"
    res4 = agent_tools.execute_agent_action("smoke", {"action": "browser", "args": {"op": "available"}})
    assert res4.get("executed") and res4.get("action") == "browser"
    print(f"  dispatch ok (skill+lsp+mcp+browser)")
check("agent_tools_dispatch", t_dispatch)

# main app still importable
def t_main():
    import main
    assert getattr(main, "app", None) is not None
check("main_imports", t_main)

print("\n=== Batch B Smoke Test Results ===")
ok = sum(1 for _,s,_ in results if s == "OK")
fail = sum(1 for _,s,_ in results if s == "FAIL")
for name, status, msg in results:
    print(f"  [{status}] {name}{(' - ' + msg) if msg else ''}")
print(f"\n{ok} OK / {fail} FAIL")
sys.exit(0 if fail == 0 else 1)
