export type LogLevel = "warn" | "error";
export type LogFields = Record<string, unknown>;

// 記録先の抽象化（docs/design.md 8 節）。Route Handler はこの interface にだけ依存する
export interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}
