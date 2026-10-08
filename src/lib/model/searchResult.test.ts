import { parseSearchResult } from "./searchResult";

function repo(id: number) {
  const n = String(id);
  return {
    id,
    fullName: `owner${n}/repo${n}`,
    owner: { login: `owner${n}`, avatarUrl: `https://avatars.githubusercontent.com/u/${n}?v=4` },
    description: id % 2 === 0 ? null : "説明",
    language: id % 3 === 0 ? null : "TypeScript",
    stars: id * 10,
    url: `https://github.com/owner${n}/repo${n}`,
  };
}

function repos(n: number) {
  return Array.from({ length: n }, (_, i) => repo(i + 1));
}

describe("parseSearchResult", () => {
  it("totalCount と items を受け取る", () => {
    const input = { totalCount: 2, items: repos(2) };
    expect(parseSearchResult(input)).toEqual({ ok: true, value: input });
  });

  it("0 件（totalCount 0、items 空）を受け取る", () => {
    expect(parseSearchResult({ totalCount: 0, items: [] })).toEqual({
      ok: true,
      value: { totalCount: 0, items: [] },
    });
  });

  it("totalCount が items より大きくてよい（全体の件数）", () => {
    const input = { totalCount: 123456, items: repos(20) };
    expect(parseSearchResult(input)).toEqual({ ok: true, value: input });
  });

  describe("items は最大 20 件", () => {
    it.each([
      [20, true],
      [21, false],
    ])("%i 件", (n, expected) => {
      expect(parseSearchResult({ totalCount: 1000, items: repos(n) }).ok).toBe(expected);
    });
  });

  it.each([
    ["負数", -1],
    ["小数", 1.5],
    ["文字列", "2"],
    ["null", null],
  ])("totalCount が %s なら失敗する", (_name, totalCount) => {
    expect(parseSearchResult({ totalCount, items: [] }).ok).toBe(false);
  });

  it("totalCount か items が欠ければ失敗し、path に項目名が入る", () => {
    const noTotal = parseSearchResult({ items: [] });
    const noItems = parseSearchResult({ totalCount: 0 });
    expect(noTotal.ok || noTotal.error.issues.map((i) => i.path)).toEqual(["totalCount"]);
    expect(noItems.ok || noItems.error.issues.map((i) => i.path)).toEqual(["items"]);
  });

  it("items の中に不正な項目があれば、何番目のどの項目かを path に入れて失敗する", () => {
    const items = [repo(1), { ...repo(2), stars: -1 }, repo(3)];
    const r = parseSearchResult({ totalCount: 3, items });
    expect(r.ok || r.error.issues.map((i) => i.path)).toEqual(["items.1.stars"]);
  });

  it("items の要素がオブジェクトでなければ items.N で失敗する", () => {
    const r = parseSearchResult({ totalCount: 1, items: [null] });
    expect(r.ok || r.error.issues.map((i) => i.path)).toEqual(["items.0"]);
  });

  it("オブジェクトでない入力は失敗する", () => {
    expect(parseSearchResult(null).ok).toBe(false);
    expect(parseSearchResult([]).ok).toBe(false);
  });
});
