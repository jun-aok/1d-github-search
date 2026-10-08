import { http, HttpResponse } from "msw";
import { parseGitHubRepo, parseGitHubSearch } from "@/lib/github/parse";
import { createErrorResponse, type ApiError } from "@/lib/model/apiError";
import type { RepoDetail } from "@/lib/model/repo";
import { parseSearchResult, type SearchResult } from "@/lib/model/searchResult";
import repoReactReact from "./fixtures/repo-react-react.json";
import searchFew from "./fixtures/search-few.json";
import searchReact from "./fixtures/search-react.json";

// BFF の形で応答する MSW のハンドラ。コンポーネントテストが使う（docs/design.md 7 節）。
// 切り替えのキーワードは FakeGitHubClient と同じ（検索は __empty__ / __few__ / __rate_limited__ / __error__、詳細は owner の __not_found__ / __rate_limited__ / __error__）

// jsdom の window.location.origin（vitest.config.ts の environmentOptions）
export const BFF_ORIGIN = "http://localhost:3000";

export const TEST_REQUEST_ID = "3f9c2a1e-7b44-4d8e-9a10-5c6e7f8a9b01";

// fixture もモデルの parse を通して作る。作れなければ fixture の誤りなので例外にする
function searchResultFrom(result: ReturnType<typeof parseSearchResult>): SearchResult {
  if (!result.ok) throw new Error(`テストの検索結果が不正です: ${JSON.stringify(result.error)}`);
  return result.value;
}

export const searchReactResult = searchResultFrom(parseGitHubSearch(searchReact));
export const searchFewResult = searchResultFrom(parseGitHubSearch(searchFew));
export const searchEmptyResult = searchResultFrom(parseSearchResult({ totalCount: 0, items: [] }));
export const searchOutOfRangeResult = searchResultFrom(
  parseSearchResult({ totalCount: searchFewResult.totalCount, items: [] }),
);

function repoDetailFrom(result: ReturnType<typeof parseGitHubRepo>): RepoDetail {
  if (!result.ok) throw new Error(`テストのリポジトリが不正です: ${JSON.stringify(result.error)}`);
  return result.value;
}

export const repoReactReactDetail = repoDetailFrom(parseGitHubRepo(repoReactReact));

export function bffError(code: ApiError["code"], status: number): Response {
  return HttpResponse.json(
    createErrorResponse({ code, message: "test", requestId: TEST_REQUEST_ID }),
    { status, headers: { "x-request-id": TEST_REQUEST_ID } },
  );
}

export const bffHandlers = [
  http.get(`${BFF_ORIGIN}/api/search`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    switch (params.get("q")) {
      case "__empty__":
        return HttpResponse.json(searchEmptyResult);
      case "__few__":
        return HttpResponse.json(
          (params.get("page") ?? "1") === "1" ? searchFewResult : searchOutOfRangeResult,
        );
      case "__rate_limited__":
        return bffError("RATE_LIMITED", 429);
      case "__error__":
        return bffError("UPSTREAM_ERROR", 502);
      default:
        return HttpResponse.json(searchReactResult);
    }
  }),
  // 詳細は owner で切り替える（FakeGitHubClient の getRepo と同じ）
  http.get(`${BFF_ORIGIN}/api/repos/:owner/:repo`, ({ params }) => {
    switch (params.owner) {
      case "__not_found__":
        return bffError("NOT_FOUND", 404);
      case "__rate_limited__":
        return bffError("RATE_LIMITED", 429);
      case "__error__":
        return bffError("UPSTREAM_ERROR", 502);
      default:
        return HttpResponse.json(repoReactReactDetail);
    }
  }),
];
