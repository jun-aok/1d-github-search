"use client";

import { UnexpectedError } from "@/components/UnexpectedError";

// ルート単位の描画時の想定外の例外。ヘッダー（layout.tsx）は残る（docs/design.md 8 節）
export default function ErrorPage({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <UnexpectedError error={error} retry={retry} />
    </main>
  );
}
