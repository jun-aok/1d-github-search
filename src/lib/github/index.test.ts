// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GITHUB_API, githubHandlers } from "@/mocks/githubHandlers";
import { createMemoryLogger } from "@/lib/observability/memory";
import { aSearchCondition, anEnv } from "@/test/builders";
import { createGitHubClient } from "./index";

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

describe("createGitHubClient", () => {
  it("fake なら偽の GitHub を返し、起動時に警告ログを 1 回出す", async () => {
    const logger = createMemoryLogger();

    const github = createGitHubClient(
      anEnv({ NODE_ENV: "development", GITHUB_CLIENT: "fake" }),
      logger,
    );

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.level).toBe("warn");
    // GitHub への通信は無い（MSW は未処理の通信をエラーにする）
    expect(await github.search(aSearchCondition("__empty__"))).toEqual({
      ok: true,
      value: { totalCount: 0, items: [] },
    });
  });

  it("http なら本物の実装を返し、環境変数のトークンで GitHub を呼ぶ。警告ログは出さない", async () => {
    const logger = createMemoryLogger();
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${GITHUB_API}/search/repositories`, ({ request }) => {
        authorizations.push(request.headers.get("authorization"));
        return HttpResponse.json({ total_count: 0, items: [] });
      }),
    );

    const github = createGitHubClient(
      anEnv({ NODE_ENV: "development", GITHUB_CLIENT: "http", GITHUB_TOKEN: "env-token" }),
      logger,
    );
    await github.search(aSearchCondition("react"));

    expect(authorizations).toEqual(["Bearer env-token"]);
    expect(logger.entries).toEqual([]);
  });
});
