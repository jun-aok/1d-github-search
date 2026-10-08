import { parseErrorResponse } from "./apiError";

describe("parseErrorResponse", () => {
  it("code と message だけのエラー応答を受け取る", () => {
    const input = { error: { code: "NOT_FOUND", message: "Not found" } };
    expect(parseErrorResponse(input)).toEqual({ ok: true, value: input });
  });

  it("requestId・detail・retryAfter も受け取る", () => {
    const input = {
      error: {
        code: "RATE_LIMITED",
        message: "rate limited",
        requestId: "6f1c0a52-2f7e-4b53-9c1e-0a9d8e1b2c3d",
        detail: "API rate limit exceeded",
        retryAfter: 42,
      },
    };
    expect(parseErrorResponse(input)).toEqual({ ok: true, value: input });
  });

  it.each(["BAD_REQUEST", "NOT_FOUND", "RATE_LIMITED", "UPSTREAM_ERROR", "INTERNAL_ERROR"])(
    "code %s を受け取る",
    (code) => {
      expect(parseErrorResponse({ error: { code, message: "m" } }).ok).toBe(true);
    },
  );

  it("知らない code は失敗する", () => {
    const r = parseErrorResponse({ error: { code: "TEAPOT", message: "m" } });
    expect(r.ok || r.error.issues.map((i) => i.path)).toEqual(["error.code"]);
  });

  it("message が無ければ失敗する", () => {
    const r = parseErrorResponse({ error: { code: "NOT_FOUND" } });
    expect(r.ok || r.error.issues.map((i) => i.path)).toEqual(["error.message"]);
  });

  it.each([
    ["requestId が数値", { requestId: 1 }],
    ["detail が数値", { detail: 1 }],
    ["retryAfter が負数", { retryAfter: -1 }],
    ["retryAfter が文字列", { retryAfter: "10" }],
    ["retryAfter が小数", { retryAfter: 1.5 }],
  ])("%s なら失敗する", (_name, extra) => {
    expect(parseErrorResponse({ error: { code: "RATE_LIMITED", message: "m", ...extra } }).ok).toBe(
      false,
    );
  });

  it("retryAfter が 0 なら受け取る", () => {
    expect(
      parseErrorResponse({ error: { code: "RATE_LIMITED", message: "m", retryAfter: 0 } }).ok,
    ).toBe(true);
  });

  it("error で包まれていない入力（成功の応答など）は失敗する", () => {
    expect(parseErrorResponse({ code: "NOT_FOUND", message: "m" }).ok).toBe(false);
    expect(parseErrorResponse({ totalCount: 0, items: [] }).ok).toBe(false);
    expect(parseErrorResponse(null).ok).toBe(false);
  });
});
