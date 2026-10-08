import { parseRepoDetail, parseRepoSummary } from "./repo";

const summary = {
  id: 10270250,
  fullName: "facebook/react",
  owner: { login: "facebook", avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4" },
  description: "The library for web and native user interfaces.",
  language: "JavaScript",
  stars: 243000,
  url: "https://github.com/facebook/react",
};

describe("parseRepoSummary", () => {
  it("4 節の JSON の形をそのまま受け取る", () => {
    expect(parseRepoSummary(summary)).toEqual({ ok: true, value: summary });
  });

  it("description と language は null でもよい", () => {
    const input = { ...summary, description: null, language: null };
    expect(parseRepoSummary(input)).toEqual({ ok: true, value: input });
  });

  it("余分な項目は捨てる", () => {
    expect(parseRepoSummary({ ...summary, private: false })).toEqual({ ok: true, value: summary });
  });

  describe("欠けた項目は失敗し、path にその項目名が入る", () => {
    it.each(["id", "fullName", "owner", "description", "language", "stars", "url"])("%s", (key) => {
      const input = Object.fromEntries(Object.entries(summary).filter(([k]) => k !== key));
      const r = parseRepoSummary(input);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.issues.map((i) => i.path)).toEqual([key]);
    });

    it("owner の中の項目は owner.login のように path に入る", () => {
      const r = parseRepoSummary({ ...summary, owner: { avatarUrl: summary.owner.avatarUrl } });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.issues.map((i) => i.path)).toEqual(["owner.login"]);
    });
  });

  describe("数値は 0 以上の整数", () => {
    it.each([
      ["0", 0, true],
      ["1", 1, true],
      ["-1", -1, false],
      ["小数", 1.5, false],
      ["文字列", "10", false],
      ["null", null, false],
      ["NaN", Number.NaN, false],
    ])("stars が %s", (_name, stars, expected) => {
      expect(parseRepoSummary({ ...summary, stars }).ok).toBe(expected);
    });

    it("id が負数なら失敗する", () => {
      expect(parseRepoSummary({ ...summary, id: -1 }).ok).toBe(false);
    });
  });

  describe("URL は https", () => {
    it.each([
      ["url が http", { url: "http://github.com/facebook/react" }],
      ["url が URL でない", { url: "github.com/facebook/react" }],
      [
        "avatarUrl が http",
        { owner: { login: "facebook", avatarUrl: "http://avatars.githubusercontent.com/u/69631" } },
      ],
      [
        "avatarUrl が javascript:",
        { owner: { login: "facebook", avatarUrl: "javascript:alert(1)" } },
      ],
    ])("%s は失敗する", (_name, override) => {
      expect(parseRepoSummary({ ...summary, ...override }).ok).toBe(false);
    });
  });

  it("オブジェクトでない入力は失敗する", () => {
    expect(parseRepoSummary(null).ok).toBe(false);
    expect(parseRepoSummary("x").ok).toBe(false);
    expect(parseRepoSummary([]).ok).toBe(false);
  });
});

describe("parseRepoDetail", () => {
  const detail = { ...summary, watchers: 6700, forks: 49000, openIssues: 1100 };

  it("RepoSummary に watchers・forks・openIssues を足した形を受け取る", () => {
    expect(parseRepoDetail(detail)).toEqual({ ok: true, value: detail });
  });

  it("language が null でもよい", () => {
    const input = { ...detail, language: null };
    expect(parseRepoDetail(input)).toEqual({ ok: true, value: input });
  });

  describe("watchers・forks・openIssues が欠ければ失敗し、path に項目名が入る", () => {
    it.each(["watchers", "forks", "openIssues"])("%s", (key) => {
      const input = Object.fromEntries(Object.entries(detail).filter(([k]) => k !== key));
      const r = parseRepoDetail(input);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.issues.map((i) => i.path)).toEqual([key]);
    });
  });

  it.each(["watchers", "forks", "openIssues"])("%s が負数や小数なら失敗する", (key) => {
    expect(parseRepoDetail({ ...detail, [key]: -1 }).ok).toBe(false);
    expect(parseRepoDetail({ ...detail, [key]: 0.5 }).ok).toBe(false);
    expect(parseRepoDetail({ ...detail, [key]: 0 }).ok).toBe(true);
  });

  it("RepoSummary と同じ規則（url は https）を持つ", () => {
    expect(parseRepoDetail({ ...detail, url: "http://github.com/facebook/react" }).ok).toBe(false);
  });
});
