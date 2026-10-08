"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Faded } from "@/components/Faded";
import { DetailSkeleton } from "@/components/Skeleton";
import { parseEncodedRepoPath } from "@/lib/model/repoPath";
import { NotFound } from "./NotFound";
import { RepoDetailView } from "./RepoDetailView";
import { useRepo } from "./useRepo";

// URL のパスの値（Next.js の params のキーのまま）。ページの params は符号化されたまま届く（Next.js 16.4 の production ビルドで確認）
export type RepoParams = { readonly owner: string; readonly repo: string };

// 詳細ページ（docs/design.md 5 節）。パスを 1 回だけ復号して RepoPath に変換し、取得の状態に応じて 1 つを表示する
export function RepoDetailPage({ params }: { readonly params: RepoParams }) {
  const path = parseEncodedRepoPath(params);
  const { result, isFetching, retry } = useRepo(path.ok ? path.value : null);
  // 存在し得ない名前なので、問い合わせずに見つからない扱いにする（BFF と同じ規則。docs/design.md 4 節）
  if (!path.ok) return <NotFound />;
  if (result === undefined) return <DetailSkeleton />;
  if (!result.ok) {
    // 失敗は覚えないので、もう一度開いた直後や再試行の直後は取り直す。その間は前の失敗を薄くして残す（検索ページと同じ）
    return (
      <Faded busy={isFetching}>
        {result.error.code === "NOT_FOUND" ? (
          <NotFound />
        ) : (
          // レート制限の文言は ErrorMessage が検索ページと同じものを出す
          <ErrorMessage
            error={result.error}
            failedTitle="リポジトリ情報の取得に失敗しました"
            onRetry={retry}
          />
        )}
      </Faded>
    );
  }
  return <RepoDetailView repo={result.value} />;
}
