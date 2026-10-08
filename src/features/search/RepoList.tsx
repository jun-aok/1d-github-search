import type { RepoSummary } from "@/lib/model/repo";
import { RepoListItem } from "./RepoListItem";

// 検索結果の一覧。取得中（前の結果を残している間）は薄くする。クラス構成は mock/search.html のまま
export function RepoList({
  items,
  busy,
}: {
  readonly items: readonly RepoSummary[];
  readonly busy: boolean;
}) {
  return (
    <ul className={busy ? "mt-3 space-y-3 opacity-50" : "mt-3 space-y-3"} aria-busy={busy}>
      {items.map((repo) => (
        <RepoListItem key={repo.id} repo={repo} />
      ))}
    </ul>
  );
}
