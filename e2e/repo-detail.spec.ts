import { bffRepoDetail, avatarUrl, formatNumber, repoReactReact } from "./support/fixtures";
import { expect, test } from "./support/test";
import {
  countRequests,
  failFirstRequest,
  holdRequests,
  repoApi,
  requestIdOf,
  respondWithJson,
} from "./support/network";
import {
  alertWith,
  expectTopUrl,
  guideText,
  rateLimitedText,
  repoFailedText,
  repoHeading,
  repoNotFoundText,
  requestIdLabel,
  retryButton,
} from "./support/pages";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

test.describe("詳細ページ: 表示", () => {
  test("直接アクセスで、owner/name・アイコン・言語・description を表示する", async ({ page }) => {
    await page.goto("/repos/react/react");
    await expect(repoHeading(page, "react/react")).toBeVisible();

    const avatar = page.getByRole("img", { name: "react のアイコン" });
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute("src", avatarUrl(repoReactReact.owner.avatar_url, 128));
    await expect(page.getByText(repoReactReact.language, { exact: true })).toBeVisible();
    await expect(page.getByText(repoReactReact.description, { exact: true })).toBeVisible();
  });

  test("Star・Watcher・Fork・Issue 数をカンマ区切りで、丸めずに表示する", async ({ page }) => {
    await page.goto("/repos/react/react");
    await expect(repoHeading(page, "react/react")).toBeVisible();

    await expect(page.getByRole("term")).toHaveText([
      "Star 数",
      "Watcher 数",
      "Fork 数",
      "Issue 数",
    ]);
    // Watcher 数は subscribers_count（stargazers_count や watchers_count ではない）、Issue 数は open_issues_count
    await expect(page.getByRole("definition")).toHaveText([
      formatNumber(repoReactReact.stargazers_count),
      formatNumber(repoReactReact.subscribers_count),
      formatNumber(repoReactReact.forks_count),
      formatNumber(repoReactReact.open_issues_count),
    ]);
    await expect(page.getByRole("definition").first()).toHaveText("250,916");
  });

  test("GitHub へのリンクは、リポジトリの URL を別タブで開く", async ({ page }) => {
    await page.goto("/repos/react/react");
    const link = page.getByRole("link", { name: /GitHub で開く/ });
    await expect(link).toHaveAttribute("href", repoReactReact.html_url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("言語が null のときは「—」を表示する", async ({ page }) => {
    // fixture に言語なしのリポジトリが無いので、BFF の応答の language だけ null にする
    await respondWithJson(page, repoApi, bffRepoDetail(null));
    await page.goto("/repos/react/react");
    await expect(repoHeading(page, "react/react")).toBeVisible();
    await expect(page.getByText("—", { exact: true })).toBeVisible();
    await expect(page.getByText(repoReactReact.language, { exact: true })).toHaveCount(0);
  });

  test("読み込み中はスケルトンを表示し、取得できたら詳細に替わる", async ({ page }) => {
    const hold = await holdRequests(page, repoApi);
    try {
      await page.goto("/repos/react/react");
      await expect(page.getByText("読み込んでいます")).toBeAttached();
      await expect(repoHeading(page, "react/react")).toHaveCount(0);
    } finally {
      hold.release();
    }
    await expect(repoHeading(page, "react/react")).toBeVisible();
    await expect(page.getByText("読み込んでいます")).toHaveCount(0);
  });
});

test.describe("詳細ページ: 見つからない・エラー", () => {
  test("存在しないリポジトリは 404 の案内を表示し、検索ページへのリンクで戻れる", async ({
    page,
  }) => {
    await page.goto("/repos/__not_found__/x");
    await expect(page.getByRole("heading", { name: repoNotFoundText })).toBeVisible();
    await expect(page.getByText("削除されたか、名前が変更された可能性があります。")).toBeVisible();

    await page.getByRole("link", { name: "検索ページへ戻る" }).click();
    await expectTopUrl(page);
    await expect(page.getByText(guideText, { exact: true })).toBeVisible();
  });

  test("レート制限: 上限到達の案内・再試行ボタン・問い合わせ番号を表示する", async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => repoApi(new URL(response.url())));
    await page.goto("/repos/__rate_limited__/x");
    const alert = alertWith(page, rateLimitedText);
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "再試行" })).toBeVisible();
    await expect(alert).toContainText(new RegExp(`${requestIdLabel}\\s*${uuid}`));

    const response = await responsePromise;
    expect(response.status()).toBe(429);
    await expect(alert).toContainText(await requestIdOf(response));
  });

  test("通信エラー: 失敗の案内・再試行ボタン・問い合わせ番号を表示する", async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => repoApi(new URL(response.url())));
    await page.goto("/repos/__error__/x");
    const alert = alertWith(page, repoFailedText);
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "再試行" })).toBeVisible();
    await expect(alert).toContainText(new RegExp(`${requestIdLabel}\\s*${uuid}`));

    const response = await responsePromise;
    expect(response.status()).toBe(502);
    await expect(alert).toContainText(await requestIdOf(response));
  });

  test("再試行ボタンを押すと、もう一度取得する", async ({ page }) => {
    const requests = countRequests(page, repoApi);
    await page.goto("/repos/__error__/x");
    await expect(alertWith(page, repoFailedText)).toBeVisible();
    expect(requests.count()).toBe(1);

    await retryButton(page).click();
    await expect.poll(() => requests.count()).toBe(2);
    await expect(alertWith(page, repoFailedText)).toBeVisible();
  });

  test("一時的な失敗は、再試行で詳細の表示に回復する", async ({ page }) => {
    await failFirstRequest(page, repoApi);
    await page.goto("/repos/react/react");
    await expect(alertWith(page, repoFailedText)).toBeVisible();

    await retryButton(page).click();
    await expect(repoHeading(page, "react/react")).toBeVisible();
    await expect(alertWith(page, repoFailedText)).toHaveCount(0);
  });
});

test.describe("詳細ページ: ヘッダーのタイトル", () => {
  test("タイトルをクリックすると検索ページ（初期画面）へ戻る", async ({ page }) => {
    await page.goto("/repos/react/react");
    await expect(repoHeading(page, "react/react")).toBeVisible();

    await page.getByRole("banner").getByRole("link", { name: "GitHub Repository Search" }).click();
    await expectTopUrl(page);
    await expect(page.getByText(guideText, { exact: true })).toBeVisible();
  });
});
