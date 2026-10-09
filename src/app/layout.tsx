import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Repository Search",
  description: "GitHub のリポジトリを検索する",
};

// html / body とヘッダーを出す（docs/design.md 1・2 節）。
// Server Component のまま（データ取得はしない）。ヘッダーのタイトルは検索ページ（/）へのリンク。
// クラス構成は mock/ のまま
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>
          <header className="bg-white border-b">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <Link href="/" className="text-xl font-bold hover:underline">
                GitHub Repository Search
              </Link>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
