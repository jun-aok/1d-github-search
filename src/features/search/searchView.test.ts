import { describe, expect, it } from "vitest";
import { fail, ok } from "@/lib/model/result";
import { searchEmptyResult, searchReactResult } from "@/mocks/bffHandlers";
import { aSearchCondition } from "@/test/builders";
import { searchView } from "./searchView";

describe("searchView", () => {
  it("URL に q が無い（条件が null）ときと、URL のパラメータが不正なときは初期", () => {
    expect(searchView({ condition: null, response: undefined, isFetching: false })).toEqual({
      kind: "initial",
    });
    expect(
      searchView({
        condition: fail({ issues: [{ path: "page", message: "invalid" }] }),
        response: { condition: aSearchCondition("react"), result: ok(searchEmptyResult) },
        isFetching: false,
      }),
    ).toEqual({ kind: "initial" });
  });

  it("取得中で前の結果が無いときは、スケルトン（loading）", () => {
    expect(
      searchView({
        condition: ok(aSearchCondition("react")),
        response: undefined,
        isFetching: true,
      }),
    ).toEqual({ kind: "loading" });
  });

  it("結果があれば一覧（loaded）。ページネーションと件数の範囲は応答の条件から求める", () => {
    const condition = aSearchCondition("react", 2);
    expect(
      searchView({
        condition: ok(condition),
        response: { condition, result: ok(searchReactResult) },
        isFetching: false,
      }),
    ).toEqual({
      kind: "loaded",
      result: searchReactResult,
      pagination: { page: 2, totalPages: 50, prevPage: 1, nextPage: 3 },
      range: { from: 21, to: 40 },
    });
  });

  it("totalCount が 0 なら 0 件（empty）。案内に出すキーワードは応答の条件のもの", () => {
    const condition = aSearchCondition("__empty__");
    expect(
      searchView({
        condition: ok(condition),
        response: { condition, result: ok(searchEmptyResult) },
        isFetching: false,
      }),
    ).toEqual({ kind: "empty", query: "__empty__" });
  });
});
