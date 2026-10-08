import type { ApiError } from "@/lib/model/apiError";
import { pagination, resultRange, type Pagination, type ResultRange } from "@/lib/model/pagination";
import type { ParseError, Result } from "@/lib/model/result";
import type { SearchCondition } from "@/lib/model/searchCondition";
import type { SearchResult } from "@/lib/model/searchResult";

// 検索の応答と、それを問い合わせた条件。前の結果を表示している間（keepPreviousData）も、件数やページは応答の条件で出す
export type SearchResponse = {
  readonly condition: SearchCondition;
  readonly result: Result<SearchResult, ApiError>;
};

// 取得が終わった状態（docs/design.md 5 節「状態の決め方」）
export type SettledView =
  | { readonly kind: "rateLimited"; readonly error: ApiError }
  | { readonly kind: "failed"; readonly error: ApiError }
  | { readonly kind: "empty"; readonly query: string }
  | { readonly kind: "outOfRange"; readonly totalCount: number; readonly pagination: Pagination }
  | {
      readonly kind: "loaded";
      readonly result: SearchResult;
      readonly pagination: Pagination;
      readonly range: ResultRange;
    };

export type SearchView =
  | { readonly kind: "initial" }
  | { readonly kind: "loading" }
  | { readonly kind: "refreshing"; readonly previous: SettledView }
  | SettledView;

export type SearchViewInput = {
  readonly condition: Result<SearchCondition, ParseError> | null;
  readonly response: SearchResponse | undefined;
  readonly isFetching: boolean;
};

export function searchView(input: SearchViewInput): SearchView {
  const { condition } = input;
  if (condition === null || !condition.ok) return { kind: "initial" };
  // 条件があって応答がまだ無いのは、最初の取得を待っている間だけ
  if (input.response === undefined) return { kind: "loading" };
  return settledView(input.response);
}

function settledView({ condition, result }: SearchResponse): SettledView {
  if (!result.ok) throw new Error("not implemented");
  const value = result.value;
  if (value.totalCount === 0) return { kind: "empty", query: condition.query };
  const pages = pagination(condition, value.totalCount);
  if (value.items.length === 0) {
    return { kind: "outOfRange", totalCount: value.totalCount, pagination: pages };
  }
  return {
    kind: "loaded",
    result: value,
    pagination: pages,
    range: resultRange(condition, value.items.length),
  };
}
