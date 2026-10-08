import type { ParseError } from "@/lib/model/result";
// GitHub 呼び出しの失敗（docs/design.md 4 節）。判別共用体で、種類を足すと対応漏れがコンパイルエラーになる
export type GitHubError =
  | { kind: "rate_limited"; retryAfter: number; response?: GitHubResponseInfo }
  | { kind: "not_found" }
  | { kind: "invalid_request"; detail: string }
  | {
      kind: "upstream";
      reason: "http" | "network" | "timeout" | "contract";
      detail: string;
      response?: GitHubResponseInfo;
    };

// GitHub が返したステータスとレート制限のヘッダー。ログにだけ残し、BFF の応答には出さない（docs/design.md 8 節）。
// GitHub の応答が無い失敗（繋がらない・時間切れ）や偽物の GitHub には無い
export type GitHubResponseInfo = {
  status: number;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
};

// 応答の形が想定と違うとき（parse の失敗）の GitHubError。ログで原因の項目が分かるよう detail に項目名を入れる
export function contractViolation(error: ParseError): GitHubError {
  const detail = error.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
  return { kind: "upstream", reason: "contract", detail };
}
