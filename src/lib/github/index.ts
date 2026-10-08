import type { Env } from "@/lib/env";
import type { Logger } from "@/lib/observability/logger";
import { createFakeGitHubClient } from "./fakeGitHubClient";
import type { GitHubClient } from "./githubClient";
import { createHttpGitHubClient } from "./httpGitHubClient";

// 環境変数 GITHUB_CLIENT で実装を選ぶ（docs/design.md 4 節）。本物の実装にテスト用の分岐は入れない
export function createGitHubClient(env: Env, logger: Logger): GitHubClient {
  switch (env.githubClient) {
    case "fake":
      logger.log(
        "warn",
        "GITHUB_CLIENT=fake: 偽の GitHub を使っています。本物の GitHub は呼びません",
      );
      return createFakeGitHubClient();
    case "http":
      return createHttpGitHubClient({ token: env.githubToken });
  }
}
