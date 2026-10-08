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
export function SearchForm({ query }: SearchFormProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(query);
  // 下書きを検索条件として解析できるか（空白のみ・256 文字超は不可）。BFF と同じ規則
  const condition = parseSearchCondition({ query: draft, page: 1 });

  return (
    <form className="flex gap-2" role="search">
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
        disabled={!condition.ok}
        className="rounded-md bg-blue-600 text-white px-4 py-2 font-medium disabled:bg-gray-300 disabled:text-gray-500"
      >
        検索
      </button>
    </form>
  );
}
