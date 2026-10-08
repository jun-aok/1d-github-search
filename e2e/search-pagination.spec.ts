import { expect, test } from "./support/test";
import { holdRequests, searchApi } from "./support/network";
import {
  currentScrollY,
  emptyPageText,
  expectSearchUrl,
  gotoSearch,
  nextButton,
  pageIndicator,
  pagination,
  previousButton,
  resultRows,
  rowOf,
  searchBox,
  searchButton,
  searchFor,
  summaryText,
} from "./support/pages";

test.describe("検索ページ: ページネーション", () => {
  test("1 ページ目は「前へ」が無効、「次へ」が有効で、1 / 50 ページと表示する", async ({
    page,
  }) => {
    await gotoSearch(page, "react");
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    await expect(previousButton(page)).toBeDisabled();
    await expect(nextButton(page)).toBeEnabled();
  });

  test("「次へ」「前へ」でページを移動し、そのたびに URL の page が変わる", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();

    await test.step("次へで 2 ページ目", async () => {
      await nextButton(page).click();
      await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
      await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
      await expectSearchUrl(page, "react", 2);
      await expect(previousButton(page)).toBeEnabled();
    });

    await test.step("次へで 3 ページ目", async () => {
      await nextButton(page).click();
      await expect(pageIndicator(page, "3 / 50 ページ")).toBeVisible();
      await expect(summaryText(page, "7,297,834 件中 41〜60 件を表示")).toBeVisible();
      await expectSearchUrl(page, "react", 3);
    });

    await test.step("前へで 2 ページ目に戻る", async () => {
      await previousButton(page).click();
      await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
      await expectSearchUrl(page, "react", 2);
    });
  });

  test("最後の 50 ページ目では「次へ」が無効になる", async ({ page }) => {
    await gotoSearch(page, "react", 49);
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
    await expect(pageIndicator(page, "50 / 50 ページ")).toBeVisible();
    await expect(nextButton(page)).toBeDisabled();
  });

  test("ページを移動したら、ページの先頭へスクロールする", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(resultRows(page)).toHaveCount(20);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await expect.poll(() => currentScrollY(page)).toBeGreaterThan(0);

    await nextButton(page).click();
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
    await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
    await expect.poll(() => currentScrollY(page)).toBe(0);
  });

  test("ページ移動中は前のページの結果を残したまま待ち、スケルトンには戻らない", async ({
    page,
  }) => {
    await gotoSearch(page, "react");
    await expect(rowOf(page, "react/react")).toBeVisible();

    const hold = await holdRequests(page, searchApi);
    try {
      await nextButton(page).click();
      await expect(searchButton(page)).toBeDisabled();
      await expect(rowOf(page, "react/react")).toBeVisible();
      await expect(page.getByText("検索しています")).toHaveCount(0);
    } finally {
      hold.release();
    }
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
  });

  test("検索し直すと 1 ページ目に戻る（別のキーワードでも、同じキーワードでも）", async ({
    page,
  }) => {
    await gotoSearch(page, "react", 3);
    await expect(pageIndicator(page, "3 / 50 ページ")).toBeVisible();

    await test.step("別のキーワードで検索", async () => {
      await searchFor(page, "vue");
      await expectSearchUrl(page, "vue", 1);
      await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    });

    await test.step("2 ページ目へ進んでから、同じキーワードで検索", async () => {
      await nextButton(page).click();
      await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
      await expect(searchBox(page)).toHaveValue("vue");
      await searchButton(page).click();
      await expectSearchUrl(page, "vue", 1);
      await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    });
  });
});

test.describe("検索ページ: 総ページ数を超えるページ", () => {
  test("空のページを表示する（案内文、「2 件」、現在 / 総ページ数、一覧なし）", async ({
    page,
  }) => {
    await gotoSearch(page, "__few__", 3);
    await expect(page.getByText(emptyPageText, { exact: true })).toBeVisible();
    await expect(summaryText(page, "2 件")).toBeVisible();
    await expect(resultRows(page)).toHaveCount(0);
    await expect(pageIndicator(page, "3 / 1 ページ")).toBeVisible();
    await expect(previousButton(page)).toBeEnabled();
    await expect(nextButton(page)).toBeDisabled();
    // 検索はしているので URL はそのまま
    await expectSearchUrl(page, "__few__", 3);
  });

  test("「前へ」を押すと、1 つ前ではなく最終ページへ移動する", async ({ page }) => {
    await gotoSearch(page, "__few__", 3);
    await expect(page.getByText(emptyPageText, { exact: true })).toBeVisible();

    await previousButton(page).click();
    await expect(summaryText(page, "2 件中 1〜2 件を表示")).toBeVisible();
    await expect(pageIndicator(page, "1 / 1 ページ")).toBeVisible();
    await expect(resultRows(page)).toHaveCount(2);
    await expectSearchUrl(page, "__few__", 1);
    await expect(pagination(page)).toBeVisible();
  });
});
