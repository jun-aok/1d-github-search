// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { anEnv } from "@/test/builders";
import { createFakeGitHubClient } from "@/lib/github/fakeGitHubClient";
import { fail, ok } from "@/lib/model/result";
import { createMemoryLogger, createMemoryReporter } from "@/lib/observability/memory";
import type { AppError } from "./appError";
import { withErrorHandling, type Deps, type Handler } from "./withErrorHandling";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const production = anEnv({ NODE_ENV: "production", GITHUB_CLIENT: "fake" });
const development = anEnv({ NODE_ENV: "development", GITHUB_CLIENT: "fake" });

function setup(env = production) {
  const logger = createMemoryLogger();
  const reporter = createMemoryReporter();
  const deps: Deps = { github: createFakeGitHubClient(), logger, reporter, env };
  return { logger, reporter, deps };
}

async function call(
  handler: Handler,
  deps: Deps,
  url = "http://localhost/api/search?q=react&page=2",
) {
  const route = withErrorHandling(handler, deps);
  return route(new NextRequest(url), { params: Promise.resolve({}) });
}

function failing(error: AppError): Handler {
  return () => Promise.resolve(fail(error));
}

describe("withErrorHandling: 成功", () => {
  it("値を JSON で 200 で返し、x-request-id を付ける。何も記録しない", async () => {
    const { logger, reporter, deps } = setup();

    const response = await call(() => Promise.resolve(ok({ totalCount: 0, items: [] })), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalCount: 0, items: [] });
    expect(response.headers.get("x-request-id")).toMatch(uuid);
    expect(logger.entries).toEqual([]);
    expect(reporter.reports).toEqual([]);
  });

  it("requestId はリクエストごとに違う", async () => {
    const { deps } = setup();
    const handler: Handler = () => Promise.resolve(ok({}));

    const a = await call(handler, deps);
    const b = await call(handler, deps);

    expect(a.headers.get("x-request-id")).not.toBe(b.headers.get("x-request-id"));
  });
});

describe("withErrorHandling: 失敗の応答と記録", () => {
  it("失敗は respond の変換どおりの応答にし、requestId がヘッダー・本文・ログで一致する", async () => {
    const { logger, deps } = setup();

    const response = await call(
      failing({ kind: "upstream", reason: "http", detail: "GitHub が 503 を返しました" }),
      deps,
    );

    const requestId = response.headers.get("x-request-id");
    expect(requestId).toMatch(uuid);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "UPSTREAM_ERROR", requestId },
    });
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.fields["requestId"]).toBe(requestId);
  });

  it("レート制限は warn、GitHub 側の障害は error で記録する", async () => {
    const { logger, deps } = setup();

    await call(failing({ kind: "rate_limited", retryAfter: 30 }), deps);
    await call(failing({ kind: "upstream", reason: "timeout", detail: "x" }), deps);

    expect(logger.entries.map((e) => e.level)).toEqual(["warn", "error"]);
  });

  it("ログにルート・検索条件・原因・所要時間を残す（応答に出ない detail も）", async () => {
    const { logger, deps } = setup();

    await call(
      failing({ kind: "upstream", reason: "contract", detail: "items.0.stars: 不正" }),
      deps,
    );

    const fields = logger.entries[0]?.fields;
    expect(fields).toMatchObject({
      route: "/api/search",
      q: "react",
      page: "2",
      kind: "upstream",
      reason: "contract",
      detail: "items.0.stars: 不正",
    });
    expect(typeof fields?.["durationMs"]).toBe("number");
  });

  it("GitHub のステータスと x-ratelimit-remaining / reset を別の項目で残す", async () => {
    const { logger, deps } = setup();
    const response = { status: 403, rateLimitRemaining: 0, rateLimitReset: 1000000090 };

    await call(failing({ kind: "rate_limited", retryAfter: 30, response }), deps);
    await call(
      failing({
        kind: "upstream",
        reason: "http",
        detail: "x",
        response: { status: 503, rateLimitRemaining: null, rateLimitReset: null },
      }),
      deps,
    );

    expect(logger.entries[0]?.fields).toMatchObject({
      status: 403,
      rateLimitRemaining: 0,
      rateLimitReset: 1000000090,
    });
    expect(logger.entries[1]?.fields).toMatchObject({
      status: 503,
      rateLimitRemaining: null,
      rateLimitReset: null,
    });
  });

  it("入力不正・見つからない・422 は記録しない", async () => {
    const { logger, reporter, deps } = setup();

    await call(failing({ kind: "bad_request", detail: "q" }), deps);
    await call(failing({ kind: "not_found" }), deps);
    await call(failing({ kind: "invalid_request", detail: "422" }), deps);

    expect(logger.entries).toEqual([]);
    expect(reporter.reports).toEqual([]);
  });
});

describe("withErrorHandling: 想定外の例外", () => {
  const boom: Handler = () => Promise.reject(new Error("db password is hunter2"));

  it("500 INTERNAL_ERROR にし、例外の中身を本文に漏らさない（production）", async () => {
    const { deps } = setup(production);

    const response = await call(boom, deps);

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toContain("hunter2");
  });

  it("development では detail に元の例外を入れる", async () => {
    const { deps } = setup(development);

    const response = await call(boom, deps);

    const body: unknown = await response.json();
    expect(body).toHaveProperty("error.detail");
    expect(JSON.stringify(body)).toContain("hunter2");
  });

  it("reporter に、元の例外と同じ requestId・ルートを渡す。logger には書かない", async () => {
    const { logger, reporter, deps } = setup();

    const response = await call(boom, deps);

    expect(reporter.reports).toHaveLength(1);
    expect(reporter.reports[0]?.context).toMatchObject({
      requestId: response.headers.get("x-request-id"),
      route: "/api/search",
    });
    expect(reporter.reports[0]?.error).toBeInstanceOf(Error);
    expect(logger.entries).toEqual([]);
  });
});
