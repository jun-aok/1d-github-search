import { avatarUrl } from "@/lib/format";
import type { RepoDetail } from "@/lib/model/repo";
import { StatCard } from "./StatCard";

// 詳細ページの表示（docs/design.md 5 節）。クラス構成は mock/detail.html のまま
export function RepoDetailView({ repo }: { readonly repo: RepoDetail }) {
  return (
    <section>
      <div className="flex items-center gap-4">
        <img
          src={avatarUrl(repo.owner.avatarUrl, 128)}
          alt={`${repo.owner.login} のアイコン`}
          width={64}
          height={64}
          className="h-16 w-16 rounded-full bg-gray-100"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-all">{repo.fullName}</h1>
          <p className="mt-1 text-gray-600">{repo.language ?? "—"}</p>
        </div>
      </div>
      <p className="mt-4 text-gray-700">{repo.description ?? ""}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Star 数" value={repo.stars} />
        <StatCard label="Watcher 数" value={repo.watchers} />
        <StatCard label="Fork 数" value={repo.forks} />
        <StatCard label="Issue 数" value={repo.openIssues} />
      </dl>

      <p className="mt-6 text-sm">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          GitHub で開く ↗
        </a>
      </p>
    </section>
  );
}
