import type { ReactNode } from "react";

// 前の結果（エラー・0 件・範囲外・見つからない、詳細ページでは成功も）を、
// 次の取得中だけ薄くする（docs/design.md 5 節）。
// 取得中でなければ包まない（モックと同じ DOM にするため。検索の一覧は <ul> 自体を薄くする）
export function Faded({
  busy,
  children,
}: {
  readonly busy: boolean;
  readonly children: ReactNode;
}) {
  if (!busy) return children;
  return (
    <div className="opacity-50" aria-busy="true">
      {children}
    </div>
  );
}
