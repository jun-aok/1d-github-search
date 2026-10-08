import { expect, test } from "./support/test";
import { countRequests, holdRequests, searchApi } from "./support/network";
import {
  expectSearchUrl,
  expectTopUrl,
  guideText,
  gotoSearch,
  nextButton,
  pagination,
  resultRows,
  searchBox,
  searchButton,
  searchFor,
  summaryText,
} from "./support/pages";

const firstPageSummary = "7,297,834 件中 1〜20 件を表示";

test.describe("検索ページ: 初期画面と検索の実行", () => {
  test("初期画面は案内文を表示し、入力欄は空で、検索ボタンは無効", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(guideText, { exact: true })).toBeVisible();
    await expect(searchBox(page)).toHaveValue("");
    await expect(searchButton(page)).toBeDisabled();
    await expect(resultRows(page)).toHaveCount(0);
    await expect(pagination(page)).toHaveCount(0);
  });

  test("文字を入力すると検索ボタンが有効になり、消すと無効に戻る", async ({ page }) => {
    await page.goto("/");
    await searchBox(page).fill("react");
    await expect(searchButton(page)).toBeEnabled();
    await searchBox(page).fill("");
    await expect(searchButton(page)).toBeDisabled();
  });

  for (const [label, text] of [
    ["半角空白のみ", "   "],
    ["全角空白のみ", "　　"],
    ["タブと空白のみ", " \t "],
  ] as const) {
    test(`${label}では検索ボタンが無効で、Enter でも検索されない`, async ({ page }) => {
      const searches = countRequests(page, searchApi);
      await page.goto("/");
      await searchBox(page).fill(text);
      await expect(searchButton(page)).toBeDisabled();
      await searchBox(page).press("Enter");
      await expectTopUrl(page);
      await expect(page.getByText(guideText, { exact: true })).toBeVisible();

      // 後続の正しい検索だけが通信になり、空白のみの Enter は通信になっていない
      await searchFor(page, "react");
      await expect(summaryText(page, firstPageSummary)).toBeVisible();
      expect(searches.count()).toBe(1);
    });
  }

  test("検索ボタンで検索を実行し、一覧と件数を表示する", async ({ page }) => {
    await page.goto("/");
    await searchBox(page).fill("react");
    await searchButton(page).click();
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(resultRows(page)).toHaveCount(20);
    await expect(page.getByText(guideText, { exact: true })).toHaveCount(0);
  });

  test("Enter キーで検索を実行する", async ({ page }) => {
    await page.goto("/");
    await searchBox(page).fill("react");
    await searchBox(page).press("Enter");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(resultRows(page)).toHaveCount(20);
  });

  test("入力欄は最大 256 文字までしか入力できない", async ({ page }) => {
    await page.goto("/");
    await expect(searchBox(page)).toHaveAttribute("maxlength", "256");
    await searchBox(page).pressSequentially("a".repeat(300));
    await expect(searchBox(page)).toHaveValue("a".repeat(256));
  });

  test("256 文字のキーワードで検索できる", async ({ page }) => {
    const query = "a".repeat(256);
    await page.goto("/");
    await searchBox(page).pressSequentially(query);
    await searchButton(page).click();
    await expectSearchUrl(page, query, 1);
    await expect(resultRows(page)).toHaveCount(20);
  });

  test("読み込み中は検索ボタンが無効で、Enter を押しても二重に検索しない", async ({ page }) => {
    const searches = countRequests(page, searchApi);
    await page.goto("/");
    const hold = await holdRequests(page, searchApi);
    try {
      await searchBox(page).fill("react");
      await searchButton(page).click();
      await expect(searchButton(page)).toBeDisabled();
      await searchBox(page).press("Enter");
    } finally {
      hold.release();
    }
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(searchButton(page)).toBeEnabled();
    expect(searches.count()).toBe(1);
  });

  test("同じキーワードで再検索すると、そのたびに最新の結果を取得し直す", async ({ page }) => {
    const searches = countRequests(page, searchApi);
    await gotoSearch(page, "react");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    expect(searches.count()).toBe(1);

    await searchButton(page).click();
    await expect.poll(() => searches.count()).toBe(2);
    await expect(summaryText(page, firstPageSummary)).toBeVisible();

    await searchBox(page).press("Enter");
    await expect.poll(() => searches.count()).toBe(3);
  });

  test("検索を実行すると URL が /?q=キーワード になる", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expectSearchUrl(page, "react", 1);
    await expect(nextButton(page)).toBeEnabled();
  });
});
