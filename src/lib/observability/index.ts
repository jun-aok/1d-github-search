import { createLoggerReporter } from "./errorReporter";
import { createConsoleLogger } from "./console";

// 既定の記録先は標準出力（docs/design.md 8 節）。実インフラを入れるときは、ここの選択を変える。
// テストは Deps に memory.ts の実装を注入するので、環境による分岐は持たない
export const logger = createConsoleLogger();
export const reporter = createLoggerReporter(logger);
