import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("Codex frontend API contracts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes project imports through the canonical /projects/import route", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      imported: true,
      project: { project_name: "demo", display_name: "Demo", description: "", workspace_root: "D:\\demo" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await api.projects.importExisting({ source_path: "D:\\demo", display_name: "Demo" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:8000/projects/import");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toMatchObject({
      path: "D:\\demo",
      source_path: "D:\\demo",
      display_name: "Demo",
      access_mode: "import",
    });
  });

  it("resolves project git status through /api/git/status with workspace_root", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/projects/demo")) {
        return jsonResponse({ project_name: "demo", display_name: "Demo", description: "", workspace_root: "D:\\demo" });
      }
      if (url.includes("/api/git/status?")) {
        return jsonResponse({
          branch: "main",
          ahead: 1,
          behind: 0,
          staged: [{ file: "staged.ts", status: "M" }],
          unstaged: [{ file: "changed.ts", status: "M" }, { file: "new.ts", status: "U" }],
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.git.status("demo");

    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/git/status?project_path=D%3A%5Cdemo");
    expect(result.staged).toEqual(["staged.ts"]);
    expect(result.modified).toEqual(["changed.ts"]);
    expect(result.untracked).toEqual(["new.ts"]);
  });

  it("stages selected files before committing through /api/git/commit", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/projects/demo")) {
        return jsonResponse({ project_name: "demo", display_name: "Demo", description: "", workspace_root: "D:\\demo" });
      }
      if (url.endsWith("/api/git/stage")) {
        return jsonResponse({ success: true });
      }
      if (url.endsWith("/api/git/commit")) {
        return jsonResponse({ success: true, message: "Commit created" });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.git.commit("demo", "Codex contract test", ["changed.ts"]);

    const stageOptions = (fetchMock.mock.calls as any[])[1][1] as RequestInit;
    const commitOptions = (fetchMock.mock.calls as any[])[2][1] as RequestInit;

    expect(JSON.parse(String(stageOptions.body))).toEqual({
      project_path: "D:\\demo",
      files: ["changed.ts"],
    });
    expect(JSON.parse(String(commitOptions.body))).toEqual({
      project_path: "D:\\demo",
      message: "Codex contract test",
    });
  });
});
