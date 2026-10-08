# CLAUDE.md

GitHubのリポジトリーを検索するwebアプリケーションをNext.jsで作成するプロジェクト

## 環境

| 項目 | 採用 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript (strict) |
| パッケージマネージャー | npm（Node v24） |
| スタイル / UI | Tailwind CSS v4 |
| データ取得（ブラウザ） | TanStack Query v5 |
| 実行時の検証 | zod v4（`lib/model/`、`lib/github/parse.ts`、`lib/env.ts` の内部でのみ使う） |
| Lint / Format | ESLint（typescript-eslint strictTypeChecked）+ Prettier |
| 単体・コンポーネントテスト | Vitest + React Testing Library |
| API モック | MSW |
| E2E | Playwright |
| 実行基盤 | Docker Compose（development / e2e / production の 3 構成。ホストに Node.js は不要） |
| CI | GitHub Actions（lint / typecheck / 単体テスト / E2E。すべて Docker Compose 経由） |

環境変数は `.env.local` に置く。`GITHUB_TOKEN`（production では必須、サーバー側のみ）、`GITHUB_CLIENT`（`http` | `fake`）。

## コマンド

すべて Docker Compose 経由で実行する。ホストで `npm` を直接実行しない（ホストに `node_modules` を作らない）。初回は `docker compose run --rm app npm install` で依存を入れる。

```bash
docker compose up app                                   # 開発サーバー（development）http://localhost:3000
docker compose run --rm --no-deps -T app npm run lint   # ESLint + Prettier --check
docker compose run --rm --no-deps -T app npm run typecheck
docker compose run --rm --no-deps -T app npm test       # Vitest（単体・コンポーネント）
docker compose run --rm --no-deps -T app npm run format # Prettier --write
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e e2e   # E2E（production イメージ + fake）約 2 分
GITHUB_TOKEN=... docker compose --profile prod up --build   # 擬似本番（production イメージ + 本物の GitHub）
```

- production ビルドは `Dockerfile` で行う。`app` サービス内で `next build` を実行しない（`NODE_ENV=development` のため失敗する）
- 作業完了の報告前に lint / typecheck / 単体テスト / E2E をすべて通すこと。Stop フックも同じものを検査する
- Next.js 16 の仕様は学習時の知識と違う。`node_modules/next/dist/docs/` の同梱ドキュメントを読む（`AGENTS.md` 参照）

## 開発の進め方

- ループ前に E2E テストをすべて定義し、ユーザーがレビューしてからループに入る
- ループ中は二重ループ: Red の E2E を 1 グループ選び、内側で TDD（単体テスト 1 件 → 実装 → Green → リファクタリング → コミット）を回す
- E2E が 1 グループ Green になるたびに `code-reviewer` にレビューさせ、「必ず直す」指摘が無くなってから次へ進む。結果は `docs/review-log/` に記録。最後に全体レビュー
- 完成 = lint / 型チェック / 単体テスト / E2E がすべて通ること。Stop フックが判定する
- テストを通すためにテスト側を弱めない。`.claude/loop-active` はユーザーだけが操作する
- 手順の詳細は `docs/workflow.md`

## AI 利用の記録（必須）

依頼を受けて作業したら、応答を終える前に `docs/ai-usage.md` の表に 1 行追記する（日付 / 依頼 / AI がしたこと / 人間の判断・修正）。README の「AI の利用方法レポート」の元ネタになる。

## ドキュメント

作業を始める前に、該当するものを読むこと。

- `docs/request.md` — 依頼元の要望（原文に近い形）
- `docs/requirements.md` — 要件（判定できることだけ）と未確定事項
- `docs/design.md` — 構成、ディレクトリ、BFF の API 仕様、画面の状態設計、テスト設計（判断の理由は各所に併記）
- `docs/test-cases-e2e.md` — E2E テストケースの一覧（自然言語。これが正で、`e2e/` はその実装）
- `docs/workflow.md` — TDD の手順、作業ルール
- `docs/ai-usage.md` — AI 利用の記録（依頼ごとに追記）
- `docs/review-log/` — code-reviewer のレビュー記録（外側のループ 1 周ごと）
- `docs/impl-log/` — 実装ログ（`nextjs-implementer` が呼び出しごとに 1 ファイル。迷った点・判断・実装）
