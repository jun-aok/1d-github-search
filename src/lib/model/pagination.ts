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

// 前後のページ番号を持つ（null は移れない）。範囲外のページでは page - 1 も範囲外なので、「前へ」は最終ページへ戻す
export function pagination(condition: SearchCondition, totalCount: number): Pagination {
  const last = totalPages(totalCount);
  const page = condition.page;
  const prevPage = last === 0 || page === 1 ? null : Math.min(page - 1, last);
  const nextPage = page < last ? page + 1 : null;
  return { page, totalPages: last, prevPage, nextPage };
}

export type ResultRange = { readonly from: number; readonly to: number };

// 「a〜b 件目」の a と b。a = (page-1)*20+1、b = (page-1)*20+そのページの件数
export function resultRange(condition: SearchCondition, itemCount: number): ResultRange {
  const offset = (condition.page - 1) * PER_PAGE;
  return { from: offset + 1, to: offset + itemCount };
}
