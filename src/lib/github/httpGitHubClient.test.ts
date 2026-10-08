// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GITHUB_API, githubHandlers } from "@/mocks/githubHandlers";
import { aRepoPath, aSearchCondition } from "@/test/builders";
import { createHttpGitHubClient } from "./httpGitHubClient";

const server = setupServer(...githubHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// 受け取ったリクエストを記録する
function captureRequests(path: string, response: () => Response): Request[] {
  const requests: Request[] = [];
  server.use(
    http.get(`${GITHUB_API}${path}`, ({ request }) => {
      requests.push(request);
      return response();
    }),
  );
  return requests;
}

describe("HttpGitHubClient.search", () => {
  it("GitHub の検索応答を SearchResult にして返す", async () => {
    const result = await createHttpGitHubClient().search(aSearchCondition("react"));

    expect(result.ok && result.value.totalCount).toBe(7297834);
    expect(result.ok && result.value.items).toHaveLength(20);
  });

  it("q・per_page=20・page をクエリに付けて呼ぶ", async () => {
    const requests = captureRequests("/search/repositories", () =>
      HttpResponse.json({ total_count: 0, items: [] }),
    );

    await createHttpGitHubClient().search(aSearchCondition("react hooks&x=1", 3));

    const url = new URL(requests[0]?.url ?? "");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "react hooks&x=1",
      per_page: "20",
      page: "3",
    });
  });

  it("必須のヘッダー（User-Agent・Accept・API バージョン）とトークンを付ける", async () => {
    const requests = captureRequests("/search/repositories", () =>
      HttpResponse.json({ total_count: 0, items: [] }),
    );

    await createHttpGitHubClient({ token: "secret-token" }).search(aSearchCondition("react"));

    const headers = requests[0]?.headers;
    expect(headers?.get("user-agent")).toBe("github-repository-search");
    expect(headers?.get("accept")).toBe("application/vnd.github+json");
    expect(headers?.get("x-github-api-version")).toBe("2022-11-28");
    expect(headers?.get("authorization")).toBe("Bearer secret-token");
  });

  it("トークンが無ければ Authorization を付けない", async () => {
    const requests = captureRequests("/search/repositories", () =>
      HttpResponse.json({ total_count: 0, items: [] }),
    );

    await createHttpGitHubClient().search(aSearchCondition("react"));

    expect(requests[0]?.headers.has("authorization")).toBe(false);
  });
});

describe("HttpGitHubClient.getRepo", () => {
  it("GitHub の詳細応答を RepoDetail にして返す", async () => {
    const result = await createHttpGitHubClient().getRepo(aRepoPath("react", "react"));

    expect(result).toMatchObject({
      ok: true,
      value: { fullName: "react/react", watchers: 6603, forks: 51441, openIssues: 1419 },
    });
  });

  it("owner と name は encodeURIComponent してパスに入れる", async () => {
    const requests = captureRequests("/repos/:owner/:repo", () => HttpResponse.json({}));

    await createHttpGitHubClient().getRepo(aRepoPath("a?b", "c#d"));

    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/repos/a%3Fb/c%23d");
  });
});
