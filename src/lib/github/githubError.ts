import type { ParseError } from "@/lib/model/result";
// GitHub 呼び出しの失敗（docs/design.md 4 節）。判別共用体で、種類を足すと対応漏れがコンパイルエラーになる
export type GitHubError =
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "not_found" }
  | { kind: "invalid_request"; detail: string }
  | { kind: "upstream"; reason: "http" | "network" | "timeout" | "contract"; detail: string };

// 応答の形が想定と違うとき（parse の失敗）の GitHubError。ログで原因の項目が分かるよう detail に項目名を入れる
export function contractViolation(error: ParseError): GitHubError {
  const detail = error.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
  return { kind: "upstream", reason: "contract", detail };
}
