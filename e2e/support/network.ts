import type { Page } from "@playwright/test";

// ブラウザ → BFF の通信を観察・差し替える。BFF → GitHub は FakeGitHubClient が担当する
export type UrlMatcher = (url: URL) => boolean;

export const searchApi: UrlMatcher = (url) => url.pathname === "/api/search";
export const repoApi: UrlMatcher = (url) => url.pathname.startsWith("/api/repos/");

export type Hold = { release: () => void };

// release() が呼ばれるまで、該当する要求を BFF に渡さず止める（読み込み中の状態を作る）
export async function holdRequests(page: Page, matcher: UrlMatcher): Promise<Hold> {
  const gate = Promise.withResolvers<undefined>();
  await page.route(matcher, async (route) => {
    await gate.promise;
    await route.continue().catch(() => undefined);
  });
  return {
    release: () => {
      gate.resolve(undefined);
    },
  };
}

export function countRequests(page: Page, matcher: UrlMatcher): { count: () => number } {
  let total = 0;
  page.on("request", (request) => {
    if (matcher(new URL(request.url()))) {
      total += 1;
    }
  });
  return { count: () => total };
}

type ErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";

function errorBody(code: ErrorCode, requestId: string) {
  return JSON.stringify({ error: { code, message: "e2e", requestId } });
}

// 最初の 1 回だけ BFF のエラー応答（502）を返し、2 回目以降は本物の BFF に渡す
export async function failFirstRequest(page: Page, matcher: UrlMatcher): Promise<void> {
  let first = true;
  await page.route(matcher, async (route) => {
    if (first) {
      first = false;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: errorBody("UPSTREAM_ERROR", "11111111-2222-4333-8444-555555555555"),
      });
      return;
    }
    await route.continue();
  });
}

// BFF が想定外の 500 を返した状況
export async function failWithInternalError(page: Page, matcher: UrlMatcher): Promise<void> {
  await page.route(matcher, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: errorBody("INTERNAL_ERROR", "66666666-7777-4888-9999-000000000000"),
    }),
  );
}

// 本文が JSON でない応答（BFF の手前のプロキシが返す HTML など）
export async function failWithHtml(page: Page, matcher: UrlMatcher): Promise<void> {
  await page.route(matcher, (route) =>
    route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad Gateway</h1>" }),
  );
}

// BFF に届かない（ネットワーク断）
export async function failWithNetworkError(page: Page, matcher: UrlMatcher): Promise<void> {
  await page.route(matcher, (route) => route.abort("connectionrefused"));
}

export async function respondWithJson(
  page: Page,
  matcher: UrlMatcher,
  body: unknown,
): Promise<void> {
  await page.route(matcher, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

// エラー応答の JSON から問い合わせ番号（requestId）を取り出す
export async function requestIdOf(response: { json: () => Promise<unknown> }): Promise<string> {
  const body = await response.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "requestId" in body.error &&
    typeof body.error.requestId === "string"
  ) {
    return body.error.requestId;
  }
  throw new Error("エラー応答に error.requestId がありません");
}
