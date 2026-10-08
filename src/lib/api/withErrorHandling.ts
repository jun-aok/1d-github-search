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

// GitHub のステータスとレート制限の残り・回復時刻。どのトークンの枠を使い切ったかを後から確かめるため
function responseFields(response: GitHubResponseInfo | undefined): LogFields {
  return response === undefined ? {} : { ...response };
}

// 記録するもの（docs/design.md 8 節）: requestId、ルート、q と page（検索条件は個人情報ではない）、原因、
// GitHub のステータスと x-ratelimit-*、所要時間。
// 記録しないもの: トークン、Authorization ヘッダー、リクエスト全文
function logFailure(logger: Logger, error: AppError, fields: LogFields): void {
  switch (error.kind) {
    case "bad_request":
    case "not_found":
    case "invalid_request":
      return;
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

function requestFields(req: NextRequest, requestId: string): LogFields {
  const params = req.nextUrl.searchParams;
  const q = params.get("q");
  const page = params.get("page");
  return {
    requestId,
    route: req.nextUrl.pathname,
    ...(q === null ? {} : { q: q.slice(0, 256) }),
    ...(page === null ? {} : { page: page.slice(0, 16) }),
  };
}

// すべての Route Handler を包む共通部品。requestId の発行、Result → Response の変換、ログ、想定外の例外の捕捉は
// ここにだけ集まる（docs/design.md 8 節）
export function withErrorHandling(handler: Handler, deps: Deps = defaultDeps) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    try {
      const result = await handler(req, ctx, deps);
      if (result.ok) {
        return Response.json(result.value, { headers: { "x-request-id": requestId } });
      }
      const durationMs = Math.round(performance.now() - startedAt);
      logFailure(deps.logger, result.error, { ...requestFields(req, requestId), durationMs });
      return respond(result.error, requestId, deps.env);
    } catch (e) {
      deps.reporter.report(e, { requestId, route: req.nextUrl.pathname });
      const detail = e instanceof Error ? (e.stack ?? String(e)) : String(e);
      return respond({ kind: "internal", detail }, requestId, deps.env);
    }
  };
}
