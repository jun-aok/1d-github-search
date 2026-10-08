import { MAX_PAGE, MAX_RESULTS, PER_PAGE, pagination, totalPages } from "./pagination";

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

describe("pagination", () => {
  const at = (page: number) => ({ query: "react", page });

  it("途中のページは前後どちらにも移れる", () => {
    expect(pagination(at(2), 100)).toEqual({ page: 2, totalPages: 5, prevPage: 1, nextPage: 3 });
  });

  it("先頭ページには「前へ」が無い", () => {
    expect(pagination(at(1), 100)).toEqual({ page: 1, totalPages: 5, prevPage: null, nextPage: 2 });
  });

  it("最終ページには「次へ」が無い", () => {
    expect(pagination(at(5), 100)).toEqual({ page: 5, totalPages: 5, prevPage: 4, nextPage: null });
  });

  it("1 ページだけなら前後とも無い", () => {
    expect(pagination(at(1), 2)).toEqual({
      page: 1,
      totalPages: 1,
      prevPage: null,
      nextPage: null,
    });
  });

  it("1,000 件を超えても最終ページは 50", () => {
    expect(pagination(at(50), 123456)).toEqual({
      page: 50,
      totalPages: 50,
      prevPage: 49,
      nextPage: null,
    });
    expect(pagination(at(49), 123456).nextPage).toBe(50);
  });

  it("総ページ数を超えたページでは「前へ」は最終ページへ、「次へ」は無い", () => {
    expect(pagination(at(10), 100)).toEqual({
      page: 10,
      totalPages: 5,
      prevPage: 5,
      nextPage: null,
    });
    expect(pagination(at(6), 100).prevPage).toBe(5);
  });

  it("0 件なら前後とも無い（範囲外のページでも）", () => {
    expect(pagination(at(1), 0)).toEqual({
      page: 1,
      totalPages: 0,
      prevPage: null,
      nextPage: null,
    });
    expect(pagination(at(3), 0)).toEqual({
      page: 3,
      totalPages: 0,
      prevPage: null,
      nextPage: null,
    });
  });
});
