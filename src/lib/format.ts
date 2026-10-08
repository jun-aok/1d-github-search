const numberFormat = new Intl.NumberFormat("ja-JP");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function avatarUrl(url: string, size: number): string {
  void url;
  void size;
  return "";
}
