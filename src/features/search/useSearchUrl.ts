"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { ParseError, Result } from "@/lib/model/result";
import {
  searchConditionFromParams,
  toSearchParams,
  type SearchCondition,
} from "@/lib/model/searchCondition";

// 検索ページの URL（?q=&page=）の読み書きをここに閉じ込める（docs/design.md 5 節）。
// コンポーネントは useSearchParams や pushState を直接使わず、
// テストではこのフックの戻り値を偽物に差し替える
export type SearchUrl = {
  // URL から解析した検索条件。q も page も無ければ null。page だけなど不正な URL は失敗
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

  // 不正な URL は検索せず初期画面にする。アドレスバーも / に直して表示と一致させる。
  // 書き換えを useSearchParams が検知して、condition は null になる
  useEffect(() => {
    if (condition !== null && !condition.ok) window.history.replaceState(null, "", "/");
  }, [condition]);

  return { condition, navigate };
}

// router.push はサーバーにページ情報を取りに行くことがあるので、pushState で書き換える。
// useSearchParams は pushState を検知する（docs/design.md 5 節）
function navigate(condition: SearchCondition): void {
  window.history.pushState(null, "", `/?${toSearchParams(condition).toString()}`);
}
