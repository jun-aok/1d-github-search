import { z } from "zod";
import { MAX_PAGE } from "./pagination";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const schema = z.object({
  query: z.string().trim().min(1).max(256),
  page: z.number().int().min(1).max(MAX_PAGE),
});

export type SearchCondition = DeepReadonly<z.infer<typeof schema>>;

export function parseSearchCondition(input: unknown): Result<SearchCondition, ParseError> {
  return safeParse(schema, input);
}

const PAGE_PATTERN = /^[1-9][0-9]*$/;

export function searchConditionFromParams(
  params: URLSearchParams,
): Result<SearchCondition, ParseError> {
  const rawPage = params.get("page");
  // 省略は 1 ページ目。形式が合わない文字列は数値にせずそのまま渡し、parseSearchCondition に page の失敗として断らせる
  const page = rawPage === null ? 1 : PAGE_PATTERN.test(rawPage) ? Number(rawPage) : rawPage;
  return parseSearchCondition({ query: params.get("q"), page });
}

export function toSearchParams(condition: SearchCondition): URLSearchParams {
  const params = new URLSearchParams({ q: condition.query });
  if (condition.page !== 1) params.set("page", String(condition.page));
  return params;
}
