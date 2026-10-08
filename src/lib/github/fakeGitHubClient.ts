import repoReactReact from "@/mocks/fixtures/repo-react-react.json";
import searchFew from "@/mocks/fixtures/search-few.json";
import searchReact from "@/mocks/fixtures/search-react.json";
import type { RepoDetail } from "@/lib/model/repo";
import { fail, ok, type Result } from "@/lib/model/result";
import type { SearchResult } from "@/lib/model/searchResult";
import type { GitHubClient } from "./githubClient";
import { contractViolation, type GitHubError } from "./githubError";
import { parseGitHubRepo, parseGitHubSearch } from "./parse";

const rateLimited: GitHubError = { kind: "rate_limited", retryAfter: 60 };
const outage: GitHubError = {
  kind: "upstream",
  reason: "http",
  detail: "FakeGitHubClient: 障害を再現しています",
};

function fromFixture(input: unknown): Result<SearchResult, GitHubError> {
  const r = parseGitHubSearch(input);
  return r.ok ? r : fail(contractViolation(r.error));
}

// 検索キーワードと owner で応答を切り替える偽物（docs/design.md 4 節）。E2E と Route Handler の単体テストで使う
export function createFakeGitHubClient(): GitHubClient {
  return {
    search(condition) {
      switch (condition.query) {
        case "__empty__":
          return Promise.resolve(ok({ totalCount: 0, items: [] }));
        case "__few__": {
          // GitHub と同じく、範囲外のページは 200・件数あり・items 空
          const r = fromFixture(searchFew);
          return Promise.resolve(
            r.ok && condition.page > 1 ? ok({ totalCount: r.value.totalCount, items: [] }) : r,
          );
        }
        case "__rate_limited__":
          return Promise.resolve(fail(rateLimited));
        case "__error__":
          return Promise.resolve(fail(outage));
        default:
          return Promise.resolve(fromFixture(searchReact));
      }
    },
    getRepo(path) {
      switch (path.owner) {
        case "__not_found__":
          return Promise.resolve(fail({ kind: "not_found" }));
        case "__rate_limited__":
          return Promise.resolve(fail(rateLimited));
        case "__error__":
          return Promise.resolve(fail(outage));
        default: {
          const r = parseGitHubRepo(repoReactReact);
          const result: Result<RepoDetail, GitHubError> = r.ok
            ? r
            : fail(contractViolation(r.error));
          return Promise.resolve(result);
        }
      }
    },
  };
}
