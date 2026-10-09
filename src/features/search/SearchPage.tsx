"use client";

import { useEffect, useRef } from "react";
import { EmptyMessage } from "@/components/EmptyMessage";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Faded } from "@/components/Faded";
import { ListSkeleton } from "@/components/Skeleton";
import { formatNumber } from "@/lib/format";
import { exceedsMaxResults, MAX_PAGE, MAX_RESULTS, PER_PAGE } from "@/lib/model/pagination";
import {
  parseSearchCondition,
  toSearchParams,
  type SearchCondition,
} from "@/lib/model/searchCondition";
import { PaginationNav } from "./PaginationNav";
import { RepoList } from "./RepoList";
import { SearchForm } from "./SearchForm";
import { searchView, type SearchView, type SettledView } from "./searchView";
import { useSearch } from "./useSearch";
import { useSearchUrl, type SearchUrl } from "./useSearchUrl";

// 検索ページ（docs/design.md 5 節）。URL の検索条件で検索し、画面の状態に応じて 1 つを表示する
export function SearchPage({ url }: { readonly url: SearchUrl }) {
  const { condition } = url;
  const current = condition?.ok === true ? condition.value : null;
  const { response, isFetching, retry, refresh } = useSearch(current);
  const view = searchView({ condition, response, isFetching });
  const busy = view.kind === "loading" || view.kind === "refreshing";

  // ページを移ったら、新しいページの結果が表示されたところでページの先頭へスクロールする
  // （docs/design.md 5 節）
  const scrollOnShow = useRef(false);
  useEffect(() => {
    if (!scrollOnShow.current || isFetching) return;
    scrollOnShow.current = false;
    window.scrollTo(0, 0);
  }, [response, isFetching]);

  // ページネーションは表示中の結果のものなので、移動先も表示中の結果の条件から組み立てる。
  // 別のキーワードを取得中（前の結果を薄く表示中）でも、URL の新しいキーワードと混ぜない
  const move = (page: number) => {
    if (response === undefined) return;
    const next = parseSearchCondition({ query: response.condition.query, page });
    if (!next.ok) return;
    scrollOnShow.current = true;
    url.navigate(next.value);
  };
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
      <SearchBody view={view} onRetry={retry} onMove={move} />
    </>
  );
}

function isSameCondition(a: SearchCondition, b: SearchCondition): boolean {
  return toSearchParams(a).toString() === toSearchParams(b).toString();
}

type BodyProps = {
  readonly onRetry: () => void;
  readonly onMove: (page: number) => void;
};

function SearchBody({ view, ...handlers }: { readonly view: SearchView } & BodyProps) {
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
      return <Settled view={view.previous} busy {...handlers} />;
    // 取得が終わった状態。default にせず種類を書き並べ、
    // 状態を足したときに網羅チェックで気づけるようにする
    case "rateLimited":
    case "failed":
    case "empty":
    case "outOfRange":
    case "loaded":
      return <Settled view={view} busy={false} {...handlers} />;
  }
}

// 取得が終わった状態の表示。busy は次の取得を待っている間（前の結果を薄くして残す）
function Settled({
  view,
  busy,
  onRetry,
  onMove,
}: { readonly view: SettledView; readonly busy: boolean } & BodyProps) {
  switch (view.kind) {
    case "rateLimited":
    case "failed":
      return (
        <Faded busy={busy}>
          <ErrorMessage error={view.error} failedTitle="検索に失敗しました" onRetry={onRetry} />
        </Faded>
      );
    case "empty":
      return (
        <Faded busy={busy}>
          <EmptyMessage hint="別のキーワードで試してください。">
            「<span>{view.query}</span>」に一致するリポジトリは見つかりませんでした。
          </EmptyMessage>
        </Faded>
      );
    case "outOfRange":
      return (
        <Faded busy={busy}>
          <section className="mt-6">
            <p className="text-sm text-gray-600" aria-live="polite">
              {`${formatNumber(view.totalCount)} 件`}
            </p>
            <p className="mt-16 text-center text-gray-500">このページには結果がありません。</p>
            <PaginationNav pagination={view.pagination} onMove={onMove} />
          </section>
        </Faded>
      );
    case "loaded":
      return (
        <section className="mt-6">
          <p className="text-sm text-gray-600" aria-live="polite">
            {`${formatNumber(view.result.totalCount)} 件中 ${String(view.range.from)}〜${String(view.range.to)} 件を表示`}
          </p>
          {exceedsMaxResults(view.result.totalCount) && (
            // 件数は 1,000 件を超えて出るのに 50 ページで止まるので、理由と上限を件数のすぐ下で示す（docs/design.md 5 節）
            <p className="mt-1 text-sm text-red-600">
              {`GitHub の検索 API の制限により、表示できるのは先頭の ${formatNumber(MAX_RESULTS)} 件（${String(MAX_PAGE)} ページ）までです。`}
            </p>
          )}
          <RepoList items={view.result.items} busy={busy} />
          <PaginationNav pagination={view.pagination} onMove={onMove} />
        </section>
      );
  }
}

// 実際の URL と結び付けた検索ページ。app/page.tsx が Suspense の中で使う
export function SearchPageFromUrl() {
  return <SearchPage url={useSearchUrl()} />;
}
