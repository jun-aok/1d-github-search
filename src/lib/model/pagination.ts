import type { SearchCondition } from "./searchCondition";

export const PER_PAGE = 20;
export const MAX_RESULTS = 1000;
export const MAX_PAGE = MAX_RESULTS / PER_PAGE;

// GitHub の検索は先頭 1,000 件までしか返さないので、それを超える件数は数えない
export function totalPages(totalCount: number): number {
  return Math.ceil(Math.min(totalCount, MAX_RESULTS) / PER_PAGE);
}

export type Pagination = {
  readonly page: number;
  readonly totalPages: number;
  readonly prevPage: number | null;
  readonly nextPage: number | null;
};

export function pagination(condition: SearchCondition, totalCount: number): Pagination {
  void condition;
  void totalCount;
  return { page: 0, totalPages: -1, prevPage: -1, nextPage: -1 };
}

export type ResultRange = { readonly from: number; readonly to: number };

export function resultRange(condition: SearchCondition, itemCount: number): ResultRange {
  void condition;
  void itemCount;
  return { from: -1, to: -1 };
}
