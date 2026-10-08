import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleLogger } from "./console";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createConsoleLogger", () => {
  it("error を JSON 1 行にして console.error へ出す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createConsoleLogger(() => new Date("2026-10-08T12:00:00.000Z"));

    logger.log("error", "GitHub が落ちています", { requestId: "req-1", status: 503 });

    expect(spy).toHaveBeenCalledTimes(1);
    const line: unknown = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line).toEqual({
      level: "error",
      time: "2026-10-08T12:00:00.000Z",
      message: "GitHub が落ちています",
      requestId: "req-1",
      status: 503,
    });
  });

  it("warn は console.warn へ出し、error 側には出さない", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createConsoleLogger();

    logger.log("warn", "レート制限");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});
