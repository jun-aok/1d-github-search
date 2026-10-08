"use client";

import { EmptyMessage } from "@/components/EmptyMessage";
import { SearchForm } from "./SearchForm";
import { searchView, type SearchView } from "./searchView";
import type { SearchUrl } from "./useSearchUrl";

// 検索ページ（docs/design.md 5 節）。URL の検索条件で検索し、画面の状態に応じて 1 つを表示する
export function SearchPage({ url }: { readonly url: SearchUrl }) {
  const { condition } = url;
  const view = searchView({ condition, response: undefined, isFetching: false });
  return (
    <>
      <SearchForm
        query={condition?.ok === true ? condition.value.query : ""}
        busy={false}
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
    default:
      return null;
  }
}
