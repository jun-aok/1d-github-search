import { RepoDetailPage } from "@/features/repo/RepoDetailPage";

// 詳細ページ（docs/design.md 5 節）。データはブラウザから BFF に取りに行く。
// params は Promise（Next.js 16）。ここではパスの値を取り出して渡すだけで、データの取得はしない
export default async function Page({
  params,
}: {
  readonly params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <RepoDetailPage params={{ owner, repo }} />
    </main>
  );
}
