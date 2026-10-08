import { readJson } from "@/lib/http/readJson";
import type { ApiError } from "@/lib/model/apiError";
import { fail, type Result } from "@/lib/model/result";
import { toSearchParams, type SearchCondition } from "@/lib/model/searchCondition";
import { parseSearchResult, type SearchResult } from "@/lib/model/searchResult";

// ブラウザから BFF を呼ぶ。jsdom では相対 URL の fetch が解決できないことがあるので絶対 URL にする（docs/design.md 5 節）
function bffUrl(path: string): URL {
  return new URL(path, window.location.origin);
}

export async function fetchSearch(condition: SearchCondition): Promise<Result<SearchResult, ApiError>> {
  const res = await fetch(bffUrl(`/api/search?${toSearchParams(condition).toString()}`));
  const body = await readJson(res);
  if (!body.ok) throw new Error("not implemented");
  const result = parseSearchResult(body.value);
  if (!result.ok) return fail({ code: "UPSTREAM_ERROR", message: "not implemented" });
  return result;
}
