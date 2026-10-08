"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { DetailSkeleton } from "@/components/Skeleton";
import { parseRepoPath } from "@/lib/model/repoPath";
import { NotFound } from "./NotFound";
import { RepoDetailView } from "./RepoDetailView";
import { useRepo } from "./useRepo";

// URL のパスの値（Next.js の params のキーのまま）
export type RepoParams = { readonly owner: string; readonly repo: string };

// 詳細ページ（docs/design.md 5 節）。パスを RepoPath に変換し、取得の状態に応じて 1 つを表示する
export function RepoDetailPage({ params }: { readonly params: RepoParams }) {
  const path = parseRepoPath(params);
  const { result } = useRepo(path.ok ? path.value : null);
  // 存在し得ない名前なので、問い合わせずに見つからない扱いにする（BFF と同じ規則。docs/design.md 4 節）
  if (!path.ok) return <NotFound />;
  if (result === undefined) return <DetailSkeleton />;
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") return <NotFound />;
    // レート制限の文言は ErrorMessage が検索ページと同じものを出す
    return (
      <ErrorMessage
        error={result.error}
        failedTitle="リポジトリ情報の取得に失敗しました"
        onRetry={() => undefined}
      />
    );
  }
  return <RepoDetailView repo={result.value} />;
}
