import type { LogFields, Logger } from "./logger";

// 想定外の例外の報告先。実インフラ（Sentry 等）に差し替えられるよう interface にしておく
export interface ErrorReporter {
  report(error: unknown, context: { requestId: string; route?: string } & LogFields): void;
}

// 既定の報告先: Logger の error として記録する
export function createLoggerReporter(logger: Logger): ErrorReporter {
  return {
    report(error, context) {
      if (error instanceof Error) {
        logger.log("error", error.message, {
          ...context,
          errorName: error.name,
          stack: error.stack,
        });
        return;
      }
      logger.log("error", String(error), context);
    },
  };
}
