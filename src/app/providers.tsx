"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// TanStack Query の QueryClient を 1 つ作って配る（docs/design.md 2 節）。
// 再試行やキャッシュの時間は使う側（useSearch など）が問い合わせごとに決める。
// フォーカスの復帰・再接続での自動の取り直しは、すべての問い合わせ（検索・詳細）で止める。
// 失敗は覚えない（staleTime 0）ので、既定のままだとフォーカスのたびにレート制限中の GitHub を叩き直す（docs/design.md 5 節）
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, refetchOnReconnect: false },
    },
  });
}

export function Providers({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
