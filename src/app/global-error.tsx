"use client";

import { UnexpectedError } from "@/components/UnexpectedError";
import "./globals.css";

// レイアウトを含む描画時の想定外の例外（docs/design.md 8 節）。layout.tsx の代わりに html / body を出す
export default function GlobalError({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <main className="max-w-3xl mx-auto px-4 py-6">
          <UnexpectedError error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
