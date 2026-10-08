# レビュー記録: 4 単位目（詳細ページ）

- 対象: `780c688..0bc8e80`（14 コミット）
- 実装ログ: `docs/impl-log/2026-10-09-0016-repo-detail.md`
- 実装は `general-purpose` に `nextjs-implementer` の定義を読ませて依頼（止められなかった）
- E2E: 166 件すべて Green。lint / typecheck / 単体テスト 308 件 Green

## 1 回目

判定: 要修正（必ず直すは無し）

| # | 区分 | 指摘 | 対応 |
| --- | --- | --- | --- |
| 1 | 直した方がよい | Next.js の `params` が符号化されたまま届き、そのまま `RepoPath` にしているので、`/repos/a%20b/x` などが「問い合わせずに見つからない」にならない（安全性の問題は無い） | 直す。パスの値は 1 回だけ復号してから `RepoPath` にする関数を `lib/model/repoPath.ts` に置く（不正な `%` は `ParseError`）。BFF の `params` が復号済みかを実際に確かめ、符号化されて届く側でだけ使う。design.md 3・4 節に追記 |
| 2 | 直した方がよい | 失敗の結果がキャッシュに残り、もう一度開いたときや再試行の直後に、前回のエラーが現在のものとして出る（薄くならず `aria-busy` も無い） | 直す（案 a）。取り直しの間は前のエラーを `Faded` で包む（検索ページと揃える）。design.md 5 節に追記 |
| 3 | 軽微 | 詳細のアイコンの `loading="lazy"` が design.md 6 節とモックで食い違う。実装はモックに合わせて付けていない | design.md 6 節を「一覧のアイコンだけ」に直す |
| 質問 | — | `page.tsx` を Server Component にして `params` を props で渡す件。design.md 4 節が「ページは Client Component」と読める | 実装のまま。design.md 4 節の文を合わせる |

修正: `0bc8e80..3548d86` の 5 コミット（`general-purpose` に依頼。止められなかった）。`params` はページには符号化されたまま、Route Handler には復号済みで届くことを production ビルドで確かめ、ページ側でだけ `parseEncodedRepoPath` を使う。取り直しの間は前の失敗（エラー・見つからない）を `Faded` で包む。lint / typecheck / 単体テスト 315 件、E2E 166 件 Green。design.md 3・4・5・6 節を更新。「必ず直す」が無かったので再レビューは省略
