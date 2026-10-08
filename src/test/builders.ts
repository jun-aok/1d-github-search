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
