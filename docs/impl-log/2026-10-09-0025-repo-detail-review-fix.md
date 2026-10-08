# 実装ログ: 4 単位目（詳細ページ）のレビュー指摘の修正（パスの値の復号、取り直しの間の表示）

- 日時: 2026-10-09 00:25
- 依頼: `docs/review-log/2026-10-09-repo-detail.md` の #1（パスの値を 1 回だけ復号してから `RepoPath` にする。ページと BFF の `params` の届き方を実際に確かめ、符号化されて届く側だけで使う）と #2（取り直しの間は前の失敗の表示を `Faded` で包む。`useRepo` が `isFetching` も返す）を TDD で直す
- 結果: 両方とも修正。4 コミット。lint / typecheck / 単体テスト 315 件 / E2E 166 件すべて Green

## params の届き方（確かめた結果）

production イメージ（`docker compose --profile e2e up -d --build app-e2e`、`GITHUB_CLIENT=fake`、Next.js 16.4）に、コンテナ内から `fetch` で要求して確かめた。

| 要求 | 届いた値 | 判断の根拠 |
| --- | --- | --- |
| ページ `/repos/a%20b/x` | `owner: "a%20b"`（符号化されたまま） | RSC ペイロードの props が `{"owner":"a%20b","repo":"x"}`。SSR の HTML はスケルトン（= `parseRepoPath` を通っていた） |
| ページ `/repos/a%2Fb/x` | `owner: "a%2Fb"`（符号化されたまま） | 同上 |
| ページ `/repos/%5F%5Fnot_found%5F%5F/x` | `owner: "__not_found__"` | 非予約文字（`_` など）の符号化は URL の正規化で先に戻される。復号しても値は変わらないので影響なし |
| ページ `/repos/%2E%2E/x` | （ページに届かない） | Next.js が 404 の HTML を返す |
| BFF `/api/repos/a%20b/x` | 復号済み（`"a b"`） | 404 `NOT_FOUND`。符号化されたままなら `parseRepoPath` を通り、fake の fixture が 200 で返るはず |
| BFF `/api/repos/%5F%5Fnot_found%5F%5F/x` | 復号済み | 404（fake の `__not_found__` の分岐） |
| BFF `/api/repos/a%2Fb/x` | 復号済み（`"a/b"`） | 404 `NOT_FOUND`（JSON） |

→ ページ（Server Component の `page.tsx` が受ける `params`）は符号化されたまま、BFF（Route Handler の `params`）は復号済み。新しい関数はページ側（`RepoDetailPage`）でだけ使い、`handleRepo` は変えていない。修正後に同じ方法で、ページの `/repos/a%20b/x` と `/repos/a%2Fb/x` の SSR が「リポジトリが見つかりません」になることも確かめた。

## 迷った点と判断

### 1. 復号を zod のスキーマの中で行うか、関数の中で行うか

- 状況: `decodeURIComponent` は不正な `%` で `URIError` を投げる。それを `ParseError` にして、復号後の値に `parseRepoPath` と同じ規則を掛けたい
- 選択肢: (a) `parseEncodedRepoPath` の中で `typeof` で文字列か確かめ、`try` で復号し、`parseRepoPath` に渡す。(b) zod の `transform` で各値を復号し（失敗は `ctx.addIssue` + `z.NEVER`）、`.pipe(schema)` で既存のスキーマにつなぐ
- 判断: (b)。入力が `unknown` のまま 1 回の `safeParse` で済み、失敗の `path`（`owner` / `repo`）も zod が付ける。文字列かどうかの確かめを手書きしない（design.md 3 節の zod を使う理由と同じ）
- 実装: `src/lib/model/repoPath.ts` の `encodedSegment`、`encodedSchema`、`parseEncodedRepoPath`
- 確度: 確定

### 2. 復号をどこで呼ぶか（`page.tsx` か `RepoDetailPage` か）

- 状況: 符号化されて届くのはページの `params`。`page.tsx` で復号して渡すか、`RepoDetailPage` が符号化されたままの値を受けて解析するか
- 判断: `RepoDetailPage`。依頼のテスト（`{ owner: "a%20b", repo: "x" }` で NotFound、要求 0 件）がコンポーネントテストで書け、`page.tsx` はこれまでどおり値を取り出して渡すだけで済む。`RepoParams` のコメントに「符号化されたまま届く」と書いた
- 実装: `src/features/repo/RepoDetailPage.tsx`
- 確度: 確定

### 3. 取り直しの間に薄くする対象に、BFF が返した NOT_FOUND の「見つからない」表示を含めるか

- 状況: レビューの指摘は「前回のエラー」。`NOT_FOUND` も `ok: false` なので覚えず、もう一度開くと取り直す。その間は前の「見つからない」が現在のものとして出る
- 選択肢: (a) `ErrorMessage` だけ包む。(b) `NotFound`（BFF の NOT_FOUND）も包む
- 判断: (b)。取り直しの間に前の結果が現在のものに見えるという問題は同じで、検索ページも「エラー・0 件・範囲外」と、成功以外の前の結果をすべて薄くしている。パスが不正なときの `NotFound` は取得しない（`isFetching` が常に false）ので包まれない
- 実装: `src/features/repo/RepoDetailPage.tsx`（`ok: false` の分岐全体を `Faded` で包む）
- 確度: 仮（NOT_FOUND も薄くすることを design.md 5 節に追記するかの判断が要る）

### 4. `Faded` の置き場所

- 状況: `Faded` は `SearchPage.tsx` の中のローカル関数だった
- 判断: `src/components/Faded.tsx` に移して両ページから使う。design.md 2 節は画面共通の部品を `components/` に置くとしている
- 実装: `src/components/Faded.tsx`、`src/features/search/SearchPage.tsx`（ローカル定義を削除して import）
- 確度: 確定

### 5. 「もう一度開いた直後」のテストが、実装前から Red になるか

- 状況: 取り直しの間の表示のテストは「再試行の直後」「失敗をもう一度開いた直後」「見つからなかったものをもう一度開いた直後」の 3 件。1 つの実装（`isFetching` で `Faded`）で全部が Green になる
- 判断: 1 サイクルで 3 件を書き、3 件とも Red（`aria-busy` / `opacity-50` が無い）を確かめてから実装した。1 件ずつ分けても、2 件目以降は書いた時点で Green になり Red を確かめられないため
- 確度: 確定

## 人間に確認してほしいこと

- 迷った点 3: BFF が NOT_FOUND を返したときの「見つからない」表示も、取り直しの間は薄くしている。design.md 5 節に追記する場合は「前の失敗（エラー・見つからない）」とする案
- サイクル 2 で、復号した結果に既存の規則が掛かること（`%20` → 空白、`%2F` → `/`、`%2E%2E` → `..` を断る）のテストを一緒に足した。サイクル 1 の `.pipe(schema)` で既に満たしており、単独では Red にならない確認のテスト

## サイクルの記録

| # | テスト | Red の失敗 | Green の要点 |
| --- | --- | --- | --- |
| 1 | `parseEncodedRepoPath`: 1 回だけ復号してから `RepoPath` にする（`my%2Dorg` → `my-org`、`%2525` → `%25`） | 空実装の `not implemented` | `z.string().transform(decodeURIComponent)` を `owner` / `repo` に掛け、`.pipe(schema)` |
| 2 | `parseEncodedRepoPath`: 不正な `%` の並びは例外を投げず `ParseError`（`path` は `owner`）。あわせて復号後の値に規則が掛かることの確認 | `URIError: URI malformed` が投げられる | `transform` の中で `try` / `catch` し、`ctx.addIssue` と `z.NEVER` |
| 3 | `RepoDetailPage`: `{ owner: "a%20b", repo: "x" }` なら見つからない案内を出し、BFF への要求は 0 件 | 見出し「リポジトリが見つかりません」が見つからない | `parseRepoPath` を `parseEncodedRepoPath` に替える |
| 4 | `RepoDetailPage`: 取り直しの間（再試行の直後、失敗をもう一度開いた直後、見つからなかったものをもう一度開いた直後）は前の表示を `opacity-50` + `aria-busy="true"` で包み、取り終えたら外す | 3 件とも `aria-busy` / `opacity-50` が無い | `useRepo` が `isFetching` を返す。`Faded` を `src/components/` に移し、`ok: false` の表示を包む |
