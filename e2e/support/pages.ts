import { expect, type Locator, type Page } from "@playwright/test";

// 画面の部品を、利用者に見えるもの（role / label / text）で特定する。文言は mock/ が正

export const guideText = "キーワードを入力して GitHub のリポジトリを検索します。";
export const emptyPageText = "このページには結果がありません。";
export const rateLimitedText = "GitHub API の利用回数の上限に達しました";
export const searchFailedText = "検索に失敗しました";
export const repoFailedText = "リポジトリ情報の取得に失敗しました";
export const repoNotFoundText = "リポジトリが見つかりません";

export const searchBox = (page: Page): Locator => page.getByLabel("リポジトリ名");
export const searchButton = (page: Page): Locator =>
  page.getByRole("button", { name: "検索", exact: true });
export const retryButton = (page: Page): Locator => page.getByRole("button", { name: "再試行" });

export const pagination = (page: Page): Locator =>
  page.getByRole("navigation", { name: "ページネーション" });
export const previousButton = (page: Page): Locator =>
  pagination(page).getByRole("button", { name: "前へ" });
export const nextButton = (page: Page): Locator =>
  pagination(page).getByRole("button", { name: "次へ" });
// 「3 / 50 ページ」のような現在 / 総ページ数
export const pageIndicator = (page: Page, text: string): Locator =>
  pagination(page).getByText(text, { exact: true });

// 件数表示「N 件中 a〜b 件を表示」など。全文を渡す
export const summaryText = (page: Page, text: string): Locator =>
  page.getByText(text, { exact: true });

export const resultRows = (page: Page): Locator => page.getByRole("main").getByRole("listitem");
export const rowOf = (page: Page, fullName: string): Locator =>
  resultRows(page).filter({ has: page.getByText(fullName, { exact: true }) });

// Next.js のルートアナウンサーも role="alert" を持つので、文言で絞る
export const alertWith = (page: Page, text: string): Locator =>
  page.getByRole("alert").filter({ hasText: text });

export const requestIdLabel = "問い合わせ番号:";

export function searchPath(query: string, pageNumber?: number): string {
  const params = new URLSearchParams({ q: query });
  if (pageNumber !== undefined) {
    params.set("page", String(pageNumber));
  }
  return `/?${params.toString()}`;
}

export async function gotoSearch(page: Page, query: string, pageNumber?: number): Promise<void> {
  await page.goto(searchPath(query, pageNumber));
}

// 入力してボタンで検索する
export async function searchFor(page: Page, query: string): Promise<void> {
  await searchBox(page).fill(query);
  await searchButton(page).click();
}

// 現在の URL が検索ページの q / page を指していること（page 省略は 1 ページ目として扱う）
export async function expectSearchUrl(
  page: Page,
  query: string,
  pageNumber: number,
): Promise<void> {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        q: url.searchParams.get("q"),
        page: Number(url.searchParams.get("page") ?? "1"),
      };
    })
    .toEqual({ pathname: "/", q: query, page: pageNumber });
}

export async function expectTopUrl(page: Page): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === "/" && url.search === "");
}

export async function currentScrollY(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

export const repoHeading = (page: Page, fullName: string): Locator =>
  page.getByRole("heading", { level: 1, name: fullName });
