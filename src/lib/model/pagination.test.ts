import { MAX_PAGE, MAX_RESULTS, PER_PAGE, totalPages } from "./pagination";

describe("定数", () => {
  it("1 ページ 20 件、GitHub の検索は先頭 1,000 件まで、最大 50 ページ", () => {
    expect(PER_PAGE).toBe(20);
    expect(MAX_RESULTS).toBe(1000);
    expect(MAX_PAGE).toBe(50);
  });
});

describe("totalPages", () => {
  it.each([
    [0, 0],
    [1, 1],
    [20, 1],
    [21, 2],
    [999, 50],
    [1000, 50],
    [1001, 50],
    [1_000_000, 50],
  ])("%i 件なら %i ページ", (totalCount, expected) => {
    expect(totalPages(totalCount)).toBe(expected);
  });
});
