import { defineConfig, devices } from "@playwright/test";

// E2E（docs/design.md 7 節）。compose の e2e サービスから、
// production イメージ（GITHUB_CLIENT=fake）に向けて実行する
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  // 待ち時間は短めにする（単位はミリ秒。遅い処理は無い）。
  // Red が多いときに 1 件ごとのタイムアウト待ちが積み上がるのを抑える
  timeout: 15_000,
  expect: { timeout: 2_000 },
  reporter: process.env.CI !== undefined ? "list" : "html",
  use: {
    baseURL,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // *.mobile.spec.ts はモバイル端末のエミュレーションでだけ、それ以外はデスクトップでだけ実行する
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\.mobile\.spec\.ts$/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /\.mobile\.spec\.ts$/,
    },
  ],
});
