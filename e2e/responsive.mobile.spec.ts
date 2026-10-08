import { expect, test } from "./support/test";
import {
  gotoSearch,
  horizontalOverflow,
  nextButton,
  pageIndicator,
  rowOf,
  searchFor,
} from "./support/pages";
import { screens } from "./support/screens";

// mobile プロジェクト（Pixel 7 のエミュレーション）でだけ実行する（playwright.config.ts）

test.describe("モバイル端末", () => {
  for (const screen of screens) {
    test(`${screen.name}: 横スクロールが出ない`, async ({ page }) => {
      await page.goto(screen.path);
      await expect(screen.ready(page)).toBeVisible();
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("一覧の行では言語と Star 数を表示しない（owner/name と description は表示する）", async ({
    page,
  }) => {
    await gotoSearch(page, "react");
    const row = rowOf(page, "react/react");
    await expect(row).toBeVisible();
    await expect(row.getByText("The library for web and native user interfaces.")).toBeVisible();
    await expect(row.getByText("JavaScript", { exact: true })).toBeHidden();
    await expect(row.getByText("★ 250,916", { exact: true })).toBeHidden();
  });

  test("タッチ操作で検索・ページ移動・詳細への遷移ができる", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await expect(pageIndicator(page, "1 / 50 ページ")).toBeVisible();

    await nextButton(page).tap();
    await expect(pageIndicator(page, "2 / 50 ページ")).toBeVisible();

    await rowOf(page, "react/react").tap();
    await expect(page).toHaveURL((url) => url.pathname === "/repos/react/react");
    await expect(page.getByRole("heading", { level: 1, name: "react/react" })).toBeVisible();
  });
});
