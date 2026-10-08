import { parseSearchCondition, searchConditionFromParams, toSearchParams } from "./searchCondition";

describe("parseSearchCondition", () => {
  it("query の前後の空白を除いて受け取る", () => {
    expect(parseSearchCondition({ query: "  react ", page: 2 })).toEqual({
      ok: true,
      value: { query: "react", page: 2 },
    });
  });

  describe("query の長さ（trim 後 1〜256 文字）", () => {
    it.each([
      ["空文字", "", false],
      ["空白のみ", "   ", false],
      ["1 文字", "a", true],
      ["256 文字", "a".repeat(256), true],
      ["257 文字", "a".repeat(257), false],
      ["空白を含めて 257 文字でも trim 後 256 文字なら通す", ` ${"a".repeat(256)}`, true],
    ])("%s", (_name, query, expected) => {
      expect(parseSearchCondition({ query, page: 1 }).ok).toBe(expected);
    });
  });

  describe("page（1〜50 の整数）", () => {
    it.each([
      ["0", 0, false],
      ["1", 1, true],
      ["50", 50, true],
      ["51", 51, false],
      ["小数", 1.5, false],
      ["負数", -1, false],
      ["文字列", "2", false],
    ])("%s", (_name, page, expected) => {
      expect(parseSearchCondition({ query: "react", page }).ok).toBe(expected);
    });
  });
});

describe("parseSearchCondition の失敗", () => {
  it("失敗した項目の path と message を ParseError に詰める", () => {
    const r = parseSearchCondition({ query: "", page: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.issues).toHaveLength(1);
    expect(r.error.issues[0]?.path).toBe("query");
    expect(r.error.issues[0]?.message).not.toBe("");
  });

  it.each([
    ["null", null],
    ["文字列", "react"],
    ["項目なし", {}],
  ])("%s は失敗する", (_name, input) => {
    expect(parseSearchCondition(input).ok).toBe(false);
  });
});

describe("searchConditionFromParams", () => {
  it("q と page を検索条件にする", () => {
    expect(searchConditionFromParams(new URLSearchParams("q=react&page=3"))).toEqual({
      ok: true,
      value: { query: "react", page: 3 },
    });
  });

  it("page を省略すると 1 ページ目になる", () => {
    expect(searchConditionFromParams(new URLSearchParams("q=react"))).toEqual({
      ok: true,
      value: { query: "react", page: 1 },
    });
  });

  it("q が無ければ失敗する（page だけあっても同じ）", () => {
    expect(searchConditionFromParams(new URLSearchParams("")).ok).toBe(false);
    expect(searchConditionFromParams(new URLSearchParams("page=2")).ok).toBe(false);
  });

  it("q が空・空白のみ・257 文字なら失敗する", () => {
    for (const q of ["", "  ", "a".repeat(257)]) {
      expect(searchConditionFromParams(new URLSearchParams({ q })).ok).toBe(false);
    }
  });

  it.each([
    ["0", false],
    ["1", true],
    ["50", true],
    ["51", false],
    ["02", false],
    ["2.0", false],
    ["+2", false],
    ["-1", false],
    ["1e1", false],
    ["0x10", false],
    ["", false],
    [" 2", false],
    ["abc", false],
  ])("page=%j は %s", (page, expected) => {
    expect(searchConditionFromParams(new URLSearchParams({ q: "react", page })).ok).toBe(expected);
  });
});

describe("toSearchParams", () => {
  it("page が 2 以上なら q と page を出す", () => {
    expect(toSearchParams({ query: "react", page: 3 }).toString()).toBe("q=react&page=3");
  });

  it("page が 1 なら page を省略する", () => {
    expect(toSearchParams({ query: "react", page: 1 }).toString()).toBe("q=react");
  });

  it("日本語や空白を含む query は URL エンコードされ、読み戻すと同じ条件になる", () => {
    const condition = { query: "リアクト hooks&a=b", page: 2 };
    const back = searchConditionFromParams(
      new URLSearchParams(toSearchParams(condition).toString()),
    );
    expect(back).toEqual({ ok: true, value: condition });
  });
});
