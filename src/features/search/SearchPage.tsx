"use client";

import { EmptyMessage } from "@/components/EmptyMessage";
import { ListSkeleton } from "@/components/Skeleton";
import { formatNumber } from "@/lib/format";
import { PER_PAGE } from "@/lib/model/pagination";
import { PaginationNav } from "./PaginationNav";
import { RepoList } from "./RepoList";
import { SearchForm } from "./SearchForm";
import { searchView, type SearchView } from "./searchView";
import { useSearch } from "./useSearch";
import type { SearchUrl } from "./useSearchUrl";

// 検索ページ（docs/design.md 5 節）。URL の検索条件で検索し、画面の状態に応じて 1 つを表示する
export function SearchPage({ url }: { readonly url: SearchUrl }) {
  const { condition } = url;
  const { response, isFetching } = useSearch(condition?.ok === true ? condition.value : null);
  const view = searchView({ condition, response, isFetching });
  const busy = view.kind === "loading" || view.kind === "refreshing";
  return (
    <>
      <SearchForm
        query={condition?.ok === true ? condition.value.query : ""}
        busy={busy}
        onSearch={url.navigate}
      />
      <SearchBody view={view} />
    </>
  );
}

function SearchBody({ view }: { readonly view: SearchView }) {
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
    case "loaded":
      return (
        <section className="mt-6">
          <p className="text-sm text-gray-600" aria-live="polite">
            {`${formatNumber(view.result.totalCount)} 件中 ${String(view.range.from)}〜${String(view.range.to)} 件を表示`}
          </p>
          <RepoList items={view.result.items} busy={false} />
          <PaginationNav pagination={view.pagination} onMove={() => undefined} />
        </section>
      );
    default:
      return null;
  }
}
