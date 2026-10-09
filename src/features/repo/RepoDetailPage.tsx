"use client";

import { ErrorMessage } from "@/components/ErrorMessage";
import { Faded } from "@/components/Faded";
import { DetailSkeleton } from "@/components/Skeleton";
import { parseEncodedRepoPath } from "@/lib/model/repoPath";
import { NotFound } from "./NotFound";
import { RepoDetailView } from "./RepoDetailView";
import { useRepo } from "./useRepo";

// URL のパスの値（Next.js の params のキーのまま）。
// ページの params は符号化されたまま届く（docs/design.md 4 節）
export type RepoParams = { readonly owner: string; readonly repo: string };

// 詳細ページ（docs/design.md 5 節）。パスを 1 回だけ復号して RepoPath に変換し、
// 取得の状態に応じて 1 つを表示する
export function RepoDetailPage({ params }: { readonly params: RepoParams }) {
  const path = parseEncodedRepoPath(params);
  const { result, isFetching, retry } = useRepo(path.ok ? path.value : null);
  // 存在し得ない名前なので、問い合わせずに見つからない扱いにする
  // （BFF と同じ規則。docs/design.md 4 節）
  if (!path.ok) return <NotFound />;
  if (result === undefined) return <DetailSkeleton />;
  // 取り直す間（失敗をもう一度開いた直後・再試行の直後、古くなった成功を開き直した直後）は、
  // 前の結果を薄くして残す（検索ページと同じ）。
  // 取得中でなければ Faded は何も足さないので、モックと同じ DOM のまま
  return (
    <Faded busy={isFetching}>
      {result.ok ? (
        <RepoDetailView repo={result.value} />
      ) : result.error.code === "NOT_FOUND" ? (
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
