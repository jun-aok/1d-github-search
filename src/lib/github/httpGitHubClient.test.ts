// @vitest-environment node
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GITHUB_API, githubHandlers } from "@/mocks/githubHandlers";
import { aRepoPath, aSearchCondition } from "@/test/builders";
import type { Result } from "@/lib/model/result";
import type { GitHubError } from "./githubError";
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

function errorOf(result: Result<unknown, GitHubError>): GitHubError {
  if (result.ok) throw new Error("失敗を期待しましたが成功しました");
  return result.error;
}

// path への GET に response で応答させ、受け取ったリクエストを返り値の配列に記録する
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

describe("HttpGitHubClient: GitHub のエラー応答", () => {
  const search = aSearchCondition("react");

  function respondWith(status: number, headers: Record<string, string> = {}): void {
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, () =>
        HttpResponse.json({ message: "GitHub のメッセージ" }, { status, headers }),
      ),
    );
  }

  it("404 は not_found", async () => {
    respondWith(404);

    expect(await createHttpGitHubClient().search(search)).toEqual({
      ok: false,
      error: { kind: "not_found" },
    });
  });

  it("422 は invalid_request で、GitHub の本文を detail に残す", async () => {
    respondWith(422);

    const error = errorOf(await createHttpGitHubClient().search(search));
    expect(error.kind).toBe("invalid_request");
    expect("detail" in error && error.detail).toContain("GitHub のメッセージ");
  });

  it.each([500, 503, 401, 451])(
    "%i は upstream / http で、ステータスを detail に残す",
    async (status) => {
      respondWith(status);

      const error = errorOf(await createHttpGitHubClient().search(search));
      expect(error).toMatchObject({ kind: "upstream", reason: "http" });
      expect("detail" in error && error.detail).toContain(String(status));
    },
  );

  it("レート制限の印が無い 403 / 429 は upstream / http", async () => {
    respondWith(403, { "x-ratelimit-remaining": "5" });
    expect(await createHttpGitHubClient().search(search)).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "http" },
    });

    respondWith(429);
    expect(await createHttpGitHubClient().search(search)).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "http" },
    });
  });
});

describe("HttpGitHubClient: レート制限", () => {
  const search = aSearchCondition("react");
  const nowMs = () => 1_000_000_000_500; // 1_000_000_000.5 秒

  function respondWith(status: number, headers: Record<string, string>): void {
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, () =>
        HttpResponse.json({ message: "rate limit" }, { status, headers }),
      ),
    );
  }

  it("retry-after があれば、その秒数を retryAfter にする（403 でも 429 でも）", async () => {
    respondWith(403, { "retry-after": "30" });
    expect(await createHttpGitHubClient().search(search)).toEqual({
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfter: 30,
        response: { status: 403, rateLimitRemaining: null, rateLimitReset: null },
      },
    });

    respondWith(429, { "retry-after": "12" });
    expect(await createHttpGitHubClient().search(search)).toEqual({
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfter: 12,
        response: { status: 429, rateLimitRemaining: null, rateLimitReset: null },
      },
    });
  });

  it("x-ratelimit-remaining が 0 なら、x-ratelimit-reset までの秒数を切り上げて retryAfter にする", async () => {
    respondWith(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1000000090" });

    expect(await createHttpGitHubClient({ nowMs }).search(search)).toEqual({
      ok: false,
      error: {
        kind: "rate_limited",
        retryAfter: 90,
        response: { status: 403, rateLimitRemaining: 0, rateLimitReset: 1000000090 },
      },
    });
  });

  it("reset が過去なら retryAfter は 0", async () => {
    respondWith(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "999999000" });

    expect(await createHttpGitHubClient({ nowMs }).search(search)).toMatchObject({
      error: { kind: "rate_limited", retryAfter: 0 },
    });
  });

  it("retry-after と reset が両方あれば retry-after を優先する", async () => {
    respondWith(403, {
      "retry-after": "7",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1000000090",
    });

    expect(await createHttpGitHubClient({ nowMs }).search(search)).toMatchObject({
      error: { kind: "rate_limited", retryAfter: 7 },
    });
  });

  it("待ち時間の手がかりが無ければ 60 秒とする", async () => {
    respondWith(403, { "x-ratelimit-remaining": "0" });

    expect(await createHttpGitHubClient({ nowMs }).search(search)).toMatchObject({
      error: { kind: "rate_limited", retryAfter: 60 },
    });
  });
});

describe("HttpGitHubClient: ログに残す GitHub の応答の情報", () => {
  const search = aSearchCondition("react");

  function respondWith(status: number, headers: Record<string, string>): void {
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, () =>
        HttpResponse.json({ message: "x" }, { status, headers }),
      ),
    );
  }

  it("レート制限では、ステータスと x-ratelimit-remaining / x-ratelimit-reset を付ける", async () => {
    respondWith(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1000000090" });

    expect(errorOf(await createHttpGitHubClient().search(search))).toMatchObject({
      kind: "rate_limited",
      response: { status: 403, rateLimitRemaining: 0, rateLimitReset: 1000000090 },
    });
  });

  it("GitHub の障害（upstream / http）でも付ける。ヘッダーが無ければ null", async () => {
    respondWith(503, {});

    expect(errorOf(await createHttpGitHubClient().search(search))).toMatchObject({
      kind: "upstream",
      reason: "http",
      response: { status: 503, rateLimitRemaining: null, rateLimitReset: null },
    });
  });
});

describe("HttpGitHubClient: 繋がらない・遅い・形が違う", () => {
  const search = aSearchCondition("react");

  it("接続できなければ upstream / network", async () => {
    server.use(http.get(`${GITHUB_API}/search/repositories`, () => HttpResponse.error()));

    expect(await createHttpGitHubClient().search(search)).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "network" },
    });
  });

  it("時間内に返らなければ upstream / timeout", async () => {
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );

    expect(await createHttpGitHubClient({ timeoutMs: 50 }).search(search)).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "timeout" },
    });
  });

  it("200 でも形が想定と違えば upstream / contract で、食い違う項目名を detail に残す", async () => {
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, () => HttpResponse.json({ items: [] })),
    );

    const error = errorOf(await createHttpGitHubClient().search(search));
    expect(error).toMatchObject({ kind: "upstream", reason: "contract" });
    expect("detail" in error && error.detail).toContain("total_count");
  });

  it("200 でも本文が JSON でなければ upstream / contract", async () => {
    server.use(
      http.get(`${GITHUB_API}/repos/:owner/:repo`, () => new HttpResponse("<html>oops</html>")),
    );

    expect(await createHttpGitHubClient().getRepo(aRepoPath("react", "react"))).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "contract" },
    });
  });
});
