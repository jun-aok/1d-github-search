"use client";

import { keepPreviousData, skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSearch } from "@/lib/api/client";
import type { SearchCondition } from "@/lib/model/searchCondition";
import type { SearchResponse } from "./searchView";

// 成功した結果だけを覚える時間。失敗は覚えず、次に表示するとき必ず取り直す（docs/design.md 5 節）
const SUCCESS_STALE_TIME_MS = 60_000;

export function searchQueryKey(condition: SearchCondition) {
  return ["search", condition.query, condition.page] as const;
}

export type SearchState = {
  readonly response: SearchResponse | undefined;
  readonly isFetching: boolean;
  // 再試行ボタン。同じ条件でもう一度取得する
  readonly retry: () => void;
  // 検索ボタン。その条件の結果を覚えていても使わず、表示するときに必ず取り直させる
  readonly refresh: (condition: SearchCondition) => void;
};

export function useSearch(condition: SearchCondition | null): SearchState {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: condition === null ? ["search"] : searchQueryKey(condition),
    // 例外を投げず Result を返す（失敗も data に入る）。前の結果を出している間も件数やページを正しく出せるよう、条件も一緒に持つ
    queryFn:
      condition === null
        ? skipToken
        : async (): Promise<SearchResponse> => ({
            condition,
            result: await fetchSearch(condition),
          }),
    // 取得中は前の結果を残す（ページ送り・別キーワード・同じキーワードの再検索で同じ扱い）
    placeholderData: keepPreviousData,
    // 失敗は例外にならないので TanStack Query の再試行は効かない。再試行は利用者のボタン操作
    retry: false,
    staleTime: (q) => (q.state.data?.result.ok === true ? SUCCESS_STALE_TIME_MS : 0),
  });
  const { refetch } = query;
  return {
    response: query.data,
    isFetching: query.isFetching,
    retry: () => {
      void refetch();
    },
    // 表示中の条件なら今すぐ取り直し、そうでなければ古い扱いにして、表示したときに取り直させる
    refresh: (target) => {
      void queryClient.invalidateQueries({ queryKey: searchQueryKey(target), exact: true });
    },
  };
}
