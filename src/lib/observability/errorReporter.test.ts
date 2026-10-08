import { describe, expect, it } from "vitest";
import { createLoggerReporter } from "./errorReporter";
import { createMemoryLogger } from "./memory";

describe("createLoggerReporter", () => {
  it("例外のメッセージとスタックを requestId・route と一緒に error として記録する", () => {
    const logger = createMemoryLogger();
    const reporter = createLoggerReporter(logger);
    const error = new Error("boom");

    reporter.report(error, { requestId: "req-1", route: "/api/search" });

    expect(logger.entries).toEqual([
      {
        level: "error",
        message: "boom",
        fields: {
          requestId: "req-1",
          route: "/api/search",
          errorName: "Error",
          stack: error.stack,
        },
      },
    ]);
  });

  it("Error でない値が投げられても、文字列にして記録する", () => {
    const logger = createMemoryLogger();

    createLoggerReporter(logger).report("文字列の例外", { requestId: "req-2" });

    expect(logger.entries).toEqual([
      { level: "error", message: "文字列の例外", fields: { requestId: "req-2" } },
    ]);
  });
});
