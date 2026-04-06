import requests, sys

BASE = "http://localhost:8000"
PROJ = "test-ep-proj"

def t(method, path, json=None, expected_ok=True):
    url = BASE + path
    try:
        r = requests.request(method, url, json=json, timeout=10)
        return r.status_code
    except Exception as e:
        return f"ERR({e})"

tests = [
    ("GET",    "/"),
    ("GET",    "/projects"),
    ("POST",   "/projects/create",                                  {"project_name": PROJ}),
    ("GET",    f"/projects/{PROJ}"),
    ("PATCH",  f"/projects/{PROJ}",                                 {"description": "updated"}),
    ("GET",    f"/project/{PROJ}/scope"),
    ("GET",    f"/project/{PROJ}/chat"),
    ("GET",    f"/project/{PROJ}/messages"),
    ("POST",   f"/project/{PROJ}/messages",                         {"role": "user", "content": "hi"}),
    ("GET",    f"/project/{PROJ}/chat/summary"),
    ("POST",   f"/project/{PROJ}/chat/summary/refresh"),
    ("GET",    f"/project/{PROJ}/tasks"),
    ("POST",   f"/project/{PROJ}/tasks",                            {"title": "t1", "description": "d"}),
    ("GET",    f"/project/{PROJ}/notes"),
    ("POST",   f"/project/{PROJ}/notes",                            {"title": "n1", "content": "c"}),
    ("GET",    f"/project/{PROJ}/memory"),
    ("POST",   f"/project/{PROJ}/memory",                           {"content": "mem1", "tags": []}),
    ("GET",    f"/project/{PROJ}/files"),
    ("GET",    f"/project/{PROJ}/approvals"),
    ("GET",    f"/project/{PROJ}/snapshots"),
    ("POST",   f"/project/{PROJ}/snapshots",                        {"label": "snap1"}),
    ("GET",    f"/project/{PROJ}/activity"),
    ("GET",    "/activity"),
    ("GET",    f"/project/{PROJ}/audit"),
    ("GET",    f"/project/{PROJ}/tests"),
    ("POST",   f"/project/{PROJ}/tests",                            {"name": "t1", "command": "echo hi"}),
    ("GET",    f"/project/{PROJ}/search?q=test"),
    ("GET",    "/secrets"),
    ("POST",   "/secrets/TESTKEY",                                  {"value": "testval"}),
    ("POST",   "/secrets/TESTKEY/reveal"),
    ("DELETE", "/secrets/TESTKEY"),
    ("GET",    "/settings"),
    ("POST",   "/settings",                                         {"theme": "dark"}),
    ("GET",    "/models"),
    ("POST",   "/models/active",                                    {"model": "gpt-4o"}),
    ("GET",    "/ollama/models"),
    ("GET",    "/settings/provider"),
    ("POST",   "/settings/provider",                                {"provider": "openai"}),
    ("GET",    "/groq/models"),
    ("POST",   "/groq/models/active",                               {"model": "llama3-8b-8192"}),
    ("GET",    f"/project/{PROJ}/runs"),
    ("GET",    f"/project/{PROJ}/index/status"),
    ("POST",   f"/project/{PROJ}/index/trigger"),
    ("GET",    f"/project/{PROJ}/documents"),
    ("GET",    f"/project/{PROJ}/ingest/jobs"),
    ("GET",    f"/project/{PROJ}/github/status"),
    ("GET",    f"/project/{PROJ}/github/log"),
    ("GET",    f"/project/{PROJ}/github/branches"),
    ("GET",    f"/project/{PROJ}/github/diff"),
    ("GET",    f"/project/{PROJ}/settings/assistant-mode"),
    ("POST",   f"/project/{PROJ}/settings/assistant-mode",          {"mode": "assistant"}),
    ("POST",   f"/project/{PROJ}/github/init"),
    ("POST",   f"/project/{PROJ}/github/commit",                    {"message": "test"}),
    ("POST",   f"/project/{PROJ}/github/push"),
    ("POST",   f"/project/{PROJ}/github/pull"),
    ("POST",   f"/project/{PROJ}/github/branch",                    {"name": "test-branch"}),
    ("POST",   f"/project/{PROJ}/github/checkout",                  {"branch": "main"}),
    ("POST",   f"/project/{PROJ}/github/stash"),
    ("POST",   f"/project/{PROJ}/github/stash/pop"),
    ("POST",   f"/project/{PROJ}/web/fetch",                        {"url": "https://example.com"}),
    ("POST",   f"/project/{PROJ}/web/search",                       {"query": "test"}),
    ("POST",   f"/project/{PROJ}/command/run",                      {"command": "echo hello"}),
    ("POST",   f"/project/{PROJ}/ingest/file",                      {"path": "C:/fake/file.txt"}),
    ("POST",   f"/project/{PROJ}/ingest/folder",                    {"path": "C:/fake/folder"}),
    ("POST",   f"/project/{PROJ}/coagent/workspace-map"),
    ("POST",   f"/project/{PROJ}/coagent/file-targets",             {"goal": "test"}),
    ("POST",   f"/project/{PROJ}/coagent/why-failing",              {"error": "test error"}),
    ("POST",   f"/project/{PROJ}/coagent/wiring-trace",             {"feature": "test"}),
    ("POST",   f"/project/{PROJ}/coagent/cleanup-scan"),
    ("POST",   f"/project/{PROJ}/coagent/api-contracts"),
    ("POST",   f"/project/{PROJ}/coagent/project-state"),
    ("POST",   f"/project/{PROJ}/coagent/run-command",              {"command": "echo hi"}),
    ("POST",   f"/project/{PROJ}/coagent/coding-memory",            {"query": "test"}),
    ("DELETE", f"/projects/{PROJ}"),
]

passed = 0
failed = 0
failures = []

for entry in tests:
    method, path = entry[0], entry[1]
    body = entry[2] if len(entry) > 2 else None
    path_noqs = path.split("?")[0]
    code = t(method, path, body)
    is_pass = isinstance(code, int) and 200 <= code < 500
    label = f"{method:6} {path_noqs}"
    if is_pass:
        passed += 1
        print(f"PASS [{code:3}] {label}")
    else:
        failed += 1
        msg = f"FAIL [{code:3}] {label}"
        failures.append(msg)
        print(msg)
        if len(failures) >= 5:
            print("\n=== STOPPED: 5 failures reached ===")
            break

print(f"\n=== RESULT: {passed} PASS / {failed} FAIL (of {passed+failed} run) ===")
if failures:
    print("\nFailing endpoints:")
    for f_ in failures:
        print(f"  {f_}")
