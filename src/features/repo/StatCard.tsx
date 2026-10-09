import { formatNumber } from "@/lib/format";

// 詳細ページの数の 1 枠（Star 数など）。カンマ区切りで丸めない。
// クラス構成は mock/detail.html のまま
export function StatCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{formatNumber(value)}</dd>
    </div>
  );
}
