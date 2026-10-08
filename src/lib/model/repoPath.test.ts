import { parseRepoPath } from "./repoPath";

describe("parseRepoPath", () => {
  it("owner と repo を RepoPath（owner, name）にする", () => {
    expect(parseRepoPath({ owner: "facebook", repo: "react" })).toEqual({
      ok: true,
      value: { owner: "facebook", name: "react" },
    });
  });

  describe("URL を壊すものを断る", () => {
    it.each([
      ["owner が .", { owner: ".", repo: "react" }],
      ["owner が ..", { owner: "..", repo: "react" }],
      ["repo が .", { owner: "facebook", repo: "." }],
      ["repo が ..", { owner: "facebook", repo: ".." }],
      ["owner に /", { owner: "a/b", repo: "react" }],
      ["repo に /", { owner: "facebook", repo: "a/b" }],
      ["owner に \\", { owner: "a\\b", repo: "react" }],
      ["repo に \\", { owner: "facebook", repo: "a\\b" }],
      ["owner に半角空白", { owner: "a b", repo: "react" }],
      ["repo に全角空白", { owner: "facebook", repo: "a\u3000b" }],
      ["repo にタブ", { owner: "facebook", repo: "a\tb" }],
      ["owner に改行", { owner: "a\nb", repo: "react" }],
      ["repo に NUL", { owner: "facebook", repo: "a\u0000b" }],
      ["repo に DEL", { owner: "facebook", repo: "a\u007fb" }],
      ["owner が空", { owner: "", repo: "react" }],
      ["repo が空", { owner: "facebook", repo: "" }],
    ])("%s", (_name, input) => {
      expect(parseRepoPath(input).ok).toBe(false);
    });
  });

  describe("通すもの（実在するかは GitHub に判断させる）", () => {
    it.each([
      ["ハイフン・アンダースコア・ドット・数字", { owner: "my-org1", repo: "my_repo.js-2" }],
      ["先頭がドット", { owner: "facebook", repo: ".github" }],
      ["... のようなドットだけの 3 文字", { owner: "facebook", repo: "..." }],
      ["日本語", { owner: "facebook", repo: "リポジトリ" }],
    ])("%s", (_name, input) => {
      expect(parseRepoPath(input).ok).toBe(true);
    });
  });

  describe("長さの上限（owner 39 文字、name 100 文字）", () => {
    it.each([
      ["owner 39 文字", { owner: "a".repeat(39), repo: "react" }, true],
      ["owner 40 文字", { owner: "a".repeat(40), repo: "react" }, false],
      ["repo 100 文字", { owner: "facebook", repo: "a".repeat(100) }, true],
      ["repo 101 文字", { owner: "facebook", repo: "a".repeat(101) }, false],
    ])("%s", (_name, input, expected) => {
      expect(parseRepoPath(input).ok).toBe(expected);
    });
  });

  it("owner か repo が文字列でなければ失敗し、path に項目名が入る", () => {
    const r = parseRepoPath({ owner: 1, repo: "react" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.issues[0]?.path).toBe("owner");
    expect(parseRepoPath({ owner: "facebook" }).ok).toBe(false);
    expect(parseRepoPath(null).ok).toBe(false);
  });
});
