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
  // x-ratelimit-reset までの秒数を求める現在時刻（ミリ秒）。テストで固定する
  nowMs?: () => number;
};

// 待ち時間の手がかりが無いときの retryAfter（秒）。GitHub は「少なくとも 1 分待つ」よう案内している
const DEFAULT_RETRY_AFTER_SECONDS = 60;

function numberHeader(res: Response, name: string): number | null {
  const value = res.headers.get(name);
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// 403 / 429 は、retry-after があるか x-ratelimit-remaining が 0 のときだけレート制限（docs/design.md 4 節）
function rateLimitFrom(res: Response, nowMs: number): GitHubError | null {
  if (res.status !== 403 && res.status !== 429) return null;
  const retryAfter = numberHeader(res, "retry-after");
  const exhausted = res.headers.get("x-ratelimit-remaining") === "0";
  if (retryAfter === null && !exhausted) return null;

  const reset = numberHeader(res, "x-ratelimit-reset");
  const seconds =
    retryAfter ?? (reset === null ? DEFAULT_RETRY_AFTER_SECONDS : reset - nowMs / 1000);
  return { kind: "rate_limited", retryAfter: Math.max(0, Math.ceil(seconds)) };
}

async function errorFromResponse(res: Response, nowMs: number): Promise<GitHubError> {
  const rateLimited = rateLimitFrom(res, nowMs);
  if (rateLimited !== null) return rateLimited;
  if (res.status === 404) return { kind: "not_found" };

  const text = await res.text().catch(() => "");
  const detail = `GitHub が ${String(res.status)} を返しました: ${text.slice(0, 500)}`;
  if (res.status === 422) return { kind: "invalid_request", detail };
  return { kind: "upstream", reason: "http", detail };
}

// fetch で GitHub を呼ぶ本物の実装。ヘッダー・エラー対応・解析はこの実装の仕様（docs/design.md 4 節）
export function createHttpGitHubClient(options: HttpGitHubClientOptions = {}): GitHubClient {
  const { token, timeoutMs = 10_000, nowMs = Date.now } = options;

  async function get(url: URL): Promise<Result<unknown, GitHubError>> {
    const headers: Record<string, string> = {
      "User-Agent": "github-repository-search",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token !== undefined) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return fail(await errorFromResponse(res, nowMs()));
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
