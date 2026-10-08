import { expect, test } from "./support/test";
import { expectTopUrl, guideText, gotoSearch, searchFor, summaryText } from "./support/pages";

test.describe("共通: ヘッダーのタイトル", () => {
  test("ヘッダーにタイトルがあり、検索ページ（/）へのリンクになっている", async ({ page }) => {
    await page.goto("/");
    const title = page.getByRole("banner").getByRole("link", { name: "GitHub Repository Search" });
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute("href", "/");
  });

  test("検索結果の表示中にタイトルをクリックすると、初期画面に戻る", async ({ page }) => {
    await page.goto("/");
    await searchFor(page, "react");
    await expect(summaryText(page, "7,297,834 件中 1〜20 件を表示")).toBeVisible();

    await page.getByRole("banner").getByRole("link", { name: "GitHub Repository Search" }).click();
    await expectTopUrl(page);
    await expect(page.getByText(guideText, { exact: true })).toBeVisible();
  });

  test("エラー画面でもヘッダーのタイトルは使える", async ({ page }) => {
    await gotoSearch(page, "__error__");
    await expect(page.getByRole("alert").filter({ hasText: "検索に失敗しました" })).toBeVisible();
    await page.getByRole("banner").getByRole("link", { name: "GitHub Repository Search" }).click();
    await expectTopUrl(page);
    await expect(page.getByText(guideText, { exact: true })).toBeVisible();
  });
});

test.describe("共通: production イメージの死活確認", () => {
  test('GET /api/health は 200 と { status: "ok" } を返す', async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("最低限のセキュリティヘッダーを付けて応答する（docs/design.md 6 節）", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });
});
