import { z } from "zod";
import { MAX_PAGE } from "./pagination";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

// query は前後の空白を除いて 1〜256 文字（docs/requirements.md「検索ページ」）。値も trim 後になる
const schema = z.object({
  query: z.string().trim().min(1).max(256),
  page: z.number().int().min(1).max(MAX_PAGE),
});

export type SearchCondition = DeepReadonly<z.infer<typeof schema>>;

export function parseSearchCondition(input: unknown): Result<SearchCondition, ParseError> {
  return safeParse(schema, input);
}

// 先頭 0 の無い整数だけを認める。02 や 2.0 は Number では通ってしまうので文字列で断る
const PAGE_PATTERN = /^[1-9][0-9]*$/;

// URL のクエリ（q・page）を検索条件に解析する。BFF もブラウザもこれを使う（docs/design.md 3 節）
export function searchConditionFromParams(
  params: URLSearchParams,
): Result<SearchCondition, ParseError> {
  const rawPage = params.get("page");
  // 省略は 1 ページ目。形式が合わない文字列は数値にせずそのまま渡し、parseSearchCondition に page の失敗として断らせる
  const page = rawPage === null ? 1 : PAGE_PATTERN.test(rawPage) ? Number(rawPage) : rawPage;
  return parseSearchCondition({ query: params.get("q"), page });
}

// 検索条件を URL のクエリにする。1 ページ目は page を付けない（docs/design.md 5 節）
export function toSearchParams(condition: SearchCondition): URLSearchParams {
  const params = new URLSearchParams({ q: condition.query });
  if (condition.page !== 1) params.set("page", String(condition.page));
  return params;
}
