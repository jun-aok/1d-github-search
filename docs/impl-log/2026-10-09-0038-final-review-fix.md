# 実装ログ: 全体レビューの指摘の修正

- 日時: 2026-10-09 00:38
- 依頼: `docs/review-log/2026-10-09-final.md` の 7 項目（必ず直す 2、直した方がよい 1、軽微 2、質問 2）を TDD で直す。`parseEnv` は `Result` を返し、最上位の `env` だけが例外を投げる。ESLint の `considerDefaultExhaustiveForUnions` を外す
- 結果: 7 項目すべて対応し、8 コミット。lint / typecheck / 単体テスト 327 件 / E2E 166 件がすべて通った

## 迷った点と判断

### 1. 最上位の `env` で投げる例外のメッセージの組み立て方

- 状況: これまでは `parseEnv` の中で `z.prettifyError` を使って例外のメッセージを作っていた。`Result` を返す形にすると、失敗は `ParseError`（zod の型を含まない）になる
- 選択肢: (a) `parseEnv` が `ZodError` 由来の整形済み文字列を `ParseError` とは別に返す (b) `ParseError.issues` を `- パス: メッセージ` の行に並べる
- 判断: (b)。他のモデルと同じく `lib/model/zodResult.ts` の `safeParse` で `ParseError` にそろえ、整形は `env.ts` 内の `envOrThrow` で行う。対処法の文は refine のメッセージに入っているので、行に並べるだけで足りる。`next.config.ts` を jiti で読み、`NODE_ENV=production GITHUB_CLIENT=http GITHUB_TOKEN=` で `環境変数が不正です:\n- GITHUB_TOKEN: GITHUB_TOKEN が未設定です。…` の例外になること、`GITHUB_CLIENT=fake` では通ることを確かめた
- 実装: `src/lib/env.ts`（`parseEnv` → `Result<Env, ParseError>`、`envOrThrow` を非公開で追加）、`src/test/builders.ts`（`anEnv` は失敗なら例外）。`env.ts` から `./model/result` と `./model/zodResult` は相対パスで import する（`next.config.ts` から読まれるため `@/` を避けた）
- 確度: 確定

### 2. 環境変数の「通る」ケースのテストが最初から通る

- 状況: 実装は既にあり、テストだけが無かった。失敗側は `Result` へのシグネチャ変更（失敗時は空の `issues` を返す仮の実装）で Red にできたが、通る側（production + fake、development・test、トークンあり、既定値）は書いた時点で通る
- 選択肢: (a) 通るテストとしてそのまま追加 (b) 実装を一時的に壊して、テストが検出できることを確かめてから追加
- 判断: (b)。refine の条件を一時的に `NODE_ENV !== "development" && トークン無し` に変え、production + fake と test の 2 件が落ちることを確かめてから戻した（戻した後は 9 件 Green）
- 実装: `src/lib/env.test.ts`
- 確度: 確定

### 3. `aSearchCondition` に直す範囲

- 状況: 指摘は `pagination.test.ts` だが、`searchCondition.test.ts` の `toSearchParams` の 3 件も `{ query, page }` を手で書いていた
- 選択肢: (a) 指摘の 1 ファイルだけ (b) 同じ規約違反なので両方
- 判断: (b)。design.md 6 節「fixture も `parse` を通して作る」の同じ違反。`parseSearchCondition` 自体のテストの入力（`{ query: "  react ", page: 2 }` など）は解析される側の生の値なので、そのまま残した
- 実装: `src/lib/model/pagination.test.ts`、`src/lib/model/searchCondition.test.ts`
- 確度: 確定

### 4. 詳細ページの「古くなった成功を開き直した直後」をテストでどう作るか

- 状況: 成功は 60 秒覚えるので、開き直しても取り直さない。取り直しを起こすには結果を古くする必要がある
- 選択肢: (a) `queryClient.invalidateQueries` で古い扱いにする (b) 時計を 61 秒進める
- 判断: (b)。テスト名どおりの状況（60 秒過ぎてから開き直す）を作れる。`vi.useFakeTimers({ toFake: ["Date"] })` で `Date` だけを偽物にし、MSW の待ちや `waitFor` は本物のタイマーのまま動かす。TanStack Query の古さの判定は `Date.now()` を使うので、これで取り直しが起きる
- 実装: `src/features/repo/RepoDetailPage.test.tsx`。本体は `RepoDetailPage.tsx` で成功の表示も `Faded busy={isFetching}` で包み、失敗との分岐を 1 つの `Faded` の中にまとめた。`Faded` は取得中でなければ子をそのまま返すので、モックとの DOM 比較は変わらない（E2E 166 件 Green）
- 確度: 確定

### 5. 一覧の行のリンク先の各部をどう取り出すか

- 状況: `RepoSummary` には `name` が無く、`fullName`（`owner/name`）と `owner.login` しかない
- 選択肢: (a) `owner.login` と、`fullName` から owner を除いた残り (b) `fullName` を `/` で区切って各部を `encodeURIComponent` し、`/` でつなぎ直す
- 判断: (b)。GitHub の owner・name は `/` を含まないので、区切りは常に 2 つ。(a) は `owner.login` と `fullName` の先頭の一致を前提にするぶん脆い
- 実装: `src/features/search/RepoListItem.tsx`
- 確度: 確定

### 6. 想定外の例外の記録の項目をそろえる方法

- 状況: `ErrorReporter.report` の `context` は `{ requestId: string; route?: string } & LogFields` 型で、これまでの `requestFields` は `LogFields` を返していたため、そのまま渡すと `requestId` の型が足りない
- 判断: `requestFields` の戻り値を `{ requestId: string; route: string } & LogFields` にし、`durationMs` の計算も中に入れて、失敗の記録と想定外の例外の記録の両方で同じ関数を使う
- 実装: `src/lib/api/withErrorHandling.ts`
- 確度: 確定

### 7. `considerDefaultExhaustiveForUnions` を外した後の `src/mocks/bffHandlers.ts`

- 状況: 外すと、`SearchPage.tsx` の `SearchBody` のほか、MSW のハンドラの `switch (params.get("q"))`（`string | null`）と `switch (params.owner)`（`string | readonly string[] | undefined`）も、`null` / `undefined` の case が無いと指摘された
- 選択肢: (a) `case null:` を default の直前に足す (b) `?? ""` で文字列にそろえてから switch する
- 判断: (b)。切り替えのキーワードは文字列で、`null` / `undefined` を特別に扱う意味は無い（既定の結果を返すだけ）。振る舞いは変わらない。`SearchPage.tsx` は design.md 3 節の原則どおり、取得が終わった 5 種を case で書き並べた
- 実装: `eslint.config.mjs`、`src/features/search/SearchPage.tsx`、`src/mocks/bffHandlers.ts`（`mock/` ではなく単体テスト用の MSW ハンドラ）
- 確度: 確定

## 人間に確認してほしいこと

- design.md 7 節の `env.ts` の行は「production + http でトークン無しは失敗、production + fake は通る、development では通る」。今回は空文字・test・トークンあり・既定値・不正な値も足した。文書に足すかどうかは判断に任せる
- design.md 5 節「詳細ページも同じ扱いにする。前の失敗（エラー・見つからない）を表示したまま取り直す間…」は、今回の修正で成功の取り直し（60 秒過ぎてから開き直した直後）も含むようになった。文書の更新が要る

## サイクルの記録

| # | テスト | Red の失敗 | Green の要点 |
| --- | --- | --- | --- |
| 1 | `env.test.ts`: production + http でトークンが未設定・空文字なら失敗し、`GITHUB_TOKEN` の項目に対処法が入る | シグネチャを `Result` にして失敗時に空の `issues` を返す仮の実装で `expected [] to have a length of 1 but got +0` | `safeParse` で `ParseError` にそろえる。最上位は `envOrThrow`、`anEnv` も失敗なら例外 |
| 2 | `env.test.ts`: production + fake・トークンあり・development・test・既定値は通る、不正な値は失敗 | 書いた時点で通る。refine を一時的に壊して 2 件落ちることを確認 | 実装の変更なし |
| 3 | `pagination.test.ts`・`searchCondition.test.ts` の検索条件を `aSearchCondition` で作る | テストのみの整理（Red なし） | — |
| 4 | `RepoDetailPage.test.tsx`: 成功が古くなってから開き直した直後は詳細を薄くして残す | `expect(element).toHaveClass("opacity-50")` で失敗（包まれていない） | 成功の表示も `Faded busy={isFetching}` で包む |
| 5 | 50 と 20 を `MAX_PAGE` / `PER_PAGE` に（`searchCondition.ts`、`searchResult.ts`、`httpGitHubClient.ts`） | リファクタリング。既存の境界値テスト（51 ページ、21 件、`per_page=20`）で確認 | — |
| 6 | `RepoListItem.test.tsx`: リンク先は各部を符号化する | `href="/repos/a b/c#d?e"` を受け取り失敗 | `fullName` を `/` で区切って各部を `encodeURIComponent` |
| 7 | `withErrorHandling.test.ts`: reporter にも `q`・`page`・`durationMs` を渡す | `toMatchObject({ q: "react", page: "2" })` で失敗 | `requestFields` に `durationMs` を入れ、reporter にも渡す |
| 8 | ESLint の `considerDefaultExhaustiveForUnions` を外す（設定ファイル。TDD の対象外） | lint が 3 件のエラー | `SearchBody` は case を書き並べ、MSW のハンドラは `?? ""` で文字列にそろえる |
