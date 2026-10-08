import type { RepoDetail } from "@/lib/model/repo";
import type { RepoPath } from "@/lib/model/repoPath";
import type { Result } from "@/lib/model/result";
import type { SearchCondition } from "@/lib/model/searchCondition";
import type { SearchResult } from "@/lib/model/searchResult";
import type { GitHubError } from "./githubError";

// GitHub からの取得の抽象化。Route Handler はこの interface にだけ依存する（docs/design.md 4 節）
export interface GitHubClient {
  search(condition: SearchCondition): Promise<Result<SearchResult, GitHubError>>;
  getRepo(path: RepoPath): Promise<Result<RepoDetail, GitHubError>>;
}
