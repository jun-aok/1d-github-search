import { expect, type Page } from "@playwright/test";
import { bffRepoDetail } from "./fixtures";
import { holdRequests, repoApi, respondWithJson, searchApi } from "./network";
import {
  alertWith,
  emptyPageText,
  guideText,
  gotoSearch,
  rateLimitedText,
  repoFailedText,
  repoHeading,
  repoNotFoundText,
  searchButton,
  searchFailedText,
  summaryText,
} from "./pages";

// モックの状態（?state=...）と、実装でそれを再現する URL / 操作の対応表（docs/design.md 7 節）
// FakeGitHubClient の切り替えキーワード（__empty__ など）をそのまま使う

// 実装を目的の状態にする。止めておいた通信があれば、後始末の release を返す
export type Setup = (page: Page) => Promise<() => void>;

export type MockStateCase = { state: string; title: string; setup: Setup };

const nothingToRelease = (): void => undefined;

function visit(path: string, ready: (page: Page) => ReturnType<typeof summaryText>): Setup {
  return async (page) => {
    await page.goto(path);
    await expect(ready(page)).toBeVisible();
    return nothingToRelease;
  };
}

export const searchStateCases: readonly MockStateCase[] = [
  {
    state: "initial",
    title: "初期（/）",
    setup: visit("/", (page) => page.getByText(guideText, { exact: true })),
  },
  {
    // 取得中の瞬間: BFF への要求を止めて、最初の検索（前の結果なし）を待っている状態にする
    state: "loading",
    title: "読み込み中（/?q=react の取得中）",
    setup: async (page) => {
      const hold = await holdRequests(page, searchApi);
      await gotoSearch(page, "react");
      await expect(page.getByText("検索しています")).toBeAttached();
      return hold.release;
    },
  },
  {
    state: "results",
    title: "結果あり（/?q=react）",
    setup: visit("/?q=react", (page) => summaryText(page, "7,297,834 件中 1〜20 件を表示")),
  },
  {
    // 前の結果がある状態で同じキーワードを再検索し、取得中で止める
    state: "refreshing",
    title: "取得中（/?q=react を表示してから再検索中）",
    setup: async (page) => {
      await gotoSearch(page, "react");
      await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
      const hold = await holdRequests(page, searchApi);
      await searchButton(page).click();
      await expect(searchButton(page)).toBeDisabled();
      return hold.release;
    },
  },
  {
    state: "empty",
    title: "0 件（/?q=__empty__）",
    setup: visit("/?q=__empty__", (page) =>
      page.getByText("別のキーワードで試してください。", { exact: true }),
    ),
  },
  {
    state: "few",
    title: "少数（/?q=__few__）",
    setup: visit("/?q=__few__", (page) => summaryText(page, "2 件中 1〜2 件を表示")),
  },
  {
    state: "outofrange",
    title: "範囲外ページ（/?q=__few__&page=3）",
    setup: visit("/?q=__few__&page=3", (page) => page.getByText(emptyPageText, { exact: true })),
  },
  {
    state: "ratelimit",
    title: "レート制限（/?q=__rate_limited__）",
    setup: visit("/?q=__rate_limited__", (page) => alertWith(page, rateLimitedText)),
  },
  {
    state: "error",
    title: "通信エラー（/?q=__error__）",
    setup: visit("/?q=__error__", (page) => alertWith(page, searchFailedText)),
  },
];

export const detailStateCases: readonly MockStateCase[] = [
  {
    state: "loading",
    title: "読み込み中（/repos/react/react の取得中）",
    setup: async (page) => {
      const hold = await holdRequests(page, repoApi);
      await page.goto("/repos/react/react");
      await expect(page.getByText("読み込んでいます")).toBeAttached();
      return hold.release;
    },
  },
  {
    state: "detail",
    title: "表示（/repos/react/react）",
    setup: visit("/repos/react/react", (page) => repoHeading(page, "react/react")),
  },
  {
    // fixture に言語なしのリポジトリが無いので、BFF の応答の language だけ null にして再現する
    state: "nolang",
    title: "言語なし（/repos/react/react の応答の language を null に差し替え）",
    setup: async (page) => {
      await respondWithJson(page, repoApi, bffRepoDetail(null));
      await page.goto("/repos/react/react");
      await expect(repoHeading(page, "react/react")).toBeVisible();
      return nothingToRelease;
    },
  },
  {
    state: "notfound",
    title: "404（/repos/__not_found__/x）",
    setup: visit("/repos/__not_found__/x", (page) =>
      page.getByRole("heading", { name: repoNotFoundText }),
    ),
  },
  {
    state: "ratelimit",
    title: "レート制限（/repos/__rate_limited__/x）",
    setup: visit("/repos/__rate_limited__/x", (page) => alertWith(page, rateLimitedText)),
  },
  {
    state: "error",
    title: "通信エラー（/repos/__error__/x）",
    setup: visit("/repos/__error__/x", (page) => alertWith(page, repoFailedText)),
  },
];
