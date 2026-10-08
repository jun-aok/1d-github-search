import { avatarUrl, firstOf, formatNumber, searchFew, searchReact } from "./support/fixtures";
import { expect, test } from "./support/test";
import {
  expectSearchUrl,
  gotoSearch,
  pageIndicator,
  nextButton,
  previousButton,
  resultRows,
  rowOf,
  summaryText,
} from "./support/pages";

// 一覧の行と件数表示。表示データは FakeGitHubClient と同じ fixture（src/mocks/fixtures/search-react.json）

test.describe("検索ページ: 一覧", () => {
  test("20 件を <ul>/<li> の行として表示する", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(resultRows(page)).toHaveCount(20);
    await expect(page.getByRole("main").getByRole("list")).toHaveCount(1);
  });

  test("各行にアイコン・owner/name・description・言語・Star 数を表示する", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(resultRows(page)).toHaveCount(20);

    for (const item of searchReact.items) {
      const row = rowOf(page, item.full_name);
      await expect.soft(row, item.full_name).toHaveCount(1);
      // アイコンは装飾（alt は空）。サイズ指定つきの GitHub の URL
      await expect.soft(row.locator("img"), item.full_name).toHaveAttribute("alt", "");
      await expect
        .soft(row.locator("img"), item.full_name)
        .toHaveAttribute("src", avatarUrl(item.owner.avatar_url, 80));
      await expect
        .soft(row.getByText(item.description.trim(), { exact: true }), item.full_name)
        .toBeVisible();
      // 言語が無いときは「—」
      await expect
        .soft(row.getByText(item.language ?? "—", { exact: true }), item.full_name)
        .toBeVisible();
      await expect
        .soft(
          row.getByText(`★ ${formatNumber(item.stargazers_count)}`, { exact: true }),
          item.full_name,
        )
        .toBeVisible();
    }
  });

  test("行全体が /repos/{owner}/{name} へのリンクになっている", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(resultRows(page)).toHaveCount(20);

    for (const item of searchReact.items) {
      const row = rowOf(page, item.full_name);
      await expect.soft(row.getByRole("link"), item.full_name).toHaveCount(1);
      await expect
        .soft(row.getByRole("link"), item.full_name)
        .toHaveAttribute("href", `/repos/${item.full_name}`);
    }
    // 1 つのリンクの中に、名前・description・言語・Star 数がすべて含まれる
    const first = firstOf(searchReact.items);
    const link = rowOf(page, first.full_name).getByRole("link");
    await expect(link).toContainText(first.full_name);
    await expect(link).toContainText(first.description);
    await expect(link).toContainText(first.language ?? "—");
    await expect(link).toContainText(`★ ${formatNumber(first.stargazers_count)}`);
  });

  test("行の余白（文字のない部分）をクリックしても詳細ページへ遷移する", async ({ page }) => {
    await gotoSearch(page, "react");
    await rowOf(page, "react/react").click({ position: { x: 2, y: 2 } });
    await expect(page).toHaveURL((url) => url.pathname === "/repos/react/react");
  });

  test("description が長くても 1 行に省略され、すべての行の高さが揃う", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(resultRows(page)).toHaveCount(20);
    const heights = await resultRows(page).evaluateAll((rows) =>
      rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size).toBe(1);
  });
});

test.describe("検索ページ: 件数表示", () => {
  test("1 ページ目は「N 件中 1〜20 件を表示」", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();
  });

  test("2 ページ目は「N 件中 21〜40 件を表示」", async ({ page }) => {
    await gotoSearch(page, "react", 2);
    await expect(summaryText(page, "7,297,834 件中 21〜40 件を表示")).toBeVisible();
  });

  test("最終ページ（50 ページ目）は「N 件中 981〜1000 件を表示」で、次へは無効", async ({
    page,
  }) => {
    await gotoSearch(page, "react", 50);
    await expect(summaryText(page, "7,297,834 件中 981〜1000 件を表示")).toBeVisible();
    await expect(pageIndicator(page, "50 / 50 ページ")).toBeVisible();
    await expect(nextButton(page)).toBeDisabled();
    await expect(previousButton(page)).toBeEnabled();
  });

  test("結果が 1 ページに収まるとき（2 件）は「2 件中 1〜2 件を表示」で、1 / 1 ページ", async ({
    page,
  }) => {
    await gotoSearch(page, "__few__");
    await expect(
      summaryText(page, `${String(searchFew.total_count)} 件中 1〜2 件を表示`),
    ).toBeVisible();
    await expect(resultRows(page)).toHaveCount(2);
    await expect(pageIndicator(page, "1 / 1 ページ")).toBeVisible();
    await expect(previousButton(page)).toBeDisabled();
    await expect(nextButton(page)).toBeDisabled();
    await expectSearchUrl(page, "__few__", 1);
  });
});
