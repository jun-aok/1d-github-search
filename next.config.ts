import type { NextConfig } from "next";
import { env } from "./src/lib/env";

// next build / next start の両方で評価されるので、環境変数の設定漏れはここで止まる
// （docs/design.md 6 節）
void env;

// 最低限のセキュリティヘッダー（docs/design.md 6 節）。e2e/common.spec.ts が確かめる
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Dockerfile の runner ステージは .next/standalone をコピーし、node server.js で起動する
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers() {
    return Promise.resolve([{ source: "/(.*)", headers: securityHeaders }]);
  },
};

export default nextConfig;
