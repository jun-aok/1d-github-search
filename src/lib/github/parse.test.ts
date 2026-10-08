import { describe, expect, it } from "vitest";
import repoReactReact from "@/mocks/fixtures/repo-react-react.json";
import searchFew from "@/mocks/fixtures/search-few.json";
import searchReact from "@/mocks/fixtures/search-react.json";
import { parseGitHubRepo, parseGitHubSearch } from "./parse";

describe("parseGitHubSearch", () => {
  it("GitHub の検索応答（本物の JSON）を、こちらの項目名の SearchResult に写す", () => {
    const result = parseGitHubSearch(searchReact);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCount).toBe(7297834);
    expect(result.value.items).toHaveLength(20);
    expect(result.value.items[0]).toEqual({
      id: 10270250,
      fullName: "react/react",
      owner: { login: "react", avatarUrl: "https://avatars.githubusercontent.com/u/102812?v=4" },
      description: "The library for web and native user interfaces.",
      language: "JavaScript",
      stars: 250916,
      url: "https://github.com/react/react",
    });
  });

  it("言語が null のリポジトリは language: null になる", () => {
    const result = parseGitHubSearch(searchFew);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((i) => i.language)).toEqual([null, null]);
  });
});

describe("parseGitHubRepo", () => {
  it("GitHub の詳細応答を RepoDetail に写す（watchers は subscribers_count）", () => {
    const result = parseGitHubRepo(repoReactReact);

    expect(result).toEqual({
      ok: true,
      value: {
        id: 10270250,
        fullName: "react/react",
        owner: { login: "react", avatarUrl: "https://avatars.githubusercontent.com/u/102812?v=4" },
        description: "The library for web and native user interfaces.",
        language: "JavaScript",
        stars: 250916,
        url: "https://github.com/react/react",
        watchers: 6603,
        forks: 51441,
        openIssues: 1419,
      },
    });
  });
});

// 応答の形が想定と違うときは失敗にする（BFF はこれを upstream / contract として扱う）
describe("GitHub の応答の形が想定と違う", () => {
  function without(obj: object, key: string): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
  }

  it("必要な項目が欠けていれば、その項目名を含めて失敗する", () => {
    const result = parseGitHubRepo(without(repoReactReact, "stargazers_count"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues.map((i) => i.path)).toContain("stargazers_count");
  });

  it("項目の型が違えば失敗する（検索の items の中も）", () => {
    const [first, ...rest] = searchFew.items;
    const result = parseGitHubSearch({
      ...searchFew,
      items: [{ ...first, stargazers_count: "250916" }, ...rest],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues.map((i) => i.path)).toContain("items.0.stargazers_count");
  });

  it("モデルの規則に反する値（負の star 数）は、モデルの項目名で失敗する", () => {
    const result = parseGitHubSearch({
      ...searchFew,
      items: searchFew.items.map((item) => ({ ...item, stargazers_count: -1 })),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues.map((i) => i.path)).toContain("items.0.stars");
  });

  it("検索結果が 20 件を超えていれば失敗する", () => {
    const item = searchReact.items[0];
    const result = parseGitHubSearch({
      total_count: 100,
      items: Array.from({ length: 21 }, () => item),
    });

    expect(result.ok).toBe(false);
  });

  it("オブジェクトでない値（null、配列）は失敗する", () => {
    expect(parseGitHubSearch(null).ok).toBe(false);
    expect(parseGitHubRepo([]).ok).toBe(false);
  });
});
