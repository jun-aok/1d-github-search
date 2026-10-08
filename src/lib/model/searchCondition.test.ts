import { parseSearchCondition } from "./searchCondition";

describe("parseSearchCondition", () => {
  it("query の前後の空白を除いて受け取る", () => {
    expect(parseSearchCondition({ query: "  react ", page: 2 })).toEqual({
      ok: true,
      value: { query: "react", page: 2 },
    });
  });
});
