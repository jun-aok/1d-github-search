import { parseSearchCondition } from "./searchCondition";

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
});
