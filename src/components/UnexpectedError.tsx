"use client";

import { useEffect } from "react";

// 描画時の想定外の例外（docs/design.md 8 節）。app/error.tsx と app/global-error.tsx が使う。
// 記録はブラウザの console.error だけ。development では例外のメッセージも出す
export function UnexpectedError({
  error,
  retry,
}: {
  readonly error: Error;
  readonly retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mt-6" role="alert">
      <div className="rounded-md border border-red-300 bg-red-50 p-4">
        <p className="font-semibold text-red-900">問題が発生しました</p>
        <p className="mt-1 text-sm text-red-800">時間をおいて、もう一度お試しください。</p>
        {process.env.NODE_ENV === "production" ? null : (
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-red-700">
            {error.message}
          </pre>
        )}
        <button
          className="mt-3 rounded-md border border-red-400 bg-white px-3 py-1.5 text-sm"
          onClick={retry}
        >
          再試行
        </button>
      </div>
    </section>
  );
}
