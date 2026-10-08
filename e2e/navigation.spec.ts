import { expect, test } from "./support/test";
import { countRequests, searchApi } from "./support/network";
import {
  expectSearchUrl,
  gotoSearch,
  nextButton,
  pageIndicator,
  repoHeading,
  rowOf,
  searchBox,
  searchFor,
  summaryText,
} from "./support/pages";

// 画面をまたぐ流れ: 検索 → 一覧 → 詳細 → ブラウザバック

test.describe("遷移: 検索 → 詳細 → 戻る", () => {
  test("一覧の行から詳細へ移り、ブラウザバックで検索キーワードとページが残る", async ({ page }) => {
    await page.goto("/");

    await test.step("react を検索して 2 ページ目へ進む", async () => {
      await searchFor(page, "react");
      await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
      await nextButton(page).click();
      await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
      await expectSearchUrl(page, "react", 2);
    });

    await test.step("入力欄に未送信の文字を入れてから、行をクリックして詳細へ", async () => {
      await searchBox(page).fill("vue");
      await rowOf(page, "react/react").click();
      await expect(page).toHaveURL((url) => url.pathname === "/repos/react/react");
      await expect(repoHeading(page, "react/react")).toBeVisible();
    });

    await test.step("ブラウザバックで 2 ページ目の結果に戻り、入力欄は URL のキーワードに合う", async () => {
      await page.goBack();
      await expectSearchUrl(page, "react", 2);
      await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
      await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
      await expect(searchBox(page)).toHaveValue("react");
    });
  });

  test("一覧 → 詳細 → 戻ると、キャッシュが効いて再取得しない", async ({ page }) => {
    const searches = countRequests(page, searchApi);
    await gotoSearch(page, "react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
    expect(searches.count()).toBe(1);

    await rowOf(page, "react/react").click();
    await expect(repoHeading(page, "react/react")).toBeVisible();
    await page.goBack();
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
    expect(searches.count()).toBe(1);
  });

  test("詳細ページから戻った先で、さらに行を開き直せる", async ({ page }) => {
    await gotoSearch(page, "react");
    await rowOf(page, "react/react").click();
    await expect(repoHeading(page, "react/react")).toBeVisible();
    await page.goBack();
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();

    await rowOf(page, "vercel/next.js").click();
    await expect(page).toHaveURL((url) => url.pathname === "/repos/vercel/next.js");
  });
});

test.describe("遷移: 検索ページ内のブラウザバック・フォワード", () => {
  test("ブラウザバックで前のキーワードの検索に戻り、入力欄も URL に合う。フォワードで進める", async ({
    page,
  }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
    await searchFor(page, "__few__");
    await expect(summaryText(page, "2 件中 1〜2 件を表示")).toBeVisible();

    await page.goBack();
    await expectSearchUrl(page, "react", 1);
    await expect(searchBox(page)).toHaveValue("react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();

    await page.goForward();
    await expectSearchUrl(page, "__few__", 1);
    await expect(searchBox(page)).toHaveValue("__few__");
    await expect(summaryText(page, "2 件中 1〜2 件を表示")).toBeVisible();
  });

  test("ページ送りのあとにブラウザバックすると、前のページに戻る", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    await nextButton(page).click();
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();

    await page.goBack();
    await expectSearchUrl(page, "react", 1);
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
  });

  test("初期画面からの検索のあとにブラウザバックすると、初期画面に戻る", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === "/" && url.search === "");
    await expect(searchBox(page)).toHaveValue("");
  });
});
