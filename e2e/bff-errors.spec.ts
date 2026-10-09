import { expect, test } from "./support/test";

// BFF のエラー応答（docs/design.md 4・8 節）。
// production ビルドなので、詳細（detail）やスタックを含まない

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test.describe("BFF: エラー応答", () => {
  const cases = [
    ["検索の障害", "/api/search?q=__error__", 502, "UPSTREAM_ERROR"],
    ["検索のレート制限", "/api/search?q=__rate_limited__", 429, "RATE_LIMITED"],
    ["詳細の障害", "/api/repos/__error__/x", 502, "UPSTREAM_ERROR"],
    ["詳細のレート制限", "/api/repos/__rate_limited__/x", 429, "RATE_LIMITED"],
    ["詳細の 404", "/api/repos/__not_found__/x", 404, "NOT_FOUND"],
    ["検索の入力不正（q なし）", "/api/search", 400, "BAD_REQUEST"],
    ["検索の入力不正（page=51）", "/api/search?q=react&page=51", 400, "BAD_REQUEST"],
  ] as const;

  for (const [label, path, status, code] of cases) {
    test(`${label}: ${String(status)} ${code} を返し、requestId がヘッダーと本文で一致し、詳細を含まない`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(status);
      const body: unknown = await response.json();
      expect(body).toMatchObject({ error: { code, requestId: expect.stringMatching(uuid) } });
      expect(body).not.toHaveProperty("error.detail");
      // スタックトレースの行（at fn (file:line:col)）が本文のどこにも無い
      expect(JSON.stringify(body)).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/);
      expect(body).toMatchObject({ error: { requestId: response.headers()["x-request-id"] } });
    });
  }

  test("GET /api/search は成功時に { totalCount, items } を返す", async ({ request }) => {
    const response = await request.get("/api/search?q=react");
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ totalCount: 7297834, items: expect.any(Array) });
    expect(response.headers()["x-request-id"]).toMatch(uuid);
  });
});
