import type { Logger } from "./logger";

// 標準出力（console）へ JSON 1 行で出す。Vercel 等ではそのままログ基盤に流れる（docs/design.md 8 節）
export function createConsoleLogger(now: () => Date = () => new Date()): Logger {
  return {
    log(level, message, fields) {
      const line = JSON.stringify({ level, time: now().toISOString(), message, ...fields });
      if (level === "error") {
        console.error(line);
      } else {
        console.warn(line);
      }
    },
  };
}
