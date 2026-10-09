"use client";

import { useId, useState } from "react";
import { parseSearchCondition, type SearchCondition } from "@/lib/model/searchCondition";

export type SearchFormProps = {
  // URL の q（無ければ空文字）。入力欄の下書きはこれに合わせる
  readonly query: string;
  // 読み込み中。検索ボタンを無効にする
  readonly busy: boolean;
  readonly onSearch: (condition: SearchCondition) => void;
};

// 入力欄と検索ボタン（docs/design.md 5 節）。クラス構成は mock/search.html のまま
export function SearchForm({ query, busy, onSearch }: SearchFormProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(query);
  // URL の q が変わったら（ブラウザバック等）下書きを合わせる。
  // effect ではなく描画中に前回の値と比べて直す（React の「props の変化に合わせて
  // state を調整する」書き方）。effect だと 1 回古い値で描画される
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setDraft(query);
  }
  // 下書きを検索条件として解析できるか（空白のみ・256 文字超は不可）。BFF と同じ規則
  const condition = parseSearchCondition({ query: draft, page: 1 });
  const canSearch = condition.ok && !busy;

  return (
    <form
      className="flex gap-2"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        // ボタンが無効でも Enter で送信されうるので、ここでも確かめる（二重の検索を防ぐ）
        if (canSearch) onSearch(condition.value);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        リポジトリ名
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        maxLength={256}
        autoComplete="off"
        placeholder="リポジトリ名を入力してください"
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
      />
      <button
        type="submit"
        disabled={!canSearch}
        className="rounded-md bg-blue-600 text-white px-4 py-2 font-medium disabled:bg-gray-300 disabled:text-gray-500"
      >
        検索
      </button>
    </form>
  );
}
