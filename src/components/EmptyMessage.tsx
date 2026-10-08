import type { ReactNode } from "react";

// 結果の代わりに出す案内（初期・0 件）。クラス構成は mock/search.html のまま
export function EmptyMessage({
  children,
  hint,
}: {
  readonly children: ReactNode;
  readonly hint: ReactNode;
}) {
  return (
    <section className="mt-16 text-center text-gray-500">
      <p>{children}</p>
      <p className="mt-1 text-sm">{hint}</p>
    </section>
  );
}
