import { describe, expect, it } from "vitest";
import { fail, ok } from "@/lib/model/result";
import { searchEmptyResult } from "@/mocks/bffHandlers";
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
});
