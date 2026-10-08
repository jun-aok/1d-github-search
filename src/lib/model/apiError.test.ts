import { parseErrorResponse } from "./apiError";

describe("parseErrorResponse", () => {
  it("code と message だけのエラー応答を受け取る", () => {
    const input = { error: { code: "NOT_FOUND", message: "Not found" } };
    expect(parseErrorResponse(input)).toEqual({ ok: true, value: input });
  });
});
