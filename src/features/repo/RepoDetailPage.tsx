"use client";

import { DetailSkeleton } from "@/components/Skeleton";
import { parseRepoPath } from "@/lib/model/repoPath";
import { RepoDetailView } from "./RepoDetailView";
import { useRepo } from "./useRepo";

// URL のパスの値（Next.js の params のキーのまま）
export type RepoParams = { readonly owner: string; readonly repo: string };

// 詳細ページ（docs/design.md 5 節）。パスを RepoPath に変換し、取得の状態に応じて 1 つを表示する
export function RepoDetailPage({ params }: { readonly params: RepoParams }) {
  const path = parseRepoPath(params);
  const { result } = useRepo(path.ok ? path.value : null);
  if (result === undefined) return <DetailSkeleton />;
  if (!result.ok) return null;
  return <RepoDetailView repo={result.value} />;
}
