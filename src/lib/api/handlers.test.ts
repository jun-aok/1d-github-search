// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createFakeGitHubClient } from "@/lib/github/fakeGitHubClient";
import type { GitHubClient } from "@/lib/github/githubClient";
import { createMemoryLogger, createMemoryReporter } from "@/lib/observability/memory";
import type { RepoPath } from "@/lib/model/repoPath";
import type { SearchCondition } from "@/lib/model/searchCondition";
import { aSearchCondition, anEnv } from "@/test/builders";
import { handleRepo, handleSearch } from "./handlers";
import type { Deps } from "./withErrorHandling";

const env = anEnv({ NODE_ENV: "test", GITHUB_CLIENT: "fake" });

// 呼ばれた引数を記録しつつ、応答は偽物に任せる
function recordingDeps() {
  const fake = createFakeGitHubClient();
  const searches: SearchCondition[] = [];
  const repos: RepoPath[] = [];
  const github: GitHubClient = {
    search(condition) {
      searches.push(condition);
      return fake.search(condition);
    },
    getRepo(path) {
      repos.push(path);
      return fake.getRepo(path);
    },
  };
  const deps: Deps = {
    github,
    logger: createMemoryLogger(),
    reporter: createMemoryReporter(),
    env,
  };
  return { deps, searches, repos };
}

function search(query: string, deps: Deps) {
  return handleSearch(
    new NextRequest(`http://localhost/api/search${query}`),
    { params: Promise.resolve({}) },
    deps,
  );
}

function repo(owner: string, name: string, deps: Deps) {
  return handleRepo(
    new NextRequest("http://localhost/api/repos/x/y"),
    { params: Promise.resolve({ owner, repo: name }) },
    deps,
  );
}

describe("handleSearch", () => {
  it("クエリを SearchCondition にして GitHub に渡し、結果をそのまま返す", async () => {
    const { deps, searches } = recordingDeps();

    const result = await search("?q=react&page=2", deps);

    expect(searches).toEqual([{ query: "react", page: 2 }]);
    expect(result).toEqual(await createFakeGitHubClient().search(aSearchCondition("react", 2)));
  });

  it("page を省略すると 1 ページ目", async () => {
    const { deps, searches } = recordingDeps();

    await search("?q=react", deps);

    expect(searches).toEqual([{ query: "react", page: 1 }]);
  });

  it.each(["", "?q=", "?q=%20%20", "?q=react&page=0", "?q=react&page=51", "?q=react&page=02"])(
    "条件にできないクエリ %j は bad_request で、GitHub に問い合わせない",
    async (query) => {
      const { deps, searches } = recordingDeps();

      const result = await search(query, deps);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.kind).toBe("bad_request");
      expect(searches).toEqual([]);
    },
  );

  it("GitHub の失敗はそのまま返す", async () => {
    const { deps } = recordingDeps();

    const result = await search("?q=__rate_limited__", deps);

    expect(result).toEqual({ ok: false, error: { kind: "rate_limited", retryAfter: 60 } });
  });
});

describe("handleRepo", () => {
  it("params を RepoPath（owner / name）にして GitHub に渡し、結果をそのまま返す", async () => {
    const { deps, repos } = recordingDeps();

    const result = await repo("react", "react", deps);

    expect(repos).toEqual([{ owner: "react", name: "react" }]);
    expect(result.ok && result.value).toMatchObject({ fullName: "react/react" });
  });

  it.each([
    ["..", "x"],
    ["x", "."],
    ["a b", "x"],
    ["", "x"],
    ["a".repeat(40), "x"],
  ])("RepoPath にできない %j/%j は not_found で、GitHub に問い合わせない", async (owner, name) => {
    const { deps, repos } = recordingDeps();

    const result = await repo(owner, name, deps);

    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
    expect(repos).toEqual([]);
  });

  it("GitHub の失敗はそのまま返す", async () => {
    const { deps } = recordingDeps();

    const result = await repo("__not_found__", "x", deps);

    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });
});
