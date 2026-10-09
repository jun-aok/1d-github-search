const numberFormat = new Intl.NumberFormat("ja-JP");

// 数値を 3 桁ごとのカンマ区切りにする。1.2k のようには丸めない（docs/requirements.md「詳細ページ」）
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

// GitHub のアイコン URL には ?v=4 が付いているので、文字列連結ではなく URL でサイズ s を足す
export function avatarUrl(url: string, size: number): string {
  // 描画中の JSX から呼ばれるので、読めない URL でも new URL の例外で画面を落とさない
  if (!URL.canParse(url)) return url;
  const u = new URL(url);
  u.searchParams.set("s", String(size));
  return u.toString();
}
