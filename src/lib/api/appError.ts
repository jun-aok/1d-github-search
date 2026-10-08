import type { GitHubError } from "@/lib/github/githubError";

// BFF 内のあらゆる失敗（docs/design.md 4 節）。respond.ts が網羅的な switch で HTTP 応答に変換する
export type AppError =
  GitHubError | { kind: "bad_request"; detail: string } | { kind: "internal"; detail: string };
