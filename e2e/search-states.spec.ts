import { expect, test } from "./support/test";
import {
  countRequests,
  failFirstRequest,
  failWithHtml,
  failWithInternalError,
  failWithNetworkError,
  holdRequests,
  requestIdOf,
  searchApi,
} from "./support/network";
import {
  alertWith,
  expectSearchUrl,
  gotoSearch,
  rateLimitedText,
  requestIdLabel,
  resultRows,
  retryButton,
  searchBox,
  searchButton,
  searchFailedText,
  searchFor,
  summaryText,
} from "./support/pages";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const firstPageSummary = "7,297,834 件中 1〜20 件を表示";

test.describe("検索ページ: 読み込み中", () => {
  test("最初の検索（前の結果なし）は、スケルトンを表示し、検索ボタンは無効", async ({ page }) => {
    const hold = await holdRequests(page, searchApi);
    try {
      await gotoSearch(page, "react");
      await expect(page.getByText("検索しています")).toBeAttached();
      await expect(searchButton(page)).toBeDisabled();
      await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);
      await expect(summaryText(page, firstPageSummary)).toHaveCount(0);
    } finally {
      hold.release();
    }
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(page.getByText("検索しています")).toHaveCount(0);
    await expect(searchButton(page)).toBeEnabled();
  });

  test("前の結果があるときの再検索は、前の結果を表示したまま待つ", async ({ page }) => {
    await gotoSearch(page, "react");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();

    const hold = await holdRequests(page, searchApi);
    try {
      await searchButton(page).click();
      await expect(searchButton(page)).toBeDisabled();
      await expect(summaryText(page, firstPageSummary)).toBeVisible();
      await expect(resultRows(page)).toHaveCount(20);
      await expect(page.getByText("検索しています")).toHaveCount(0);
    } finally {
      hold.release();
    }
    await expect(searchButton(page)).toBeEnabled();
  });
});

test.describe("検索ページ: 0 件", () => {
  test("0 件のときは一致なしの案内を表示し、一覧とページネーションは出さない", async ({ page }) => {
    await gotoSearch(page, "__empty__");
    await expect(
      page.getByText("「__empty__」に一致するリポジトリは見つかりませんでした。", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("別のキーワードで試してください。", { exact: true })).toBeVisible();
    await expect(resultRows(page)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "ページネーション" })).toHaveCount(0);
  });
});

test.describe("検索ページ: エラー", () => {
  test("レート制限: 上限到達の案内・再試行ボタン・問い合わせ番号を表示する", async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => searchApi(new URL(response.url())));
    await gotoSearch(page, "__rate_limited__");
    const alert = alertWith(page, rateLimitedText);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("しばらく待ってから再試行してください。");
    await expect(alert.getByRole("button", { name: "再試行" })).toBeVisible();
    await expect(alert).toContainText(new RegExp(`${requestIdLabel}\\s*${uuid}`));
    await expect(resultRows(page)).toHaveCount(0);

    // BFF の応答の requestId が、画面の問い合わせ番号と同じ
    const response = await responsePromise;
    expect(response.status()).toBe(429);
    await expect(alert).toContainText(await requestIdOf(response));
  });

  test("通信エラー: 失敗の案内・再試行ボタン・問い合わせ番号を表示する", async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => searchApi(new URL(response.url())));
    await gotoSearch(page, "__error__");
    const alert = alertWith(page, searchFailedText);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("ネットワークの状態を確認して、もう一度お試しください。");
    await expect(alert.getByRole("button", { name: "再試行" })).toBeVisible();
    await expect(alert).toContainText(new RegExp(`${requestIdLabel}\\s*${uuid}`));

    const response = await responsePromise;
    expect(response.status()).toBe(502);
    await expect(alert).toContainText(await requestIdOf(response));
  });

  test("BFF に届かないエラー（ネットワーク断）は、エラーと再試行を表示し、問い合わせ番号は表示しない", async ({
    page,
  }) => {
    await failWithNetworkError(page, searchApi);
    await gotoSearch(page, "react");
    const alert = alertWith(page, searchFailedText);
    await expect(alert).toBeVisible();
    await expect(retryButton(page)).toBeVisible();
    await expect(alert).not.toContainText(requestIdLabel);
  });

  test("BFF が想定外の 500 を返しても、白画面にならずエラーと再試行を表示する", async ({
    page,
  }) => {
    await failWithInternalError(page, searchApi);
    await gotoSearch(page, "react");
    const alert = alertWith(page, searchFailedText);
    await expect(alert).toBeVisible();
    await expect(retryButton(page)).toBeVisible();
    await expect(alert).toContainText("66666666-7777-4888-9999-000000000000");
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("応答が JSON でなくても、白画面にならずエラーと再試行を表示する", async ({ page }) => {
    await failWithHtml(page, searchApi);
    await gotoSearch(page, "react");
    await expect(alertWith(page, searchFailedText)).toBeVisible();
    await expect(retryButton(page)).toBeVisible();
  });

  test("再試行ボタンを押すと、もう一度取得する", async ({ page }) => {
    const searches = countRequests(page, searchApi);
    await gotoSearch(page, "__error__");
    await expect(alertWith(page, searchFailedText)).toBeVisible();
    expect(searches.count()).toBe(1);

    await retryButton(page).click();
    await expect.poll(() => searches.count()).toBe(2);
    await expect(alertWith(page, searchFailedText)).toBeVisible();
  });

  test("レート制限でも再試行ボタンでもう一度取得する", async ({ page }) => {
    const searches = countRequests(page, searchApi);
    await gotoSearch(page, "__rate_limited__");
    await expect(alertWith(page, rateLimitedText)).toBeVisible();

    await retryButton(page).click();
    await expect.poll(() => searches.count()).toBe(2);
    await expect(alertWith(page, rateLimitedText)).toBeVisible();
  });

  test("一時的な失敗は、再試行で結果の表示に回復する", async ({ page }) => {
    await failFirstRequest(page, searchApi);
    await gotoSearch(page, "react");
    await expect(alertWith(page, searchFailedText)).toBeVisible();

    await retryButton(page).click();
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(alertWith(page, searchFailedText)).toHaveCount(0);
  });

  test("エラー表示のあとに別のキーワードで検索すると、結果の表示に復帰する", async ({ page }) => {
    await gotoSearch(page, "__error__");
    await expect(alertWith(page, searchFailedText)).toBeVisible();

    await searchFor(page, "react");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(alertWith(page, searchFailedText)).toHaveCount(0);
  });

  test("失敗した検索は覚えず、同じ条件を表示し直すときは必ず取り直す", async ({ page }) => {
    // 1 回目（/?q=react）だけ失敗させる
    await failFirstRequest(page, searchApi);
    await gotoSearch(page, "react");
    await expect(alertWith(page, searchFailedText)).toBeVisible();

    await searchFor(page, "vue");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expectSearchUrl(page, "vue", 1);

    await page.goBack();
    await expectSearchUrl(page, "react", 1);
    await expect(searchBox(page)).toHaveValue("react");
    await expect(summaryText(page, firstPageSummary)).toBeVisible();
    await expect(alertWith(page, searchFailedText)).toHaveCount(0);
  });
});
