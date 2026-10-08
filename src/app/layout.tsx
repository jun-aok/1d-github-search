import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Repository Search",
  description: "GitHub のリポジトリを検索する",
};

// Server Component のまま（データ取得はしない）。html / body と枠だけを出す（docs/design.md 1・2 節）
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
