// 一覧の読み込み中（スケルトン）。label は読み上げ用。クラス構成は mock/search.html のまま
export function ListSkeleton({ label, rows }: { readonly label: string; readonly rows: number }) {
  return (
    <section className="mt-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <ul className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border bg-white p-3 animate-pulse"
          >
            <div className="h-10 w-10 rounded-full bg-gray-200"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-200"></div>
              <div className="h-3 w-2/3 rounded bg-gray-200"></div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 詳細の読み込み中（スケルトン）。クラス構成は mock/detail.html のまま
export function DetailSkeleton() {
  return (
    <section className="animate-pulse" aria-busy="true">
      <p className="sr-only">読み込んでいます</p>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200"></div>
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-gray-200"></div>
          <div className="h-4 w-24 rounded bg-gray-200"></div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-200"></div>
        ))}
      </div>
    </section>
  );
}
