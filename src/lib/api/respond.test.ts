import { describe, expect, it } from "vitest";
import { anEnv } from "@/test/builders";
import type { AppError } from "./appError";
import { respond } from "./respond";

const development = anEnv({ NODE_ENV: "development", GITHUB_CLIENT: "http" });
const production = anEnv({ NODE_ENV: "production", GITHUB_CLIENT: "http", GITHUB_TOKEN: "t" });

async function bodyOf(response: Response): Promise<unknown> {
  return response.json();
}

describe("respond: AppError → HTTP 応答", () => {
  const cases: [number, string, string, AppError][] = [
    [400, "BAD_REQUEST", "bad_request", { kind: "bad_request", detail: "q が空です" }],
    [400, "BAD_REQUEST", "invalid_request", { kind: "invalid_request", detail: "422" }],
    [404, "NOT_FOUND", "not_found", { kind: "not_found" }],
    [429, "RATE_LIMITED", "rate_limited", { kind: "rate_limited", retryAfter: 30 }],
    [502, "UPSTREAM_ERROR", "upstream / http", { kind: "upstream", reason: "http", detail: "503" }],
    [
      502,
      "UPSTREAM_ERROR",
      "upstream / network",
      { kind: "upstream", reason: "network", detail: "x" },
    ],
    [
      502,
      "UPSTREAM_ERROR",
      "upstream / timeout",
      { kind: "upstream", reason: "timeout", detail: "x" },
    ],
    [
      502,
      "UPSTREAM_ERROR",
      "upstream / contract",
      { kind: "upstream", reason: "contract", detail: "x" },
    ],
    [500, "INTERNAL_ERROR", "internal", { kind: "internal", detail: "Error: boom" }],
  ];

  it.each(cases)("%i %s（%s）", async (status, code, _label, error) => {
    const response = respond(error, "req-1", production);

    expect(response.status).toBe(status);
    expect(await bodyOf(response)).toMatchObject({ error: { code, requestId: "req-1" } });
  });

  it("x-request-id ヘッダーに requestId を入れる", () => {
    const response = respond({ kind: "not_found" }, "req-1", production);

    expect(response.headers.get("x-request-id")).toBe("req-1");
  });

  it("レート制限は retryAfter（秒）を本文に含める", async () => {
    const response = respond({ kind: "rate_limited", retryAfter: 30 }, "req-1", production);

    expect(await bodyOf(response)).toMatchObject({ error: { retryAfter: 30 } });
  });

  it("ログ用の GitHub のステータスと x-ratelimit-* は本文に出さない（development でも）", async () => {
    const response = respond(
      {
        kind: "rate_limited",
        retryAfter: 30,
        response: { status: 403, rateLimitRemaining: 0, rateLimitReset: 1000000090 },
      },
      "req-1",
      development,
    );

    expect(await bodyOf(response)).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "GitHub rate limit exceeded",
        requestId: "req-1",
        retryAfter: 30,
      },
    });
  });

  it("レート制限以外の本文に retryAfter は無い", async () => {
    const response = respond({ kind: "not_found" }, "req-1", production);

    expect(await bodyOf(response)).not.toHaveProperty("error.retryAfter");
  });

  it("想定外の例外の message は Internal error だけ", async () => {
    const response = respond({ kind: "internal", detail: "Error: 秘密" }, "req-1", production);

    expect(await bodyOf(response)).toMatchObject({ error: { message: "Internal error" } });
  });

  it("development では detail を含める", async () => {
    const response = respond({ kind: "internal", detail: "Error: boom" }, "req-1", development);

    expect(await bodyOf(response)).toMatchObject({ error: { detail: "Error: boom" } });
  });

  it("test 環境も development と同じ扱いで detail を含める", async () => {
    const env = anEnv({ NODE_ENV: "test", GITHUB_CLIENT: "http" });

    const response = respond({ kind: "bad_request", detail: "q が空です" }, "req-1", env);

    expect(await bodyOf(response)).toMatchObject({ error: { detail: "q が空です" } });
  });

  it("production では detail を含めない（本文にも、どの種類のエラーでも）", async () => {
    for (const [, , , error] of cases) {
      const response = respond(error, "req-1", production);

      expect(JSON.stringify(await bodyOf(response))).not.toContain("detail");
    }
  });
});
