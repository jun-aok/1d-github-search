import { expect, test } from "./support/test";
import { countRequests, searchApi } from "./support/network";
import {
  expectSearchUrl,
  expectTopUrl,
  guideText,
  gotoSearch,
  nextButton,
  pageIndicator,
  resultRows,
  searchBox,
  searchFor,
  summaryText,
} from "./support/pages";

test.describe("検索ページ: URL とキーワード・ページの復元", () => {
  test("/?q=react に直接アクセスすると、入力欄にキーワードが入り、結果を表示する", async ({
    page,
  }) => {
    await page.goto("/?q=react");
    await expect(searchBox(page)).toHaveValue("react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();
    await expect(resultRows(page)).toHaveCount(20);
    await expectSearchUrl(page, "react", 1);
  });

  test("/?q=react&page=2 に直接アクセスすると、2 ページ目を表示する", async ({ page }) => {
    await page.goto("/?q=react&page=2");
    await expect(searchBox(page)).toHaveValue("react");
    await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
    await expectSearchUrl(page, "react", 2);
  });

  test("リロードしても同じキーワードとページの結果を表示する", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await nextButton(page).click();
    await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();

    await page.reload();
    await expect(searchBox(page)).toHaveValue("react");
    await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();
    await expectSearchUrl(page, "react", 2);
  });

  test("日本語や記号を含むキーワードも URL に載せて復元できる", async ({ page }) => {
    const query = "next.js 日本語";
    await page.goto("/");
    await searchFor(page, query);
    await expectSearchUrl(page, query, 1);
    await expect(resultRows(page)).toHaveCount(20);

    await page.reload();
    await expect(searchBox(page)).toHaveValue(query);
    await expect(resultRows(page)).toHaveCount(20);
  });

  test("ページ上限の 50 ページ目に直接アクセスできる", async ({ page }) => {
    await gotoSearch(page, "react", 50);
    await expect(pageIndicator(page, "50 / 50 ページ")).toBeVisible();
    await expectSearchUrl(page, "react", 50);
  });

  test("256 文字ちょうどのキーワードの URL は不正扱いにせず検索する", async ({ page }) => {
    const query = "a".repeat(256);
    await gotoSearch(page, query);
    await expect(resultRows(page)).toHaveCount(20);
    await expectSearchUrl(page, query, 1);
  });
});

test.describe("検索ページ: 不正な URL は検索せず初期画面にして、URL を / に直す", () => {
  const invalidUrls = [
    ["page が数字でない（page=abc）", "/?q=react&page=abc"],
    ["page が 0", "/?q=react&page=0"],
    ["page が負数", "/?q=react&page=-1"],
    ["page が 51（上限超え）", "/?q=react&page=51"],
    ["page が先頭 0 付き（page=02）", "/?q=react&page=02"],
    ["page が小数表記（page=2.0）", "/?q=react&page=2.0"],
    ["page が空", "/?q=react&page="],
    ["q が空", "/?q="],
    ["q が空白のみ", "/?q=%20%20"],
    ["q が無く page だけがある", "/?page=2"],
    ["q が 257 文字", `/?q=${"a".repeat(257)}`],
  ] as const;

  for (const [label, path] of invalidUrls) {
    test(label, async ({ page }) => {
      const searches = countRequests(page, searchApi);
      await page.goto(path);
      await expect(page.getByText(guideText, { exact: true })).toBeVisible();
      await expectTopUrl(page);
      await expect(searchBox(page)).toHaveValue("");
      await expect(resultRows(page)).toHaveCount(0);
      expect(searches.count()).toBe(0);
    });
  }
});
