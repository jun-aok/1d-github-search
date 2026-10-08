import Link from "next/link";

// リポジトリが見つからない（BFF が NOT_FOUND、またはパスが RepoPath にならない）。クラス構成は mock/detail.html のまま
export function NotFound() {
  return (
    <section className="mt-10 text-center">
      <h1 className="text-xl font-bold">リポジトリが見つかりません</h1>
      <p className="mt-2 text-gray-600">削除されたか、名前が変更された可能性があります。</p>
      <Link href="/" className="mt-4 inline-block text-blue-600 underline">
        検索ページへ戻る
      </Link>
    </section>
  );
}
