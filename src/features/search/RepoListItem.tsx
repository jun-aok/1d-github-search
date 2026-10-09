import Link from "next/link";
import { avatarUrl, formatNumber } from "@/lib/format";
import type { RepoSummary } from "@/lib/model/repo";

// 一覧の 1 行。行全体を詳細ページへのリンクにする。クラス構成は mock/search.html のまま
// prefetch={false}: 画面に入った 20 行分の遷移先を先読みしない（docs/design.md 5 節）
export function RepoListItem({ repo }: { readonly repo: RepoSummary }) {
  // fullName は "owner/name"。各部を URL の 1 区切りとして符号化する
  // （lib/api/client.ts の fetchRepo と同じ）
  const href = `/repos/${repo.fullName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <img
          src={avatarUrl(repo.owner.avatarUrl, 80)}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-full bg-gray-100"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{repo.fullName}</p>
          <p className="truncate text-sm text-gray-600">{repo.description ?? ""}</p>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-gray-500 sm:block">
          <p>{repo.language ?? "—"}</p>
          <p>{`★ ${formatNumber(repo.stars)}`}</p>
        </div>
      </Link>
    </li>
  );
}
