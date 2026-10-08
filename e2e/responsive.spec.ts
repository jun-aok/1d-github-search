import { expect, test } from "./support/test";
import { horizontalOverflow } from "./support/pages";
import { screens } from "./support/screens";

// 画面幅 320px〜1280px で横スクロールなしに表示・操作できる（docs/requirements.md 共通）
// 実機相当（モバイル端末のエミュレーション）は responsive.mobile.spec.ts

for (const width of [320, 768, 1280]) {
  test.describe(`画面幅 ${String(width)}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const screen of screens) {
      test(`${screen.name}: 横スクロールが出ない`, async ({ page }) => {
        await page.goto(screen.path);
        await expect(screen.ready(page)).toBeVisible();
        await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe("画面幅 1280px: 一覧に言語と Star 数を表示する", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("行に言語と Star 数が見える", async ({ page }) => {
    await page.goto("/?q=react");
    const row = page.getByRole("main").getByRole("listitem").first();
    await expect(row.getByText("JavaScript", { exact: true })).toBeVisible();
    await expect(row.getByText("★ 250,916", { exact: true })).toBeVisible();
  });
});
