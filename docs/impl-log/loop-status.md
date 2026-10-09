# ループの状態（再開用）

新しいセッションで続きを始めるときは、`CLAUDE.md` → このファイル → `docs/workflow.md` の順に読む。

## 終わっている単位

| 順 | 単位 | 状態 | 記録 |
| --- | --- | --- | --- |
| 0 | 仕様策定、初期セットアップ、E2E（166 件）、スパイク | 完了。push 済み | `2026-10-08-setup.md`、`docs/test-cases-e2e.md` |
| 1 | モデルの型と解析（`src/lib/model/`、`src/lib/format.ts`） | 完了。159 テスト、23 コミット（未 push） | `2026-10-08-2219-model.md` |
| 2 | ログの抽象化、GitHubClient、BFF、Route Handler 2 つ | 完了。251 テスト、`bff-errors` 8 件 Green、21 コミット（未 push）。レビュー承認 | `2026-10-08-2316-bff.md`、`docs/review-log/2026-10-08-bff.md` |
| 3 | 検索ページ | 完了。295 テスト、検索ページ関連の E2E Green、46 コミット（未 push）。レビュー承認 | `2026-10-08-2355-search-page.md`、`2026-10-09-0007-search-page-review-fix.md`、`docs/review-log/2026-10-09-search-page.md` |
| 4 | 詳細ページ | 完了。315 テスト、E2E 166 件すべて Green、19 コミット（未 push）。レビュー済み（必ず直すは無し） | `2026-10-09-0016-repo-detail.md`、`2026-10-09-0025-repo-detail-review-fix.md`、`docs/review-log/2026-10-09-repo-detail.md` |
| 5a | 全体レビュー | 完了。327 テスト、E2E 166 件すべて Green。指摘の修正 10 コミット（未 push）。再レビューで承認 | `2026-10-09-0038-final-review-fix.md`、`docs/review-log/2026-10-09-final.md` |

## 次にやること（`docs/design.md` の順）

| 順 | 単位 | 通るはずの E2E |
| --- | --- | --- |
| 5b | README（工夫した点、選択理由、スコープ外、AI 利用レポート = `docs/ai-usage.md` から） | — |

各単位の終わり（E2E 1 グループ Green）に `code-reviewer` を挟む（`docs/workflow.md` の「レビュー」）。記録は `docs/review-log/`。

## 1 単位目で決めたこと（impl-log の「迷った点」への回答）

- fixture（GitHub の生 JSON）の parse テストは `lib/github/parse.ts` の単位で書く
- `lib/model/zodResult.ts`（`ZodError` → `ParseError` の詰め替えを 1 か所に）は `lib/model/` 内に閉じているので可
- `SearchResult` の型が `z.infer` でなく手書きの `DeepReadonly<…>` になっているのは可
- `Pagination` は `{ page, totalPages, prevPage: number | null, nextPage: number | null }`（`null` = 移れない。範囲外の「前へ」は最終ページ）で可
- `resultRange(condition, itemCount): { from, to }` は範囲外で `from > to` を返す。表示側（範囲外は「N 件」のみ）で扱う
- `retryAfter` は整数秒。BFF 側で切り上げる
- `parseRepoPath` の入力は `{ owner, repo }`（Next.js の `params` のキー）、出力は `{ owner, name }`

## 運用上の注意

- **Stop フック**（`.claude/hooks/test.sh`）: lint → typecheck → 単体テスト → E2E（`.claude/loop-active` があるとき）。E2E の結果はソースのハッシュで覚え、変更が無ければ再実行しない。失敗が 15 回連続で警告して通す
- **E2E の所要時間**: ほぼ Green なら約 2 分、全件 Red だと長い（待ち時間を短くする前は 11 分）。`playwright.config.ts` の待ち時間（テスト 15 秒、確認 2 秒、操作 5 秒、遷移 10 秒）を短くしたので、全件 Red でも 3〜4 分の見込み（未計測）
- **`.claude/loop-active`**: ユーザーだけが作る・消す。ユーザーがループを一時停止するときはこのファイルを外す（E2E が判定から外れる）
- **`nextjs-implementer` の誤検知**: API のセーフガード（`[reasoning_extraction]`）が、サブエージェントの**最初の応答**を止め、何もせず終わることがある。`nextjs-implementer` を subagent_type に指定した本番の依頼で、Sonnet・Opus とも 8 回中 6 回起きた（1 回は止められたあと立ち直った）。試験の形の依頼（計画だけ返す）は 5 回とも通った。3 単位目で、**`general-purpose` に「`.claude/agents/nextjs-implementer.md` の本文を読んで従う」と指示して同じ依頼を出したところ、止められずに最後まで進んだ**（1 回のみ。モデルは Opus）。原因は確定していないが、定義をシステムプロンプトとして入れていることが関わっていそう
  - **当面の頼み方**: 実装は `general-purpose` に上の形で依頼する（コミットの Co-Authored-By も依頼文で指定する）。止められたら同じ依頼で 1 回だけ再実行し、それでも止まれば AI 本体が直接実装する
- **コミット**: ループ中は実装担当が自律的にコミットする（1 サイクル 1 コミット）。push はユーザーの指示があったときだけ
- **AI 利用の記録**: 実装担当は `docs/` を書き換えない指示にしているので、`docs/ai-usage.md` への追記は呼び出し側（AI 本体）が行う
- **`.next/` の掃除**: ページやルートを消したあと typecheck が落ちたら `docker compose run --rm --no-deps -T app sh -c "rm -rf .next/*"`
- **production ビルド**は `Dockerfile` でのみ行う（`app` コンテナ内で `next build` すると失敗する）
