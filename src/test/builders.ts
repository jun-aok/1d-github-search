import { createErrorResponse, type ApiError } from "@/lib/model/apiError";
import { parseEnv, type Env } from "@/lib/env";
import { parseRepoPath, type RepoPath } from "@/lib/model/repoPath";
import { parseSearchCondition, type SearchCondition } from "@/lib/model/searchCondition";

// テストの入力もモデルの parse を通して作る（docs/design.md 6 節）。作れなければテストの書き間違いなので例外にする
export function aSearchCondition(query: string, page = 1): SearchCondition {
  const r = parseSearchCondition({ query, page });
  if (!r.ok) throw new Error(`テストの検索条件が不正です: ${JSON.stringify(r.error.issues)}`);
  return r.value;
}

export function aRepoPath(owner: string, repo: string): RepoPath {
  const r = parseRepoPath({ owner, repo });
  if (!r.ok) throw new Error(`テストのリポジトリ指定が不正です: ${JSON.stringify(r.error.issues)}`);
  return r.value;
}

// Env も環境変数の形から parseEnv を通して作る
export function anEnv(vars: {
  NODE_ENV: Env["nodeEnv"];
  GITHUB_CLIENT: Env["githubClient"];
  GITHUB_TOKEN?: string;
}): Env {
  return parseEnv(vars);
}

// BFF のエラー応答の ApiError。モデルの createErrorResponse から作る
export function anApiError(
  code: ApiError["code"],
  requestId = "3f9c2a1e-7b44-4d8e-9a10-5c6e7f8a9b01",
): ApiError {
  return createErrorResponse({ code, message: "test", requestId }).error;
}
