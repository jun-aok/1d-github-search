# 実装ログ: 3 単位目（検索ページ）のレビュー指摘の修正

- 日時: 2026-10-09 00:07
- 依頼: `docs/review-log/2026-10-09-search-page.md` の #1（ページ移動の条件）、#2（フォーカス・再接続で取り直さない）、#4（`getFromBff` の分岐のテスト）、質問 1（初期画面を挟んだらスケルトン）を TDD で直す
- 結果: 4 件とも直した（4 コミット）。lint / typecheck / 単体テスト 295 件と、検索ページ関連の E2E 77 件が Green

## 迷った点と判断

### 1. #4 のテストは実装済みの分岐に対するもので、Red にならない

- 状況: `getFromBff` の「エラー応答の形が想定と違う」分岐はすでに実装されている。テストを足しても最初から通る
- 選択肢: (a) テストを足すだけ (b) 一時的に実装を壊して、テストがその分岐を見分けられることを確かめてから戻す
- 判断: (b)。分岐を消して成功応答の解析に流れるよう書き換えると、`detail` に HTTP ステータス（`500`）が入らず失敗することを確かめ、実装は元に戻した。`detail` に `500` が入ることまで見ているのは、この分岐と「成功応答の形が違う」分岐を区別するため
- 実装: `src/lib/api/client.test.ts` にテスト 1 件
- 確度: 確定

### 2. #1 の移動先のキーワードをどこから取るか

- 状況: 取得中は前の結果のページネーションが出ているが、`move` は URL の条件（取得中の新しいキーワード）を使っていた
- 選択肢: (a) `SettledView` の `loaded` / `outOfRange` に条件を持たせる (b) `SearchPage` で `useSearch` の `response.condition`（表示中の結果を問い合わせた条件）を使う
- 判断: (b)。表示中のビューは `response` から作られるので、`response.condition` が表示中の条件そのもの。ビューの型を広げずに済む
- 実装: `src/features/search/SearchPage.tsx` の `move`
- 確度: 確定

### 3. 質問 1: 初期画面を挟んだ次の検索で前の結果が出る原因と直し方

- 状況: `keepPreviousData` は、`node_modules/@tanstack/query-core/src/queryObserver.ts`（5.104.1）を読むと、直前に表示したデータではなく「最後にデータを持っていた問い合わせ」（`#lastQueryWithDefinedData`）のデータを受け取る。条件なしの問い合わせ（`skipToken`）はデータを持たないので、初期画面を挟んでも 1 つ前の結果が渡ってくる
- 選択肢:
  - (a) 直前に表示した結果を `useRef` で持ち、`useEffect` で更新して `placeholderData` に渡す。描画とエフェクトの順に依存し、読みにくい
  - (b) 初期画面から来たかを state で持ち、`placeholderData` を付け外しする。付け直した瞬間に前の結果が再計算されて出てしまう
  - (c) 条件なしの問い合わせに `initialData: null`（「結果なし」）を持たせ、`placeholderData` は前が `null` なら何も残さない関数にする
- 判断: (c)。TanStack Query の仕組みの中で閉じ、初期画面も「最後にデータを持っていた問い合わせ」になるので、次の検索には `null` が渡りスケルトンになる。`placeholderData` の関数は、同じ関数なら前回の値を使い回す（同ファイルのメモ化の条件）ので、モジュールに置いた
- 実装: `src/features/search/useSearch.ts`（`NO_CONDITION_KEY`、`keepPreviousResult`、`useQuery<SearchResponse | null>`、返す `response` は `null` を `undefined` に直す）
- 確度: 確定（ただし design.md 5 節の「`placeholderData: keepPreviousData`」の記述とは書き方が変わる。下記）

### 4. #2 の振る舞いをどう確かめるか

- 状況: `refetchOnWindowFocus` / `refetchOnReconnect` を `Providers` の `QueryClient` の既定に置く。設定値を読むテストは振る舞いを見ていない
- 判断: `Providers` の中で `staleTime: 0` の問い合わせを描画し、`focusManager` / `onlineManager` でフォーカスの復帰・再接続を起こしても取得回数が 1 のままであることを確かめる。既定のままでは 2 回になる（Red で確認）。設定 1 か所の変更なので、2 件のテストを 1 サイクルで書いた
- 実装: `src/app/providers.tsx`（`createQueryClient`）、`src/app/providers.test.tsx`
- 確度: 確定

## 人間に確認してほしいこと

- design.md 5 節の「取得中は `placeholderData: keepPreviousData` で前の結果を保持」は、実装では `keepPreviousResult`（前が初期画面なら残さない）に変わった。初期画面を挟んだらスケルトン、という規則と合わせて文書の更新が要る（#3 と同じく文書側で）
- design.md 5 節「状態の決め方」の「取得中で、前の結果が無い（最初の検索、直接アクセス）」に「初期画面を挟んだあと」を足すかどうか

## サイクルの記録

| # | テスト | Red の失敗 | Green の要点 |
| --- | --- | --- | --- |
| 1 | `client.test.ts`: 500 で JSON だが ErrorResponse の形でない → UPSTREAM_ERROR、requestId なし、detail に 500 | 実装済みのため最初から通る。分岐を壊すと `detail` が `undefined` で失敗することを確認して戻した | 実装の変更なし |
| 2 | `SearchPage.test.tsx`: 別のキーワードを取得中に「次へ」→ 表示中のキーワードの次のページ | `navigations` の 2 件目が `{ query: "vue", page: 2 }`（期待は `react`） | `move` を `response.condition.query` から組み立てる |
| 3 | `SearchPage.test.tsx`: 結果 → 初期画面 → 別のキーワードでスケルトン | 「検索しています」が見つからない（前の結果が薄く出ていた） | 条件なしの問い合わせに `initialData: null`、`placeholderData` は `null` なら残さない |
| 4 | `providers.test.tsx`: フォーカスの復帰・再接続で取り直さない（2 件） | 取得回数が `2`（期待は `1`） | `QueryClient` の `defaultOptions.queries` で両方 `false` |
