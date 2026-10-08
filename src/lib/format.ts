const numberFormat = new Intl.NumberFormat("ja-JP");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

// GitHub のアイコン URL には ?v=4 が付いているので、文字列連結ではなく URL でサイズ s を足す
export function avatarUrl(url: string, size: number): string {
  if (!URL.canParse(url)) return url;
  const u = new URL(url);
  u.searchParams.set("s", String(size));
  return u.toString();
}
