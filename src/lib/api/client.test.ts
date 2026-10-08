import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  BFF_ORIGIN,
  bffHandlers,
  repoReactReactDetail,
  searchReactResult,
  TEST_REQUEST_ID,
} from "@/mocks/bffHandlers";
import type { ApiError } from "@/lib/model/apiError";
import type { Result } from "@/lib/model/result";
import { aRepoPath, aSearchCondition } from "@/test/builders";
import { fetchRepo, fetchSearch } from "./client";

const server = setupServer(...bffHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function errorOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) throw new Error("失敗を期待しましたが成功しました");
  return result.error;
}

describe("fetchSearch", () => {
  it("BFF の成功応答を SearchResult にして返す", async () => {
    const result = await fetchSearch(aSearchCondition("react"));
    expect(result).toEqual({ ok: true, value: searchReactResult });
  });

  it("BFF のエラー応答は ApiError を失敗として返す（code と問い合わせ番号）", async () => {
    const result = await fetchSearch(aSearchCondition("__rate_limited__"));
    expect(result).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "test", requestId: TEST_REQUEST_ID },
    });
  });

  it("BFF に届かない（ネットワーク断）ときは、問い合わせ番号の無い失敗を返す", async () => {
    server.use(http.get(`${BFF_ORIGIN}/api/search`, () => HttpResponse.error()));
    const error = errorOf(await fetchSearch(aSearchCondition("react")));
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.requestId).toBeUndefined();
  });

  it("応答が JSON でない（手前のプロキシの HTML など）ときは、問い合わせ番号の無い失敗を返す", async () => {
    server.use(
      http.get(`${BFF_ORIGIN}/api/search`, () =>
        HttpResponse.html("<h1>Bad Gateway</h1>", { status: 502 }),
      ),
    );
    const error = errorOf(await fetchSearch(aSearchCondition("react")));
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.requestId).toBeUndefined();
  });

  it("エラー応答が JSON だが ErrorResponse の形でないときは、問い合わせ番号の無い失敗を返す", async () => {
    server.use(
      http.get(`${BFF_ORIGIN}/api/search`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
    const error = errorOf(await fetchSearch(aSearchCondition("react")));
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.requestId).toBeUndefined();
    expect(error.detail).toContain("500");
  });

  it("成功応答の形が SearchResult と違うときは、どの項目が違うかを detail に入れた失敗を返す", async () => {
    server.use(
      http.get(`${BFF_ORIGIN}/api/search`, () => HttpResponse.json({ totalCount: -1, items: [] })),
    );
    const error = errorOf(await fetchSearch(aSearchCondition("react")));
    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.requestId).toBeUndefined();
    expect(error.detail).toContain("totalCount");
  });
});

describe("fetchRepo", () => {
  it("BFF の成功応答を RepoDetail にして返す", async () => {
    const result = await fetchRepo(aRepoPath("react", "react"));
    expect(result).toEqual({ ok: true, value: repoReactReactDetail });
  });
});
