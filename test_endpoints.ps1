$base = "http://localhost:8000"
$errors = @()
$pass = 0
$fail = 0

function T {
    param($method, $url, $body = $null)
    try {
        $params = @{ Uri = $url; Method = $method; UseBasicParsing = $true; ErrorAction = "Stop" }
        if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 5); $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params
        return [int]$r.StatusCode
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { return 0 }
        return [int]$code
    }
}

$tests = @(
    @("GET",   "/"),
    @("GET",   "/projects"),
    @("POST",  "/projects/create",                              @{name="test-ep-proj"}),
    @("GET",   "/projects/test-ep-proj"),
    @("PATCH", "/projects/test-ep-proj",                        @{description="updated"}),
    @("GET",   "/project/test-ep-proj/scope"),
    @("GET",   "/project/test-ep-proj/chat"),
    @("GET",   "/project/test-ep-proj/messages"),
    @("POST",  "/project/test-ep-proj/messages",                @{role="user";content="hi"}),
    @("GET",   "/project/test-ep-proj/chat/summary"),
    @("POST",  "/project/test-ep-proj/chat/summary/refresh"),
    @("GET",   "/project/test-ep-proj/tasks"),
    @("POST",  "/project/test-ep-proj/tasks",                   @{title="t1";description="d"}),
    @("GET",   "/project/test-ep-proj/notes"),
    @("POST",  "/project/test-ep-proj/notes",                   @{title="n1";content="c"}),
    @("GET",   "/project/test-ep-proj/memory"),
    @("POST",  "/project/test-ep-proj/memory",                  @{content="mem1";tags=@()}),
    @("GET",   "/project/test-ep-proj/files"),
    @("GET",   "/project/test-ep-proj/approvals"),
    @("GET",   "/project/test-ep-proj/snapshots"),
    @("POST",  "/project/test-ep-proj/snapshots",               @{label="snap1"}),
    @("GET",   "/project/test-ep-proj/activity"),
    @("GET",   "/activity"),
    @("GET",   "/project/test-ep-proj/audit"),
    @("GET",   "/project/test-ep-proj/tests"),
    @("POST",  "/project/test-ep-proj/tests",                   @{name="t1";command="echo hi"}),
    @("GET",   "/project/test-ep-proj/search?q=test"),
    @("GET",   "/secrets"),
    @("POST",  "/secrets/TESTKEY",                              @{value="testval"}),
    @("POST",  "/secrets/TESTKEY/reveal"),
    @("DELETE","/secrets/TESTKEY"),
    @("GET",   "/settings"),
    @("POST",  "/settings",                                     @{theme="dark"}),
    @("GET",   "/models"),
    @("POST",  "/models/active",                                @{model="gpt-4o"}),
    @("GET",   "/ollama/models"),
    @("GET",   "/settings/provider"),
    @("POST",  "/settings/provider",                            @{provider="openai"}),
    @("GET",   "/groq/models"),
    @("POST",  "/groq/models/active",                           @{model="llama3-8b-8192"}),
    @("GET",   "/project/test-ep-proj/runs"),
    @("GET",   "/project/test-ep-proj/index/status"),
    @("POST",  "/project/test-ep-proj/index/trigger"),
    @("GET",   "/project/test-ep-proj/documents"),
    @("GET",   "/project/test-ep-proj/ingest/jobs"),
    @("GET",   "/project/test-ep-proj/github/status"),
    @("GET",   "/project/test-ep-proj/github/log"),
    @("GET",   "/project/test-ep-proj/github/branches"),
    @("GET",   "/project/test-ep-proj/github/diff"),
    @("GET",   "/project/test-ep-proj/settings/assistant-mode"),
    @("POST",  "/project/test-ep-proj/settings/assistant-mode", @{mode="assistant"}),
    @("POST",  "/project/test-ep-proj/github/init"),
    @("POST",  "/project/test-ep-proj/github/commit",           @{message="test"}),
    @("POST",  "/project/test-ep-proj/github/push"),
    @("POST",  "/project/test-ep-proj/github/pull"),
    @("POST",  "/project/test-ep-proj/github/branch",           @{name="test-branch"}),
    @("POST",  "/project/test-ep-proj/github/checkout",         @{branch="main"}),
    @("POST",  "/project/test-ep-proj/github/stash"),
    @("POST",  "/project/test-ep-proj/github/stash/pop"),
    @("POST",  "/project/test-ep-proj/web/fetch",               @{url="https://example.com"}),
    @("POST",  "/project/test-ep-proj/web/search",              @{query="test"}),
    @("POST",  "/project/test-ep-proj/command/run",             @{command="echo hello"}),
    @("POST",  "/project/test-ep-proj/ingest/file",             @{path="C:\fake\file.txt"}),
    @("POST",  "/project/test-ep-proj/ingest/folder",           @{path="C:\fake\folder"}),
    @("POST",  "/project/test-ep-proj/coagent/workspace-map"),
    @("POST",  "/project/test-ep-proj/coagent/file-targets",    @{goal="test"}),
    @("POST",  "/project/test-ep-proj/coagent/why-failing",     @{error="test error"}),
    @("POST",  "/project/test-ep-proj/coagent/wiring-trace",    @{feature="test"}),
    @("POST",  "/project/test-ep-proj/coagent/cleanup-scan"),
    @("POST",  "/project/test-ep-proj/coagent/api-contracts"),
    @("POST",  "/project/test-ep-proj/coagent/project-state"),
    @("POST",  "/project/test-ep-proj/coagent/run-command",     @{command="echo hi"}),
    @("POST",  "/project/test-ep-proj/coagent/coding-memory",   @{query="test"})
)

foreach ($t in $tests) {
    $method = $t[0]; $path = $t[1]; $body = if ($t.Count -gt 2) { $t[2] } else { $null }
    $url = "$base$path"
    $code = T -method $method -url $url -body $body
    $label = "$method $path"
    if ($code -ge 200 -and $code -lt 500) {
        $pass++
        Write-Host ("PASS [{0,3}] {1}" -f $code, $label)
    } else {
        $fail++
        $msg = "FAIL [{0,3}] {1}" -f $code, $label
        $errors += $msg
        Write-Host $msg -ForegroundColor Red
        if ($errors.Count -ge 5) {
            Write-Host "`n=== STOPPED AT 5 FAILURES ===" -ForegroundColor Yellow
            break
        }
    }
}

Write-Host "`n=== RESULT: $pass PASS  /  $fail FAIL  (of $($pass+$fail) run) ==="
if ($errors.Count -gt 0) {
    Write-Host "`nFailing endpoints:"
    $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
}
