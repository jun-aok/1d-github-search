import Link from "next/link";

// 存在しない URL（docs/design.md 8 節）
export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <section className="mt-10 text-center">
        <h1 className="text-xl font-bold">ページが見つかりません</h1>
        <Link href="/" className="mt-4 inline-block text-blue-600 underline">
          検索ページへ戻る
        </Link>
      </section>
    </main>
  );
}
