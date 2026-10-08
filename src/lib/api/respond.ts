import type { Env } from "@/lib/env";
import { createErrorResponse, type ApiError } from "@/lib/model/apiError";
import type { AppError } from "./appError";

type Code = ApiError["code"];

// AppError → ステータスと ApiError の変換表（docs/design.md 4 節）。
// message は開発者向けの短い説明（画面は code で分岐し、message は表示しない）。種類を足すと switch が網羅でなくなりコンパイルエラーになる
function describe(error: AppError): { status: number; code: Code; message: string } {
  switch (error.kind) {
    case "bad_request":
    case "invalid_request":
      return { status: 400, code: "BAD_REQUEST", message: "Bad request" };
    case "not_found":
      return { status: 404, code: "NOT_FOUND", message: "Not found" };
    case "rate_limited":
      return { status: 429, code: "RATE_LIMITED", message: "GitHub rate limit exceeded" };
    case "upstream":
      return { status: 502, code: "UPSTREAM_ERROR", message: "GitHub request failed" };
    case "internal":
      return { status: 500, code: "INTERNAL_ERROR", message: "Internal error" };
  }
}

function detailOf(error: AppError): string | undefined {
  switch (error.kind) {
    case "not_found":
    case "rate_limited":
      return undefined;
    case "bad_request":
    case "invalid_request":
    case "upstream":
    case "internal":
      return error.detail;
  }
}

// detail を含めるのは development（と test）のときだけ。production では応答にもスタックや GitHub の本文を出さない
export function respond(error: AppError, requestId: string, env: Env): Response {
  const { status, code, message } = describe(error);
  const detail = env.nodeEnv === "production" ? undefined : detailOf(error);
  const body = createErrorResponse({
    code,
    message,
    requestId,
    detail,
    retryAfter: error.kind === "rate_limited" ? error.retryAfter : undefined,
  });
  return Response.json(body, { status, headers: { "x-request-id": requestId } });
}
