import { fail, ok } from "./result";

describe("Result", () => {
  it("ok は成功の値を包む", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it("fail は失敗の値を包む", () => {
    expect(fail("x")).toEqual({ ok: false, error: "x" });
  });
});
