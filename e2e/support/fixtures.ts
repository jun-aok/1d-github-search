import repoReactReact from "../../src/mocks/fixtures/repo-react-react.json";
import searchFew from "../../src/mocks/fixtures/search-few.json";
import searchReact from "../../src/mocks/fixtures/search-react.json";

// アプリ（FakeGitHubClient）と同じ fixture を、期待値の出どころとして使う
export { repoReactReact, searchFew, searchReact };

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

// アイコン URL にサイズを指定する（docs/design.md 6 節）。既存の ?v=4 は残す
export function avatarUrl(url: string, size: number): string {
  const result = new URL(url);
  result.searchParams.set("s", String(size));
  return result.toString();
}

export function firstOf<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error("fixture が空です");
  }
  return item;
}

// BFF の詳細 API の JSON（docs/design.md 4 節 RepoDetail）。言語だけ差し替えられる
export function bffRepoDetail(language: string | null) {
  return {
    id: repoReactReact.id,
    fullName: repoReactReact.full_name,
    owner: { login: repoReactReact.owner.login, avatarUrl: repoReactReact.owner.avatar_url },
    description: repoReactReact.description,
    language,
    stars: repoReactReact.stargazers_count,
    url: repoReactReact.html_url,
    watchers: repoReactReact.subscribers_count,
    forks: repoReactReact.forks_count,
    openIssues: repoReactReact.open_issues_count,
  };
}
