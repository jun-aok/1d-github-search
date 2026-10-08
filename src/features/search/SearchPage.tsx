"use client";

import { EmptyMessage } from "@/components/EmptyMessage";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ListSkeleton } from "@/components/Skeleton";
import { formatNumber } from "@/lib/format";
import { PER_PAGE } from "@/lib/model/pagination";
import { toSearchParams, type SearchCondition } from "@/lib/model/searchCondition";
import { PaginationNav } from "./PaginationNav";
import { RepoList } from "./RepoList";
import { SearchForm } from "./SearchForm";
import { searchView, type SearchView, type SettledView } from "./searchView";
import { useSearch } from "./useSearch";
import type { SearchUrl } from "./useSearchUrl";

// 検索ページ（docs/design.md 5 節）。URL の検索条件で検索し、画面の状態に応じて 1 つを表示する
export function SearchPage({ url }: { readonly url: SearchUrl }) {
  const { condition } = url;
  const current = condition?.ok === true ? condition.value : null;
  const { response, isFetching, retry, refresh } = useSearch(current);
  const view = searchView({ condition, response, isFetching });
  const busy = view.kind === "loading" || view.kind === "refreshing";
  return (
    <>
      <SearchForm
        query={current?.query ?? ""}
        busy={busy}
        onSearch={(next) => {
          // 同じ条件でも必ず取り直す。URL が同じなら履歴は積まない
          refresh(next);
          if (current === null || !isSameCondition(current, next)) url.navigate(next);
        }}
      />
      <SearchBody view={view} onRetry={retry} />
    </>
  );
}

function isSameCondition(a: SearchCondition, b: SearchCondition): boolean {
  return toSearchParams(a).toString() === toSearchParams(b).toString();
}

function SearchBody({
  view,
  onRetry,
}: {
  readonly view: SearchView;
  readonly onRetry: () => void;
}) {
  switch (view.kind) {
    case "initial":
      return (
        <EmptyMessage
          hint={
            <>
              例: <code className="bg-gray-100 px-1 rounded">react</code>、
              <code className="bg-gray-100 px-1 rounded">next.js</code>
            </>
          }
        >
          キーワードを入力して GitHub のリポジトリを検索します。
        </EmptyMessage>
      );
    case "loading":
      return <ListSkeleton label="検索しています" rows={PER_PAGE} />;
    case "refreshing":
      return <Settled view={view.previous} busy onRetry={onRetry} />;
    default:
      return <Settled view={view} busy={false} onRetry={onRetry} />;
  }
}

// 取得が終わった状態の表示。busy は次の取得を待っている間（前の結果を薄くして残す）
function Settled({
  view,
  busy,
  onRetry,
}: {
  readonly view: SettledView;
  readonly busy: boolean;
  readonly onRetry: () => void;
}) {
  switch (view.kind) {
    case "rateLimited":
    case "failed":
      return <ErrorMessage error={view.error} failedTitle="検索に失敗しました" onRetry={onRetry} />;
    case "empty":
      return (
        <EmptyMessage hint="別のキーワードで試してください。">
          「<span>{view.query}</span>」に一致するリポジトリは見つかりませんでした。
        </EmptyMessage>
      );
    case "outOfRange":
      return (
        <section className="mt-6">
          <p className="text-sm text-gray-600" aria-live="polite">
            {`${formatNumber(view.totalCount)} 件`}
          </p>
          <p className="mt-16 text-center text-gray-500">このページには結果がありません。</p>
          <PaginationNav pagination={view.pagination} onMove={() => undefined} />
        </section>
      );
    case "loaded":
      return (
        <section className="mt-6">
          <p className="text-sm text-gray-600" aria-live="polite">
            {`${formatNumber(view.result.totalCount)} 件中 ${String(view.range.from)}〜${String(view.range.to)} 件を表示`}
          </p>
          <RepoList items={view.result.items} busy={busy} />
          <PaginationNav pagination={view.pagination} onMove={() => undefined} />
        </section>
      );
  }
}
