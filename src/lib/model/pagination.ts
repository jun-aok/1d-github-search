import type { SearchCondition } from "./searchCondition";

// 1 ページの件数（docs/design.md 5 節の決定事項）。GitHub への per_page にも使う
export const PER_PAGE = 20;
// GitHub の検索が返す件数の上限（件）。これを超える順位のページは取れない
export const MAX_RESULTS = 1000;
export const MAX_PAGE = MAX_RESULTS / PER_PAGE;

// GitHub の検索は先頭 1,000 件までしか返さないので、それを超える件数は数えない
export function totalPages(totalCount: number): number {
  return Math.ceil(Math.min(totalCount, MAX_RESULTS) / PER_PAGE);
}

// 上限の 1,000 件を超えているか。超えると先頭 1,000 件しか表示できないので、画面に注意書きを出す
export function exceedsMaxResults(totalCount: number): boolean {
  return totalCount > MAX_RESULTS;
}

export type Pagination = {
  readonly page: number;
  readonly totalPages: number;
  readonly prevPage: number | null;
  readonly nextPage: number | null;
};

// 検索条件と総件数から、現在・総数・前後のページ番号を求める（前後の null は移れない）。
// 範囲外のページでは page - 1 も範囲外なので、「前へ」は最終ページへ戻す
export function pagination(condition: SearchCondition, totalCount: number): Pagination {
  const last = totalPages(totalCount);
  const page = condition.page;
  const prevPage = last === 0 || page === 1 ? null : Math.min(page - 1, last);
  const nextPage = page < last ? page + 1 : null;
  return { page, totalPages: last, prevPage, nextPage };
}

export type ResultRange = { readonly from: number; readonly to: number };

// 「a〜b 件目」の a と b を求める。itemCount はそのページに実際に返った件数（最終ページは 20 未満）
export function resultRange(condition: SearchCondition, itemCount: number): ResultRange {
  const offset = (condition.page - 1) * PER_PAGE;
  return { from: offset + 1, to: offset + itemCount };
}
