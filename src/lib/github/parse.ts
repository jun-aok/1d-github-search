import { z } from "zod";
import { parseRepoDetail, type RepoDetail } from "@/lib/model/repo";
import type { ParseError, Result } from "@/lib/model/result";
import { parseSearchResult, type SearchResult } from "@/lib/model/searchResult";
import { safeParse } from "@/lib/model/zodResult";

// GitHub の応答の変換は 2 段階（docs/design.md 4 節）。
// 1 段目（このファイル）: GitHub の形（stargazers_count など）を確かめ、こちらの項目名に写す。型だけを見る
// 2 段目: モデルの parse 関数に通す。値の規則（0 以上の整数、https など）はモデルのファイルだけが持つ
const summaryShape = z.object({
  id: z.number(),
  full_name: z.string(),
  owner: z.object({ login: z.string(), avatar_url: z.string() }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  html_url: z.string(),
});

type GitHubSummary = z.infer<typeof summaryShape>;

function toSummary(r: GitHubSummary) {
  return {
    id: r.id,
    fullName: r.full_name,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url },
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    url: r.html_url,
  };
}

const searchShape = z
  .object({ total_count: z.number(), items: z.array(summaryShape) })
  .transform((r) => ({ totalCount: r.total_count, items: r.items.map(toSummary) }));

const repoShape = summaryShape
  .extend({
    subscribers_count: z.number(),
    forks_count: z.number(),
    open_issues_count: z.number(),
  })
  .transform((r) => ({
    ...toSummary(r),
    watchers: r.subscribers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
  }));

export function parseGitHubSearch(input: unknown): Result<SearchResult, ParseError> {
  const shaped = safeParse(searchShape, input);
  if (!shaped.ok) return shaped;
  return parseSearchResult(shaped.value);
}

export function parseGitHubRepo(input: unknown): Result<RepoDetail, ParseError> {
  const shaped = safeParse(repoShape, input);
  if (!shaped.ok) return shaped;
  return parseRepoDetail(shaped.value);
}
