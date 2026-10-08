import type { Pagination } from "@/lib/model/pagination";

export type PaginationNavProps = {
  readonly pagination: Pagination;
  readonly onMove: (page: number) => void;
};

// 前へ・次へと「現在 / 総ページ数」。移れない側のボタンは無効（docs/design.md 5 節）。
// クラス構成は mock/search.html のまま（button に type を付けないのもモックに合わせている。form の外なので送信はしない）
export function PaginationNav({ pagination, onMove }: PaginationNavProps) {
  return (
    <nav aria-label="ページネーション" className="mt-6 flex items-center justify-between text-sm">
      <MoveButton label="← 前へ" page={pagination.prevPage} onMove={onMove} />
      <span>{`${String(pagination.page)} / ${String(pagination.totalPages)} ページ`}</span>
      <MoveButton label="次へ →" page={pagination.nextPage} onMove={onMove} />
    </nav>
  );
}

function MoveButton({
  label,
  page,
  onMove,
}: {
  readonly label: string;
  readonly page: number | null;
  readonly onMove: (page: number) => void;
}) {
  return (
    <button
      disabled={page === null}
      className="rounded-md border bg-white px-3 py-1.5 disabled:text-gray-400 disabled:bg-gray-100"
      onClick={() => {
        if (page !== null) onMove(page);
      }}
    >
      {label}
    </button>
  );
}
