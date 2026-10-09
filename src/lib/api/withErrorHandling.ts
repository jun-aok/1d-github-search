import type { NextRequest } from "next/server";
import { env, type Env } from "@/lib/env";
import type { GitHubClient } from "@/lib/github/githubClient";
import type { GitHubResponseInfo } from "@/lib/github/githubError";
import { createGitHubClient } from "@/lib/github";
import { logger, reporter } from "@/lib/observability";
import type { ErrorReporter } from "@/lib/observability/errorReporter";
import type { LogFields, Logger } from "@/lib/observability/logger";
import type { Result } from "@/lib/model/result";
import type { AppError } from "./appError";
import { respond } from "./respond";

// Route Handler の第 2 引数。params は Promise（Next.js 16）
export type RouteContext = { params: Promise<Record<string, string>> };

export type Deps = {
  github: GitHubClient;
  logger: Logger;
  reporter: ErrorReporter;
  env: Env;
};

// 既定は環境から組み立てる。テストでは withErrorHandling の第 2 引数で差し替える
export const defaultDeps: Deps = {
  github: createGitHubClient(env, logger),
  logger,
  reporter,
  env,
};

export type Handler = (
  req: NextRequest,
  ctx: RouteContext,
  deps: Deps,
) => Promise<Result<unknown, AppError>>;

// GitHub のステータスと x-ratelimit-remaining / reset をログの項目にする。応答が無かった失敗では空
function responseFields(response: GitHubResponseInfo | undefined): LogFields {
  return response === undefined ? {} : { ...response };
}

// 失敗を種類に応じた水準で記録する（docs/design.md 8 節）。
// 記録するもの: requestId、ルート、q と page（検索条件は個人情報ではない）、原因、
// GitHub のステータスと x-ratelimit-*、所要時間。
// 記録しないもの: トークン、Authorization ヘッダー、リクエスト全文
function logFailure(logger: Logger, error: AppError, fields: LogFields): void {
  switch (error.kind) {
    case "bad_request":
    case "not_found":
    case "invalid_request":
      // 利用者の入力が原因の想定内の失敗なので記録しない（docs/design.md 8 節）
      return;
    // 障害ではないが、頻度を見るために warn で残す
    case "rate_limited":
      logger.log("warn", "GitHub のレート制限に達しました", {
        ...fields,
        kind: error.kind,
        retryAfter: error.retryAfter,
        ...responseFields(error.response),
      });
      return;
    case "upstream":
      logger.log("error", "GitHub への問い合わせに失敗しました", {
        ...fields,
        kind: error.kind,
        reason: error.reason,
        detail: error.detail,
        ...responseFields(error.response),
      });
      return;
    case "internal":
      logger.log("error", "BFF で想定外のエラーが起きました", {
        ...fields,
        kind: error.kind,
        detail: error.detail,
      });
      return;
  }
}

// 失敗の記録と想定外の例外の記録で同じ項目を残す（docs/design.md 8 節）
function requestFields(
  req: NextRequest,
  requestId: string,
  startedAt: number,
): { requestId: string; route: string } & LogFields {
  const params = req.nextUrl.searchParams;
  const q = params.get("q");
  const page = params.get("page");
  return {
    requestId,
    route: req.nextUrl.pathname,
    // 不正な長い入力でログが膨らまないよう切る。q は検索条件の上限と同じ 256 文字
    ...(q === null ? {} : { q: q.slice(0, 256) }),
    ...(page === null ? {} : { page: page.slice(0, 16) }),
    durationMs: Math.round(performance.now() - startedAt),
  };
}

// すべての Route Handler を包む共通部品（docs/design.md 8 節）。requestId の発行、
// Result → Response の変換、ログ、想定外の例外の捕捉はここにだけ集まる
export function withErrorHandling(handler: Handler, deps: Deps = defaultDeps) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    try {
      const result = await handler(req, ctx, deps);
      if (result.ok) {
        return Response.json(result.value, { headers: { "x-request-id": requestId } });
      }
      logFailure(deps.logger, result.error, requestFields(req, requestId, startedAt));
      return respond(result.error, requestId, deps.env);
    } catch (e) {
      deps.reporter.report(e, requestFields(req, requestId, startedAt));
      const detail = e instanceof Error ? (e.stack ?? String(e)) : String(e);
      return respond({ kind: "internal", detail }, requestId, deps.env);
    }
  };
}
