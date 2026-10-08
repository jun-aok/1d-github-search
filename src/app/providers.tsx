"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// TanStack Query の QueryClient を 1 つ作って配る（docs/design.md 2 節）。
// 再試行やキャッシュの時間は使う側（useSearch など）が問い合わせごとに決める
export function Providers({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
