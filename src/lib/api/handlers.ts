import type { NextRequest } from "next/server";
import type { RepoDetail } from "@/lib/model/repo";
import { parseRepoPath } from "@/lib/model/repoPath";
import { fail, type Result } from "@/lib/model/result";
import { searchConditionFromParams } from "@/lib/model/searchCondition";
import type { SearchResult } from "@/lib/model/searchResult";
import type { AppError } from "./appError";
import type { Deps, RouteContext } from "./withErrorHandling";

// 入力を解析して GitHubClient を呼び、Result を返すだけ。
// Response もログも作らない（docs/design.md 8 節）

export async function handleSearch(
  req: NextRequest,
  _ctx: RouteContext,
  { github }: Deps,
): Promise<Result<SearchResult, AppError>> {
  const condition = searchConditionFromParams(req.nextUrl.searchParams);
  if (!condition.ok) {
    const detail = condition.error.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    return fail({ kind: "bad_request", detail });
  }
  return github.search(condition.value);
}

export async function handleRepo(
  _req: NextRequest,
  ctx: RouteContext,
  { github }: Deps,
): Promise<Result<RepoDetail, AppError>> {
  // params は Promise（Next.js 16）
  const path = parseRepoPath(await ctx.params);
  // 存在し得ない名前なので、GitHub に問い合わせず 404 にする
  if (!path.ok) return fail({ kind: "not_found" });
  return github.getRepo(path.value);
}
