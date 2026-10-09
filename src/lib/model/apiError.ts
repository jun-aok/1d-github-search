import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const errorSchema = z.object({
  code: z.enum(["BAD_REQUEST", "NOT_FOUND", "RATE_LIMITED", "UPSTREAM_ERROR", "INTERNAL_ERROR"]),
  message: z.string(),
  requestId: z.string().optional(),
  detail: z.string().optional(),
  retryAfter: z.number().int().min(0).optional(),
});

// 成功の応答と見分けるために { error: ... } で 1 段包む（docs/design.md 4 節）
const responseSchema = z.object({ error: errorSchema });

export type ApiError = DeepReadonly<z.infer<typeof errorSchema>>;

export type ErrorResponse = DeepReadonly<z.infer<typeof responseSchema>>;

// ブラウザ側で BFF のエラー応答の JSON を ErrorResponse に解析する
export function parseErrorResponse(input: unknown): Result<ErrorResponse, ParseError> {
  return safeParse(responseSchema, input);
}

// ApiError と違い requestId は必須。BFF が作るエラー応答には必ず問い合わせ番号を付ける
export type ErrorResponseInput = {
  code: ApiError["code"];
  message: string;
  requestId: string;
  detail?: string | undefined;
  retryAfter?: number | undefined;
};

// BFF がエラー応答を作る唯一の入口（モデルの型の値はモデルのファイル内の関数から作る。docs/design.md 3 節）
export function createErrorResponse(input: ErrorResponseInput): ErrorResponse {
  const { code, message, requestId, detail, retryAfter } = input;
  return {
    error: {
      code,
      message,
      requestId,
      ...(detail === undefined ? {} : { detail }),
      // 規則（0 以上の整数）に丸めてから出す。外れるとブラウザ側の parse で別のエラーに化ける
      ...(retryAfter === undefined ? {} : { retryAfter: Math.max(0, Math.ceil(retryAfter)) }),
    },
  };
}

// ブラウザ側で BFF のエラー応答を得られなかったとき（BFF に届かない、JSON でない、形が違う）の ApiError。
// BFF を通っていないので問い合わせ番号は無い。画面の分岐（docs/design.md 5 節）では通信エラーとして扱う
export function createClientError(message: string, detail?: string): ApiError {
  return { code: "UPSTREAM_ERROR", message, ...(detail === undefined ? {} : { detail }) };
}
