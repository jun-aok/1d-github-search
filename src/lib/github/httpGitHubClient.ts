import { readJson } from "@/lib/http/readJson";
import { fail, ok, type ParseError, type Result } from "@/lib/model/result";
import type { GitHubClient } from "./githubClient";
import { contractViolation, type GitHubError } from "./githubError";
import { parseGitHubRepo, parseGitHubSearch } from "./parse";

const API_ORIGIN = "https://api.github.com";
const PER_PAGE = 20;

export type HttpGitHubClientOptions = {
  token?: string | undefined;
  // GitHub を待つ上限。通常の応答は 1 秒未満なので、利用者が待てる上限として 10 秒（docs/design.md 4 節）
  timeoutMs?: number;
};

// fetch で GitHub を呼ぶ本物の実装。ヘッダー・エラー対応・解析はこの実装の仕様（docs/design.md 4 節）
export function createHttpGitHubClient(options: HttpGitHubClientOptions = {}): GitHubClient {
  const { token, timeoutMs = 10_000 } = options;

  async function get(url: URL): Promise<Result<unknown, GitHubError>> {
    const headers: Record<string, string> = {
      "User-Agent": "github-repository-search",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token !== undefined) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const body = await readJson(res);
    if (!body.ok)
      return fail(contractViolation({ issues: [{ path: "", message: body.error.message }] }));
    return ok(body.value);
  }

  async function getAndParse<T>(
    url: URL,
    parse: (input: unknown) => Result<T, ParseError>,
  ): Promise<Result<T, GitHubError>> {
    const body = await get(url);
    if (!body.ok) return body;
    const parsed = parse(body.value);
    return parsed.ok ? parsed : fail(contractViolation(parsed.error));
  }

  return {
    search(condition) {
      const url = new URL("/search/repositories", API_ORIGIN);
      url.searchParams.set("q", condition.query);
      url.searchParams.set("per_page", String(PER_PAGE));
      url.searchParams.set("page", String(condition.page));
      return getAndParse(url, parseGitHubSearch);
    },
    getRepo(path) {
      const owner = encodeURIComponent(path.owner);
      const name = encodeURIComponent(path.name);
      return getAndParse(new URL(`/repos/${owner}/${name}`, API_ORIGIN), parseGitHubRepo);
    },
  };
}
