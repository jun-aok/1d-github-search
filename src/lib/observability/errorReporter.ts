import type { LogFields } from "./logger";

// 想定外の例外の報告先。実インフラ（Sentry 等）に差し替えられるよう interface にしておく
export interface ErrorReporter {
  report(error: unknown, context: { requestId: string; route?: string } & LogFields): void;
}
