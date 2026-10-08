"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { ParseError, Result } from "@/lib/model/result";
import { searchConditionFromParams, type SearchCondition } from "@/lib/model/searchCondition";

// 検索ページの URL（?q=&page=）の読み書きをここに閉じ込める（docs/design.md 5 節）。
// コンポーネントは useSearchParams や pushState を直接使わず、テストではこのフックの戻り値を偽物に差し替える
export type SearchUrl = {
  // URL から解析した検索条件。q が無ければ null
  readonly condition: Result<SearchCondition, ParseError> | null;
  // URL を書き換える
  readonly navigate: (condition: SearchCondition) => void;
};

function conditionOf(params: URLSearchParams): SearchUrl["condition"] {
  if (!params.has("q") && !params.has("page")) return null;
  return searchConditionFromParams(params);
}

export function useSearchUrl(): SearchUrl {
  const params = useSearchParams();
  const condition = useMemo(() => conditionOf(new URLSearchParams(params)), [params]);
  return {
    condition,
    navigate: () => {
      throw new Error("not implemented");
    },
  };
}
