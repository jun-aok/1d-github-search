import type { ErrorReporter } from "./errorReporter";
import type { LogFields, Logger, LogLevel } from "./logger";

export type LogEntry = { level: LogLevel; message: string; fields: LogFields };
export type ReportEntry = { error: unknown; context: { requestId: string } & LogFields };

// テスト用。記録を配列に貯めて、テストが「記録されたこと」を検証する
export function createMemoryLogger(): Logger & { readonly entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    log(level, message, fields) {
      entries.push({ level, message, fields: fields ?? {} });
    },
  };
}

export function createMemoryReporter(): ErrorReporter & { readonly reports: ReportEntry[] } {
  const reports: ReportEntry[] = [];
  return {
    reports,
    report(error, context) {
      reports.push({ error, context });
    },
  };
}
