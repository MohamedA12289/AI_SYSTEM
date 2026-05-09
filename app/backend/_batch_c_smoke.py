"""Batch C smoke test: voice, vision, slash, history, themes."""
from __future__ import annotations

import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(__file__))

PASS = []
FAIL = []


def t(name, fn):
    try:
        fn()
        PASS.append(name)
        print(f"PASS  {name}")
    except Exception as e:
        FAIL.append((name, e))
        print(f"FAIL  {name}: {e}")
        traceback.print_exc()


def test_voice_imports():
    import voice_tools
    assert hasattr(voice_tools, "run_voice_op")
    assert hasattr(voice_tools, "list_installed_voices")
    assert hasattr(voice_tools, "transcribe_bytes")
    res = voice_tools.run_voice_op("_test", "voices_installed", {})
    assert isinstance(res, dict)
    res2 = voice_tools.run_voice_op("_test", "stt_available", {})
    assert "available" in res2


def test_vision_imports():
    import vision_tools
    assert hasattr(vision_tools, "run_vision_op")
    assert hasattr(vision_tools, "ask_with_images")


def test_slash_commands():
    import slash_commands
    res = slash_commands.run_slash_op("list")
    assert res["ok"] is True
    assert isinstance(res["commands"], list)


def test_slash_create_run_delete():
    import slash_commands
    body = "    return {'ok': True, 'echo': args, 'ctx_keys': list(ctx.keys())}"
    create = slash_commands.run_slash_op("create", name="smoketest", body=body, description="smoke")
    assert create["ok"], create
    run = slash_commands.run_slash_op("run", name="smoketest", args="hello", ctx={"x": 1})
    assert run.get("ok") is True, run
    assert run.get("echo") == "hello"
    delete = slash_commands.run_slash_op("delete", name="smoketest")
    assert delete["ok"] is True


def test_prompt_history():
    import prompt_history
    pid = prompt_history.add_entry("smoke test entry", session_id="s_smoke", role="user")
    assert pid > 0
    entries = prompt_history.list_entries(limit=5, session_id="s_smoke")
    assert any(e["id"] == pid for e in entries)
    found = prompt_history.search("smoke test entry")
    assert any(e["id"] == pid for e in found)
    d = prompt_history.delete_entry(pid)
    assert d["ok"] is True


def test_history_op_dispatch():
    from prompt_history import run_history_op
    a = run_history_op("add", content="dispatch test", session_id="s_disp")
    assert a["ok"] is True
    l = run_history_op("list", session_id="s_disp", limit=3)
    assert l["ok"] is True
    run_history_op("clear", session_id="s_disp")


def test_themes_list_and_active():
    import theme_store
    res = theme_store.run_theme_op("list")
    assert res["ok"] is True
    names = {t["name"] for t in res["themes"]}
    assert "dark" in names and "light" in names and "midnight" in names
    active = theme_store.run_theme_op("active")
    assert active["ok"] is True


def test_themes_set_and_save():
    import theme_store
    set_res = theme_store.run_theme_op("set_active", name="light")
    assert set_res["ok"] is True
    save_res = theme_store.run_theme_op(
        "save",
        name="smoketheme",
        data={"label": "Smoke", "colors": {"bg": "#000", "fg": "#fff"}},
    )
    assert save_res["ok"] is True
    got = theme_store.run_theme_op("get", name="smoketheme")
    assert got["ok"] is True
    theme_store.run_theme_op("delete", name="smoketheme")
    theme_store.run_theme_op("set_active", name="dark")


def test_agent_dispatch_wired():
    import agent_tools
    src = open(agent_tools.__file__, encoding="utf-8").read()
    for tok in ['action == "voice"', 'action == "vision"', 'action == "slash"', 'action == "history"', 'action == "theme"']:
        assert tok in src, f"missing dispatch: {tok}"


def test_main_routes_wired():
    import main
    routes = {getattr(r, "path", "") for r in main.app.routes}
    for p in ["/themes", "/themes/active", "/slash/commands", "/slash/run", "/history", "/history/search", "/voice/voices", "/voice/transcribe", "/ws/voice"]:
        assert p in routes, f"missing route: {p}"


if __name__ == "__main__":
    t("voice_imports", test_voice_imports)
    t("vision_imports", test_vision_imports)
    t("slash_commands_list", test_slash_commands)
    t("slash_create_run_delete", test_slash_create_run_delete)
    t("prompt_history", test_prompt_history)
    t("history_op_dispatch", test_history_op_dispatch)
    t("themes_list_active", test_themes_list_and_active)
    t("themes_set_save", test_themes_set_and_save)
    t("agent_dispatch_wired", test_agent_dispatch_wired)
    t("main_routes_wired", test_main_routes_wired)
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    sys.exit(0 if not FAIL else 1)
