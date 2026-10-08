"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { fetchRepo } from "@/lib/api/client";
import type { ApiError } from "@/lib/model/apiError";
import type { RepoDetail } from "@/lib/model/repo";
import type { RepoPath } from "@/lib/model/repoPath";
import type { Result } from "@/lib/model/result";

// 取得した結果を覚える時間（docs/design.md 5 節）
const SUCCESS_STALE_TIME_MS = 60_000;

export type RepoState = {
  // 取得が終わるまでは undefined
  readonly result: Result<RepoDetail, ApiError> | undefined;
  // 再試行ボタン。同じリポジトリをもう一度取得する
  readonly retry: () => void;
};

// 詳細の取得（docs/design.md 5 節）。path が null（パスが RepoPath にならない）なら取得しない
export function useRepo(path: RepoPath | null): RepoState {
  const query = useQuery({
    queryKey: path === null ? ["repo"] : ["repo", path.owner, path.name],
    // 例外を投げず Result を返す（失敗も data に入る）
    queryFn: path === null ? skipToken : () => fetchRepo(path),
    // 失敗は例外にならないので TanStack Query の再試行は効かない。再試行は利用者のボタン操作
    retry: false,
    staleTime: SUCCESS_STALE_TIME_MS,
  });
  const { refetch } = query;
  return {
    result: query.data,
    retry: () => {
      void refetch();
    },
  };
}
