import type { Locator, Page } from "@playwright/test";
import {
  alertWith,
  emptyPageText,
  guideText,
  rateLimitedText,
  repoFailedText,
  repoHeading,
  repoNotFoundText,
  searchFailedText,
  summaryText,
} from "./pages";

// 画面幅のテスト（responsive*.spec.ts）が巡回する画面。ready は「描画が終わった」と言える要素
export type Screen = { name: string; path: string; ready: (page: Page) => Locator };

export const screens: readonly Screen[] = [
  { name: "検索: 初期", path: "/", ready: (page) => page.getByText(guideText, { exact: true }) },
  {
    name: "検索: 結果（1 ページ目）",
    path: "/?q=react",
    ready: (page) => summaryText(page, "7,297,834 件中 1〜20 件を表示"),
  },
  {
    name: "検索: 結果（最終ページ）",
    path: "/?q=react&page=50",
    ready: (page) => summaryText(page, "7,297,834 件中 981〜1000 件を表示"),
  },
  {
    name: "検索: 範囲外ページ",
    path: "/?q=__few__&page=3",
    ready: (page) => page.getByText(emptyPageText, { exact: true }),
  },
  {
    name: "検索: 0 件",
    path: "/?q=__empty__",
    ready: (page) => page.getByText("別のキーワードで試してください。", { exact: true }),
  },
  {
    name: "検索: レート制限",
    path: "/?q=__rate_limited__",
    ready: (page) => alertWith(page, rateLimitedText),
  },
  {
    name: "検索: 通信エラー",
    path: "/?q=__error__",
    ready: (page) => alertWith(page, searchFailedText),
  },
  {
    name: "詳細: 表示",
    path: "/repos/react/react",
    ready: (page) => repoHeading(page, "react/react"),
  },
  {
    name: "詳細: 404",
    path: "/repos/__not_found__/x",
    ready: (page) => page.getByRole("heading", { name: repoNotFoundText }),
  },
  {
    name: "詳細: レート制限",
    path: "/repos/__rate_limited__/x",
    ready: (page) => alertWith(page, rateLimitedText),
  },
  {
    name: "詳細: 通信エラー",
    path: "/repos/__error__/x",
    ready: (page) => alertWith(page, repoFailedText),
  },
];
