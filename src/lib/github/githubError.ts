// GitHub 呼び出しの失敗（docs/design.md 4 節）。判別共用体で、種類を足すと対応漏れがコンパイルエラーになる
export type GitHubError =
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "not_found" }
  | { kind: "invalid_request"; detail: string }
  | { kind: "upstream"; reason: "http" | "network" | "timeout" | "contract"; detail: string };
