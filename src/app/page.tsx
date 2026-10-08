import { Suspense } from "react";
import { SearchPageFromUrl } from "@/features/search/SearchPage";

// 検索ページ（docs/design.md 5 節）。データはブラウザから BFF に取りに行く。
// useSearchParams を使う部分は Suspense で包む（production ビルドの要件）
export default function Page() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <Suspense>
        <SearchPageFromUrl />
      </Suspense>
    </main>
  );
}
