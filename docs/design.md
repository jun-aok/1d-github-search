# 設計

`docs/requirements.md` をどう実現するか。判断の理由は各所に「→ 理由:」として添える。README の「選択理由」はここから拾う。

## 1. 構成

```
ブラウザ (Client Component + TanStack Query)
   │  GET /api/search?q=&page=        GET /api/repos/{owner}/{repo}
   ▼
BFF (Next.js Route Handler)          ← GITHUB_TOKEN はここだけが持つ
   │  入力をモデルの型に変換 → GitHub に問い合わせ → 応答をモデルの型に変換 → JSON で返す
   ▼
GitHub REST API
```

| 層 | やること | やらないこと |
| --- | --- | --- |
| ブラウザ | 表示、入力、URL の読み書き、BFF の呼び出しとキャッシュ | GitHub を直接呼ぶ、トークンを持つ |
| BFF | 入力検証、GitHub 呼び出し、レスポンスの検証と変換、エラーの統一 | 状態を持つ、表示用の整形（カンマ区切り等） |

- サーバーではデータを取得しない。ページは Client Component として描画し、データはブラウザから BFF に取りに行く。Next.js はそれでも初期 HTML（データの入っていない枠）をサーバーで作るが、これは静的なものでデータ取得を伴わない
  → 理由: ツールと判断して、SEO が不要。サーバーは「パラメータを組み立てて GitHub に問い合わせる」だけの薄い層にして小さく保つ
- GitHub を直接呼ばず BFF を挟む → 理由: トークンをブラウザに出さない。レスポンスを画面用の型に絞る
- UI は Tailwind CSS のみで最低限のデザインを当てる。shadcn/ui 等のコンポーネントライブラリは使わない → 理由: 部品が少なく、導入コストに見合わない

## 2. ディレクトリ

```
src/
  app/
    layout.tsx                         html / body、ヘッダー（タイトル → /）。Server Component のまま（データ取得はしない）
    providers.tsx                      "use client"。QueryClientProvider で children を包む。layout.tsx から使う
    page.tsx                           検索ページ
    repos/[owner]/[repo]/page.tsx      詳細ページ
    api/search/route.ts                BFF: 検索
    api/repos/[owner]/[repo]/route.ts  BFF: 詳細
    api/health/route.ts                ヘルスチェック（200 と { status: "ok" }）
    error.tsx / global-error.tsx       描画時の想定外の例外（8 節）
    not-found.tsx                      存在しない URL
  features/
    search/      SearchForm, RepoList, RepoListItem(Link は prefetch={false}), PaginationNav, useSearch, useSearchUrl(URL の読み書き)
    repo/        RepoDetailView, StatCard, NotFound, useRepo
  components/    Skeleton, ErrorMessage, EmptyMessage（画面共通）
  lib/
    model/       モデルの型と parse 関数。result.ts, searchCondition.ts, repoPath.ts,
                 repo.ts(RepoSummary, RepoDetail), searchResult.ts, pagination.ts, apiError.ts
    github/      githubClient.ts(interface), httpGitHubClient.ts(本物。fetch と ヘッダー), fakeGitHubClient.ts(偽物),
                 index.ts(環境変数で選ぶ), parse.ts(GitHub の JSON の形を確かめ、こちらの項目名に写す), githubError.ts
    api/         handlers.ts(handleSearch, handleRepo), appError.ts(AppError), respond.ts(AppError → Response の変換表),
                 withErrorHandling.ts(Deps, defaultDeps を含む), client.ts(ブラウザから BFF を呼ぶ。絶対 URL で fetch)
    http/        readJson.ts(res.json() を unknown で受ける)
    observability/ logger.ts(interface), errorReporter.ts(interface), console.ts, memory.ts, index.ts(既定の実装を返す。テストは Deps で注入)
    format.ts    数値のカンマ区切り、アイコン URL のサイズ指定（avatarUrl）
    model/readonly.ts  DeepReadonly 型
    env.ts       環境変数 → Env。next.config.ts から読み込む
  mocks/         MSW ハンドラ, fixtures/*.json（単体・コンポーネント・E2E で共有）
mock/            画面モック（静的 HTML、Tailwind v4 のブラウザ版）。E2E の DOM 比較の基準。fixtures.js は src/mocks/fixtures から生成
```

- `features/` は画面単位、`lib/` は画面に依存しないコード。`app/` は薄く、ルーティングと組み立てだけ
- `lib/model/` はブラウザと BFF の両方から使う。React にも Next.js にも依存しない

## 3. 型安全とモデル

### 原則

「実行時にならないと分からない」ことを減らし、コンパイル時に検出できる形にする。

1. 外部から来る値（URL、GitHub の応答、BFF の応答、環境変数）は `unknown` として受ける
2. **境界で 1 回だけ**解析して、モデルの型（TypeScript の型が付いた値）に変換する
3. 境界の内側では、解析済みのモデルの型だけを受け渡す。`unknown` や生の JSON を持ち回らない
4. 失敗し得る処理は例外を投げず `Result` を返す → 理由: 失敗が戻り値の型に現れ、処理し忘れがコンパイルエラーになる
5. 分岐は判別共用体と網羅チェック（`switch` の `never`）で書く → 理由: エラーの種類を足したとき、対応漏れがコンパイルエラーになる

禁止（ESLint と tsconfig で機械的に止める。6 節）:

- 型アサーション `as`（`as const` は可）、`any`、非 null アサーション `!`、`@ts-ignore` / `@ts-expect-error`

### 境界

| 境界 | 入ってくるもの | 変換先 |
| --- | --- | --- |
| 検索ページの URL / BFF のクエリ | `URLSearchParams` | `SearchCondition` |
| 詳細ページのパス / BFF のパス | `{ owner, repo }` | `RepoPath`（ページは `parseEncodedRepoPath`、BFF は `parseRepoPath`） |
| GitHub の応答（BFF） | JSON（`unknown`） | `SearchResult` / `RepoDetail` / `GitHubError` |
| BFF の応答（ブラウザ） | JSON（`unknown`） | `SearchResult` / `RepoDetail` / `ApiError` |
| 環境変数 | `process.env` | `Env` |

- `res.json()` の戻り値は `any` なので、`lib/http/readJson.ts` で `unknown` にしてから解析に渡す

### モデルの型の作り方

```ts
// lib/model/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export type ParseError = { issues: { path: string; message: string }[] };

// lib/model/searchCondition.ts
import { z } from "zod";

const schema = z.object({                       // export しない
  query: z.string().trim().min(1).max(256),
  page: z.number().int().min(1).max(50),
});

export type SearchCondition = DeepReadonly<z.infer<typeof schema>>;   // DeepReadonly は lib/model/readonly.ts の自前の型。ネストした owner や items も書き換え不可にする
// = { readonly query: string; readonly page: number }

export function parseSearchCondition(input: unknown): Result<SearchCondition, ParseError> { ... }
```

- 検証には zod を使う → 理由: `unknown` の構造を確かめるコードを手書きすると、項目ごとの写し間違いが起きやすく、失敗した項目の情報も自分で組み立てることになる
- **zod はモデルのファイルの中に隠す**。外に出すのは TypeScript の型と `parseXxx` 関数だけ。スキーマ、`ZodError`、zod の型は export しない
  → 理由: 利用側は zod を知らなくてよい。検証ライブラリを差し替えても、影響がモデルのファイルに閉じる
- zod を import してよいのは `lib/model/`、`lib/github/parse.ts`、`lib/env.ts` だけ。ESLint の `no-restricted-imports` で止める（6 節）
- 型は `z.infer` でスキーマから導出する → 理由: 型と検証を二重に書かず、食い違いが起きない
- 解析の失敗は自前の `ParseError` に詰め替えて返す（`ZodError` を外に出さないため）
- モデルの型はクラスにせず、読み取り専用のただのオブジェクトにする。振る舞いは関数で書く（`totalPages(result)` など）→ 理由: そのまま JSON にでき、BFF とブラウザの間で詰め替えが要らない
- `.brand()` は使わない（zod の型が外に漏れるため）。その代わり「モデルの型の値は `parseXxx` か、モデルのファイル内の関数からしか作らない」を規約とする。同じ形のオブジェクトを手で書けば型は通ってしまうので、ここは型ではなく規約とレビューで守る

### 一覧

| 型 | 中身 | 規則（`parse` が保証する） |
| --- | --- | --- |
| `SearchCondition` | `query`、`page` | `query`: trim 後 1〜256 文字。`page`: 1〜50 の整数（1,000 件 ÷ 20 件）。URL との変換は `searchConditionFromParams(params: URLSearchParams)`（`q` → `query`、文字列の `page` → 数値。`page` は `^[1-9][0-9]*$` だけを認め、`02` や `2.0` は不正。省略は 1）と `toSearchParams(condition)`。BFF も `useSearchUrl` もこの 2 関数を使う |
| `RepoPath` | `owner`、`name` | 危険なものだけを断る: `.` と `..` そのもの、`/` `\` 空白 制御文字を含むもの、空文字、長すぎるもの（`owner` 39 文字超、`name` 100 文字超）。それ以外は通し、実在するかは GitHub に判断させる |
| `RepoSummary` | 4 節の JSON の形 | 数値は 0 以上の整数。`description` と `language` は `null` あり。URL は https |
| `RepoDetail` | `RepoSummary` + `watchers`、`forks`、`openIssues` | 同上 |
| `SearchResult` | `totalCount`、`items: RepoSummary[]` | `items` は最大 20 件 |
| `Pagination` | 現在ページ、総ページ数、前後の有無 | 外から解析するものではなく、`SearchCondition` と `totalCount` から関数で導出。総ページ数 = `ceil(min(totalCount, 1000) / 20)` |
| `ApiError` | `code`、`message`、`requestId`、`retryAfter?`、`detail?` | `code` は 5 種の共用体 |
| `Env` | `nodeEnv`（`development` / `test` / `production`）、`githubToken`、`githubClient` | production かつ `githubClient` が `http` なら `githubToken` 必須。`test` は development と同じ扱い |

- Entity に当たるのは Repository（`RepoSummary` / `RepoDetail`）で、識別子は `id`。リストの `key` など同一判定に使う。`owner/name` は名称変更・移管で変わる
- 作成・更新・削除が無いので、ドメインサービスは作らない。GitHub からの取得だけ `GitHubClient` として抽象化する（4 節）

## 4. BFF の API 仕様

クライアントと BFF の契約。MSW のモックもテストもこれに従う。

### JSON の形

モデルの型がそのまま JSON の形になる（下は `z.infer` の結果を書き下したもの）。BFF が返し、ブラウザ側の `parseXxx` が受け取る。

```ts
type RepoSummary = {
  id: number;
  fullName: string;            // "owner/name"
  owner: { login: string; avatarUrl: string };
  description: string | null;
  language: string | null;
  stars: number;
  url: string;                 // html_url
};

type RepoDetail = RepoSummary & {
  watchers: number;            // subscribers_count
  forks: number;
  openIssues: number;          // open_issues_count（PR を含む）
};

type SearchResult = { totalCount: number; items: RepoSummary[] };

type ApiError = {
  code: "BAD_REQUEST" | "NOT_FOUND" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INTERNAL_ERROR";
  message: string;           // 開発者向けの短い説明。画面は code で分岐し、message は表示しない
  requestId?: string;        // ログと突き合わせる ID。BFF に届かなかったエラー（ネットワーク断）には無い
                             // ブラウザ側の失敗（BFF に届かない・JSON でない・形が違う）は createClientError で UPSTREAM_ERROR・requestId なしにする
  detail?: string;           // development のみ。元の例外のメッセージ・スタック、GitHub の応答本文
  retryAfter?: number;       // RATE_LIMITED のとき。秒
};

type ErrorResponse = { error: ApiError };   // エラー応答の JSON。成功の応答と見分けるために 1 段包む
```

### `GET /api/search?q=&page=`

- クエリを `SearchCondition` に変換する（`page` 省略時は 1）。変換できなければ 400
- GitHub `GET /search/repositories?q=&per_page=20&page=` を呼び、`SearchResult` を返す
- `totalCount` は GitHub の `total_count` そのまま（1000 件制限の考慮はクライアントの総ページ数計算で行う）

### `GET /api/repos/{owner}/{repo}`

- パスを `RepoPath` に変換する。変換できなければ GitHub に問い合わせず 404（存在し得ない名前のため）
  → 理由: `..` などで GitHub の別の URL を呼ばされるのを防ぐ。一方、名前の形を厳密に再現しようとすると実在するリポジトリを誤って弾くので、URL を壊すものだけを断る
- GitHub `GET /repos/{owner}/{repo}` を呼び、`RepoDetail` を返す。URL は `RepoPath` から組み立て、各部を `encodeURIComponent` する
- GitHub が 301 を返しても `fetch` がリダイレクトを追うので 200 になる。`fullName` は移動後の名前。URL（移動前の名前）と表示名が食い違うが、許容する（リダイレクトもしない）
- Route Handler の `params` は Promise（Next.js 16）。`await` して使う。
- `params` の値の符号化は、ページと Route Handler で違う（Next.js 16.4 の production ビルドで確認）。ページには `/repos/a%20b/x` の `owner` が `a%20b` のまま届き、Route Handler には復号済みで届く。ページは 1 回だけ復号してから確かめる `parseEncodedRepoPath`（不正な `%` は `ParseError`）を使い、Route Handler は `parseRepoPath` をそのまま使う → 理由: 復号せずに確かめると、空白や `/` を含むパスも通って BFF に問い合わせてしまう。逆に復号済みの値をもう一度復号すると、`%` を含む値の意味が変わるページの `page.tsx` は Server Component のまま `await params` し、`{ owner, repo }` を Client Component（`RepoDetailPage`）に props で渡す → 理由: 検索ページの `page.tsx` と書き方が揃い、コンポーネントテストで Next.js のルーターを偽物にせずに済む（Client Component で `use(params)` / `useParams()` を使う方法も動くことは確認済み）
- `notFound()` は Server Component / Route Handler 用で Client Component からは呼ばない（公式ドキュメント）。詳細ページの 404 は `NotFound` コンポーネントを描画する

### GitHub へのリクエスト

| ヘッダー | 値 |
| --- | --- |
| `User-Agent` | `github-repository-search`（必須。無いと 403） |
| `Accept` | `application/vnd.github+json` |
| `X-GitHub-Api-Version` | `2022-11-28` |
| `Authorization` | `Bearer ${GITHUB_TOKEN}`（production では必須。development では、あるときだけ） |

- 応答の変換は 2 段階。`lib/github/parse.ts` が GitHub の形（`stargazers_count` など）を確かめてこちらの項目名（`stars` など）に写し、それをモデルの `parseSearchResult` / `parseRepoDetail` に通してモデルの型にする。どちらかで失敗したら `upstream`（`reason: "contract"`）→ 理由: モデルの規則を確かめる場所をモデルのファイル 1 か所に揃える。GitHub の仕様変更を黙って画面に流さない
- GitHub からの取得は interface で抽象化し、Route Handler は interface にだけ依存する

  ```ts
  interface GitHubClient {
    search(condition: SearchCondition): Promise<Result<SearchResult, GitHubError>>;
    getRepo(path: RepoPath): Promise<Result<RepoDetail, GitHubError>>;
  }
  ```

  | 実装 | 中身 | 使う場面 |
  | --- | --- | --- |
  | `HttpGitHubClient` | `fetch` で GitHub を呼ぶ。この節のヘッダー・エラー対応・解析はこの実装の仕様 | development、production |
  | `FakeGitHubClient` | `src/mocks/fixtures` のデータを返す。検索キーワードで応答を切り替える（`__empty__` → 0 件、`__few__` → 2 件（1 ページ）、`__rate_limited__` → レート制限、`__error__` → 障害、それ以外 → 通常の 20 件）。`getRepo` は owner で切り替える（`__not_found__` → 404、`__rate_limited__` → レート制限、`__error__` → 障害、それ以外 → fixture の詳細） | E2E。Route Handler の単体テストにも注入できる |

  - 実装は環境変数 `GITHUB_CLIENT`（`http` | `fake`、既定 `http`）で `lib/github/index.ts` が選ぶ。`fake` のときは起動時に警告ログを出す
    → 理由: E2E で本物の GitHub を呼ばない（レート制限、結果の変動、エラー状態を再現できない）。本物の実装にテスト用の分岐を入れない
  - 名前を `GitHubRepository` にしないのは、このアプリで「Repository」が GitHub のリポジトリ（扱うデータ）を指すため
- `GitHubClient` の戻り値は `Result<T, GitHubError>`

  ```ts
  type GitHubError =
    | { kind: "rate_limited"; retryAfter: number; response?: GitHubResponseInfo }
    | { kind: "not_found" }
    | { kind: "invalid_request"; detail: string }                                   // GitHub が 422
    | { kind: "upstream"; reason: "http" | "network" | "timeout" | "contract"; detail: string; response?: GitHubResponseInfo };

  // GitHub の応答があったときのステータスと x-ratelimit-remaining / x-ratelimit-reset（無ければ null）。ログにだけ残し、BFF の応答には出さない
  type GitHubResponseInfo = { status: number; rateLimitRemaining: number | null; rateLimitReset: number | null };

  type AppError = GitHubError | { kind: "bad_request"; detail: string } | { kind: "internal"; detail: string };
  ```

  - `upstream.reason` の `http`（5xx）/ `network`（繋がらない）/ `timeout` は GitHub 側の障害で待てば直る。`contract`（応答の形が想定と違う）はこちらのコードが古い。応答は同じ 502 だが、ログで区別する
- レート制限: 未認証は検索 10 回/分・その他 60 回/時、トークンありは 30 回/分・5,000 回/時

### エラーの対応表

| GitHub | `AppError.kind` | BFF の応答 | ログ |
| --- | --- | --- | --- |
| （クエリが `SearchCondition` に変換できない） | `bad_request` | 400 `BAD_REQUEST` | なし |
| （パスが `RepoPath` に変換できない） | `not_found` | 404 `NOT_FOUND` | なし |
| 403 / 429（`x-ratelimit-remaining: 0` または `retry-after` あり） | `rate_limited` | 429 `RATE_LIMITED`（`retryAfter` = `retry-after` か `x-ratelimit-reset` までの秒数を切り上げた整数。0 未満は 0。どちらも無ければ 60） | `warn` |
| 404 | `not_found` | 404 `NOT_FOUND` | なし |
| 422 | `invalid_request` | 400 `BAD_REQUEST` | なし |
| 5xx | `upstream` / `http` | 502 `UPSTREAM_ERROR` | `error` |
| 繋がらない | `upstream` / `network` | 502 `UPSTREAM_ERROR` | `error` |
| 10 秒以内に返らない | `upstream` / `timeout` | 502 `UPSTREAM_ERROR` | `error` |
| 応答の形が想定と違う | `upstream` / `contract` | 502 `UPSTREAM_ERROR` | `error`（`reason: contract` を付け、ログで検索できるようにする） |
| 上記以外（401、レート制限でない 403、451 など） | `upstream` / `http` | 502 `UPSTREAM_ERROR` | `error`（ステータスを付ける） |
| （BFF 自身のバグ・想定外の例外） | `internal` | 500 `INTERNAL_ERROR` | `reporter.report` |

- 応答にキャッシュのヘッダーは付けない（CDN は使わない。検索ボタンを押すたびに最新を取る要件のため）
- BFF から GitHub へのタイムアウトは 10 秒（`AbortSignal.timeout`）→ 理由: GitHub の通常の応答は 1 秒未満。それより十分長く、利用者が待てる上限として

## 5. 画面

- ページネーション（無限スクロールではない）→ 理由: 検索キーワードとページを URL に持てるので、リロード・共有・ブラウザバックで状態を復元できる
- 1 ページ 20 件（決定事項）

### 状態の持ち方

- **URL が唯一の状態**。検索ページは `?q=&page=`、詳細ページはパス。React の state は入力欄の下書きだけ
  → 理由: リロード・共有・ブラウザバックの要件を追加コードなしで満たす
- サーバーから取った値は TanStack Query で管理 → 理由: キャッシュ、前の結果の保持、取得中の状態を自前で書かずに済む
  - キー: `["search", q, page]`、`["repo", owner, repo]`
  - `queryFn` は例外を投げず `Result<SearchResult, ApiError>` を返す（ネットワーク断や解析失敗も `ApiError` に変換する）→ 理由: TanStack Query の `error` は型が保証されないため、想定内のエラーは `data` 側で型付きで扱う
  - 検索の `queryFn` は、その `Result` に取得した条件を添えた `{ condition, result }` を返す → 理由: 前の結果を薄く表示している間は URL の条件と表示中の結果の条件が違う。件数・ページ番号・ページ送りの移動先は、表示中の結果の条件から求める
  - 取得中は `placeholderData: keepPreviousData` で前の結果を保持し、薄く表示する。ページ送りでも、別のキーワードの検索でも、同じキーワードの再検索でも同じ扱い → 理由: 薄くなっていれば読み込み中だと分かる。場面ごとに見せ方を変える必要がない
    - 一覧はモックどおり `<ul>` を薄くする。エラー・0 件・範囲外の表示は、取得中だけ `opacity-50` と `aria-busy` を付けた `<div>` で包む（`Faded`）
    - 詳細ページも同じ扱いにする。前の失敗（エラー・見つからない）を表示したまま取り直す間（もう一度開いた直後・再試行の直後）は `Faded` で包む → 理由: 失敗は覚えないが `data` には残るので、包まないと前回のエラーが現在のものに見える
    - 初期画面（条件なし）を挟んだら、前の結果は無い扱いにしてスケルトンを出す。`keepPreviousData` は「最後にデータを持っていた問い合わせ」のデータを返すので（TanStack Query 5.104 で確認）、条件なしの問い合わせに `initialData: null` を持たせ、前が `null` なら何も残さない `keepPreviousResult` を `placeholderData` に使う
  - 自動の再試行はしない（`retry: false`）。再試行は利用者のボタン操作（`refetch`）→ 理由: `Result` 方式では失敗が例外にならず、TanStack Query の再試行が効かない。レート制限中の自動再試行は逆効果でもある
  - ウィンドウに戻ったとき・通信が戻ったときも自動で取り直さない（`QueryClient` の既定で `refetchOnWindowFocus: false`、`refetchOnReconnect: false`）→ 理由: 失敗は覚えない（`staleTime` 0）ので、既定のままだとタブを行き来するたびにレート制限中の GitHub を叩き直す
  - 一覧 → 詳細 → 戻る でキャッシュが効き、再取得しない。覚えるのは成功した結果だけ（60 秒）。失敗（`ok: false`）は覚えず、同じ条件を次に表示するとき必ず取り直す → 理由: `Result` 方式では失敗も `data` に入るため、区別しないとエラー画面が 60 秒残る（`staleTime` に結果を受け取る関数を渡す。TanStack Query v5.104 で確認済み）
  - 検索ボタンを押したら、URL が変わらなくても（同じキーワードでも）必ず取り直す → 理由: 押したのに反応がない状態を作らない。エラー表示からの復帰にもなる
- `useSearchParams` を使うコンポーネントは `<Suspense>` で包む（Next.js の要件）
- 検索ページ内の URL の書き換えは `router.push` ではなく `window.history.pushState` で行う → 理由: `router.push` は Next.js のサーバーにページ情報を取りに行くことがあり、ブラウザだけで描画するこの構成では不要な通信になる。`useSearchParams` は `pushState` / `replaceState` / ブラウザバック・フォワードの変更を検知する（Next.js 16.4 で確認済み。公式ドキュメント「Native History API」にも明記）
- URL の読み書きは `useSearchUrl` に閉じ込め、コンポーネントは `useSearchParams` や `pushState` を直接使わない

  ```ts
  function useSearchUrl(): {
    condition: Result<SearchCondition, ParseError> | null;   // URL から解析した検索条件。q が無ければ null
    navigate: (condition: SearchCondition) => void;           // URL を書き換える
  }
  ```

  → 理由: コンポーネントテスト（jsdom）には Next.js のルーターが無く `useSearchParams` を偽物にするしかないが、偽物では `pushState` の結果を読めない。読み書きを 1 つのフックにまとめれば、テストではメモリ上で読み書きする偽物に差し替えるだけで「操作 → 条件が変わる → 表示が変わる」まで確かめられる。実際の URL との連動（アドレスバー、ブラウザバック）は E2E で確かめる
- 一覧の行の `<Link>` は `prefetch={false}` → 理由: 既定では画面に入った行の遷移先を先読みしてサーバーに通信する。20 行分のほとんどが無駄で、不要なサーバー通信を避ける方針に反する
- `lib/api/client.ts` は `new URL(path, window.location.origin)` で絶対 URL を組み立てて `fetch` する → 理由: jsdom では相対 URL の `fetch` が解決できないことがある

### 検索ページ

```
page.tsx
└ SearchPage (client)            URL を SearchCondition に変換し、useSearch(condition) を呼ぶ
   ├ SearchForm                  入力欄（maxLength=256）+ ボタン。submit で URL を /?q=… に（page は付けない = 1）。空白のみ・読み込み中はボタン無効
   │                              入力欄は下書きとして state で持ち、URL の q が変わったら（ブラウザバック等）それに合わせる
   ├ 状態に応じて 1 つ:
   │   EmptyMessage(初期) / Skeleton / RepoList / EmptyMessage(0 件) / ErrorMessage
   └ PaginationNav               前へ・次へで URL を /?q=…&page=… に。新しいページの結果が表示されたらページ先頭へスクロール。範囲外のページでは「前へ」は最終ページへ
```

状態の決め方:

| 条件 | 表示 |
| --- | --- |
| URL に `q` が無い | 初期 |
| URL のパラメータが不正（`useSearchUrl` が `replaceState("/")` で URL を直し、`condition` を null にする） | 初期 |
| 取得中で、前の結果が無い（最初の検索、直接アクセス） | スケルトン |
| 取得中で、前の結果がある（前の結果がエラーや 0 件でも同じ。その表示を薄くする） | 前の結果 + 薄く表示 |
| `data.ok === false` かつ `code === "RATE_LIMITED"` | レート制限 + 再試行（文言はモックどおり固定。`retryAfter` は応答に含めるが画面には出さない） |
| `data.ok === false`（その他） | 通信エラー + 再試行 |
| `totalCount === 0` | 0 件 |
| `items.length === 0`（`totalCount` は 1 以上 = 総ページ数を超えたページ） | 範囲外: 空の一覧 + 「このページには結果がありません」+ 件数とページネーション |
| それ以外 | 一覧 + ページネーション |

- この対応は「画面の状態」を判別共用体（`initial` / `loading` / `refreshing` / `rateLimited` / `failed` / `empty` / `outOfRange` / `loaded`）として求める純粋関数にし、コンポーネントは網羅的な `switch` で描画する
- URL のパラメータが不正な場合（`page` が 1〜50 の整数でない、`q` が空・空白のみ・256 文字超、`q` が無いのに `page` がある）は、検索せず初期画面（トップページ）を表示する。値を直して検索することはしない → 理由: 規則が 1 つで済む。BFF と同じ `parseSearchCondition`（厳密）をそのまま使え、失敗したら初期画面にするだけでよい
  - `page` の省略は不正ではなく 1 ページ目。画面から 1 ページ目へ移動するときも `page` を付けない（`/?q=react`）
  - 初期画面を出すときは、アドレスバーも `/` に書き換える（`replaceState`）→ 理由: URL と表示を一致させる
  - 総ページ数を超える `page` は、問い合わせるまで分からないので不正扱いにしない。GitHub は 200・`total_count` あり・`items` 空を返す（確認済み）ので、そのまま空のページとして表示する

### 詳細ページ

```
page.tsx
└ RepoDetailPage (client)        params を RepoPath に変換し、useRepo(path) を呼ぶ。変換できなければ NotFound
   └ Skeleton / RepoDetailView / NotFound / ErrorMessage（レート制限は検索ページと同じ部品・文言）
```

- 「検索ページへ戻る」は `layout.tsx` のヘッダーのタイトル（`<Link href="/">`）。ブラウザバックは URL に状態があるので何もしなくてよい
- 数値の表示は `format.ts` の `formatNumber`（`Intl.NumberFormat("ja-JP")`）

## 6. 横断事項

- 実行基盤はすべて Docker（Docker Compose）。ホストに置くのは Docker だけで、Node.js や `node_modules` はコンテナの中 → 理由: 面接官を含め、誰の環境でも同じ手順・同じ結果で動かす。本番と同じイメージで E2E を回す

  | サービス | 中身 | 用途 |
  | --- | --- | --- |
  | `app` | `node:24` + ソースをマウント、`next dev`。`node_modules` は名前付きボリューム | development。lint / 型チェック / 単体テストもこのコンテナで `docker compose run --rm app npm run …` |
  | `app-prod` | `Dockerfile` の production イメージ（`next build` → standalone 出力だけを入れた実行用ステージ、`USER node`、`HEALTHCHECK`）。profile `prod` | 擬似本番（`GITHUB_CLIENT=http` + トークン） |
  | `app-e2e` | 同じ `Dockerfile` を `GITHUB_CLIENT=fake` でビルド。profile `e2e` | E2E の対象。`app-prod` と Dockerfile は同じで、環境変数だけが違う（ビルド時の env 検証にトークンが要るため、サービスを分けている） |
  | `e2e` | Playwright 公式イメージ（`@playwright/test` と同じ版） | `app-e2e` に向けて E2E を実行 |

- 環境の定義

  | 環境 | 起動 | `NODE_ENV` | `GITHUB_CLIENT` | `GITHUB_TOKEN` |
  | --- | --- | --- | --- | --- |
  | development | `docker compose up app` | development | http | 任意 |
  | test | `docker compose run --rm app npm test` | test | （偽物を注入） | 不要 |
  | e2e | `docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e e2e`（`app-e2e` を起動し `e2e` を実行。イメージのビルドを含めて約 2 分） | production | fake | 不要 |
  | production（擬似本番） | `docker compose --profile prod up`（`app-prod` を http で起動） | production | http | 必須 |

  - `NODE_ENV` の由来: `next dev` = development、`next build` / `next start` = production、Vitest = test
  - `app` サービスは `NODE_ENV=development` なので、その中で `next build` を実行すると React の dev / prod 不一致で失敗する（確認済み）。production ビルドは必ず `Dockerfile`（`app-prod` / `app-e2e`）で行う
  - production イメージには、ヘルスチェック用の `GET /api/health`（200 と `{ status: "ok" }` を返すだけ。GitHub は呼ばない）と、`next.config.ts` の最低限のセキュリティヘッダー（`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`）を含める → 理由: 要件外だが数行で済み、コンテナ基盤での死活監視と最低限の防御という「本番を意識した」点を示せる
  - 公開環境（Vercel 等）へのデプロイは未確定。行う場合も本番の定義は上の production イメージとし、公開環境は補助とする

  | | development | production |
  | --- | --- | --- |
  | `GITHUB_TOKEN` | 任意（無ければ未認証で呼ぶ） | **必須**。無ければビルド・起動が失敗する（`GITHUB_CLIENT=fake` のときは不要） |
  | `GITHUB_CLIENT` | `http`（既定）または `fake` | 同左。E2E は production ビルド + `fake` で動かす |
  | エラーの詳細（`ApiError.detail`、スタック） | 画面に表示する | 応答にも画面にも出さない |
  | エラーログ | console（標準出力 / 標準エラー）に JSON 1 行 | console（標準出力 / 標準エラー）に JSON 1 行 |

- 環境変数は `lib/env.ts` で `Env` に変換し、`next.config.ts` から import する → 理由: `next build` と `next start` の両方で評価されるので、トークンの設定漏れがデプロイ時に止まる。リクエストが来てから気づくことがない
  - エラーメッセージは「`GITHUB_TOKEN` が未設定です。… を参照」のように、何をすればよいか分かる文にする
  - CI のビルドと E2E は `GITHUB_CLIENT=fake` で行う（GitHub を呼ばず、トークンも不要）
  - `.env.example` に記載。`NEXT_PUBLIC_` は付けない
- 型安全の強制（3 節の原則）:
  - tsconfig: `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noFallthroughCasesInSwitch`（確認済み: zod の `.optional()` は `?: T | undefined` と推論される。`z.infer` をそのまま型にすれば問題ないが、手書きの型に `?: T` と書いて代入すると `exactOptionalPropertyTypes` でエラーになるので、手書きするなら `?: T | undefined` と書く）
  - ESLint（typescript-eslint の `strictTypeChecked`）: `consistent-type-assertions`（`assertionStyle: "never"`）、`no-restricted-imports`（zod の import を許可した場所以外で禁止）、`no-explicit-any`、`no-non-null-assertion`、`no-unsafe-*`、`switch-exhaustiveness-check`、`ban-ts-comment`
  - テストコードにも同じ規則を適用する。fixture も `parse` を通して作る
- オーナーアイコンは `next/image` を使わず、`<img>` でブラウザが GitHub から直接読む。URL の `s` パラメータでサイズを指定し（一覧は 80 = 表示 40px の 2 倍、詳細は 128 = 表示 64px の 2 倍）、`width` / `height` を指定し、一覧のアイコンには `loading="lazy"` も付ける（詳細のアイコンは画面の最上部の 1 枚なので付けない。モックどおり）。GitHub の URL には既に `?v=4` が付いているので、文字列連結ではなく `URL` オブジェクトの `searchParams.set("s", …)` で付ける（`format.ts` の `avatarUrl(url, size)`） → 理由: アイコンは小さく、サーバーで変換する利点がない。画像の取得・変換を自分のサーバーにさせない
  - ESLint の `@next/next/no-img-element` はこの方針と衝突するので無効にする
- アクセシビリティ: フォームにラベル、一覧は `<ul>`/`<li>`、行は `<a>`、読み込み中は `aria-busy`、エラーは `role="alert"`、アイコンの `alt` は、一覧では空（行のリンク文字列に owner が含まれるため装飾扱い）、詳細では「{owner} のアイコン」
- Next.js 16 で使わない機能: Cache Components / `use cache`（サーバーでデータを取得しないため）、`proxy`（旧 middleware）

## 7. テスト

ツールの選択: Vitest（Vite ベースで速く、TypeScript と ESM をそのまま扱える）、Testing Library（利用者の操作に近い形で部品を確かめる）、MSW（通信を横取りするので、`fetch` を書き換えずに済む）、Playwright（本物のブラウザで動かせる。公式の Docker イメージがある）

| 対象 | 種類 | 代表的なケース |
| --- | --- | --- |
| `lib/model/*`、`lib/github/parse.ts`、`format.ts` | 単体 | 各モデルの規則の境界値（0・1・256・257 文字、ページ 0・1・50・51）、`null` 言語、欠けた項目、総ページ数（0 件、1000 件超） |
| `HttpGitHubClient` | 単体（GitHub を MSW でモック） | 送るヘッダー、正常系、403/404/422/5xx・タイムアウト・解析失敗が正しい `GitHubError` になる |
| 各処理（`handleSearch` / `handleRepo`） | 単体（`GitHubClient` を偽物に） | 入力の解析、偽物の結果がそのまま返ること |
| 各コンポーネント | コンポーネント（jsdom。BFF は MSW でモック、`useSearchUrl` は偽物） | `SearchForm`: 空白のみで無効、Enter で `navigate`。`RepoListItem`: 各項目と `null` 言語の「—」。`Pagination`: 端で無効。`ErrorMessage`: レート制限の文言、再試行、`detail` の出し分け。`RepoDetail`: カンマ区切り。`SearchPage`: 状態ごとの部品の切り替え |
| `respond.ts` | 単体（純粋関数） | `kind` ごとのステータスと `code`（`RepoPath` の失敗は 404）、development / production での `detail` の有無 |
| 画面の状態を求める純粋関数 | 単体 | 条件ごとの状態（不正 URL、範囲外、前の結果の有無）|
| `withErrorHandling` | 単体（`logger` / `reporter` を `memory.ts` に、処理をわざと失敗・例外にする） | `requestId` がヘッダー・JSON・ログで一致、`warn` / `error` の使い分け、例外が 500 になり本文に漏れない |
| `env.ts` | 単体 | production + http でトークン無しは失敗、production + fake は通る、development では通る |
| E2E の追加シナリオ | E2E | 不正 URL → `/` に戻る、範囲外ページ、詳細の 404・レート制限・直接アクセス、モバイル幅 |
| モックとの一致 | E2E（DOM 比較） | 下記 |
| 検索 → 一覧 → 詳細 → 戻る | E2E（Playwright。production ビルド + `GITHUB_CLIENT=fake`） | 検索状態が戻ること、ページ送り、0 件、エラー表示、モバイル幅 |

- MSW のハンドラは 2 種類（GitHub の形: `HttpGitHubClient` のテスト用。BFF の形: コンポーネントテスト用）。fixture は `src/mocks/fixtures/` に 1 セットだけ置き、両方のハンドラと `FakeGitHubClient` で共有する。fixture はセットアップ時に GitHub の生の JSON を項目を削らずに取り直して置く（`HttpGitHubClient` が本物の形を解析できることを確かめるため）。`mock/fixtures.js` はこの生 JSON から生成する（モックと E2E が同じデータを表示するため）
### モックとの一致（DOM 比較）

画像ではなく DOM を比べる → 理由: 見た目は「HTML 構造 + クラス名 + 同じ Tailwind v4」で決まるので、DOM が同じなら見た目も同じ。画像比較はフォントや画像の読み込みで揺れる

| 段 | 比べるもの | 用途 |
| --- | --- | --- |
| A. 構造 | 要素の役割・文言（Playwright の aria snapshot） | 常に E2E に含める。同じ部品が同じ文言・同じ状態で出ていることの判定 |
| B. 見た目 | クラス名を含めた `<header>` と `<main>` の DOM 全体 | 「モックどおりに作る」判定。モックを更新したら実装も更新する運用 |

- 比較の前の正規化: 属性とクラス名を並べ替え、空白を詰め、問い合わせ番号など毎回変わる値は伏せる。モック側の状態切り替えバーは比較範囲外
- モックの状態と実装の条件の対応（`?state=empty` ↔ `/?q=__empty__` など）を E2E に表として持つ。`FakeGitHubClient` の切り替えキーワードをそのまま使う
- 前提: モックのリンク先は実装の URL（`/repos/{owner}/{name}`）に揃える。モックのデータは E2E の fixture から生成する
- 実装はモックの HTML（クラス構成）を元に起こす。後から合わせるのではなく、同じものから作る
- Tailwind v4 のブラウザ版（モック）とビルド済み CSS（実装）で、同じクラスは同じ値になることを確認済み（余白・角丸・フォント・色が一致。色はブラウザ版が `oklch()`、ビルド済みが `lab()` と表記だけ違うが同じ色。DOM 比較には影響しない）

- TDD の進め方は `docs/workflow.md`

## 8. エラーハンドリングと記録

### 方針

- エラーは **想定内**（利用者の操作や外部要因で起こり、画面で案内できる）と **想定外**（バグ・仕様変更）に分け、想定外だけを「記録して気づく」対象にする
- production では、利用者には code に応じた日本語の案内だけを出し、スタックトレースや GitHub の生メッセージは出さない。詳細はログにだけ出す。ただし `requestId` は「問い合わせ番号」として小さく表示する → 理由: 利用者からの問い合わせをログと突き合わせられる。要件の「ログと突き合わせられる」を画面側でも成立させる
- development では、`ApiError.detail` に詳細を入れ、`ErrorMessage` が案内文の下に折りたたみで表示する → 理由: 開発中はログを見に行かずに原因が分かる方が速い
- 記録先は抽象化し、実インフラ（Sentry、Datadog 等）は用意しない。既定実装は console（標準出力 / 標準エラー）に JSON 1 行 → 理由: Vercel 等のホスティングでは標準出力・標準エラーがそのままログ基盤に流れる。実インフラを入れるときは実装を 1 つ足して `index.ts` の選択を変えるだけ

### 分類と扱い

| 種別 | 例 | 利用者への表示 | 記録 |
| --- | --- | --- | --- |
| 入力エラー | `q` が空、`page` 範囲外 | （通常は UI で防ぐ）通信エラー | しない |
| 見つからない | 404 | 404 画面 | しない |
| レート制限 | 403/429 | 上限到達 + 再試行 | `warn`（頻度を見るため） |
| 外部障害 | GitHub 5xx、タイムアウト、ネットワーク | 通信エラー + 再試行 | `error` |
| 契約違反 | GitHub の応答をモデルの型に変換できない | 通信エラー + 再試行 | `error`（仕様変更の検知） |
| 想定外（BFF） | BFF 内の例外（500 `INTERNAL_ERROR`） | 通信エラー + 再試行 | `reporter.report` |
| 想定外（ブラウザ） | 描画時の例外 | 問題が発生しました + 再試行（`error.tsx`） | `console.error` |

### 抽象化

```ts
// lib/observability/logger.ts
type LogLevel = "warn" | "error";
type LogFields = Record<string, unknown>;
interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}

// lib/observability/errorReporter.ts
interface ErrorReporter {
  report(error: unknown, context: { requestId: string; route?: string } & LogFields): void;
}
```

| 実装 | 用途 |
| --- | --- |
| `console.ts` | 既定。`{ level, time, message, requestId, ...fields }` を JSON 1 行で console へ。`warn` は `console.warn`、`error` は `console.error` |
| `memory.ts` | テスト用。配列に貯めて、テストが「記録されたこと」を検証する |

- `index.ts` は既定の実装（Logger は `console.ts`、ErrorReporter は Logger に `error` として書く `createLoggerReporter`）を返す。環境では分岐しない。テストは `Deps` に `memory.ts` を注入する。Route Handler やフックは interface だけに依存する → 理由: 本番用の実装は 1 つしかなく、本番コードにテスト用の分岐を入れない
- 記録に**含めない**もの: `GITHUB_TOKEN`、`Authorization` ヘッダー、リクエスト全文。含めるもの: `requestId`、ルート（パターンでなくパスそのもの。例 `/api/repos/react/react`。owner や repo は秘密ではなく、調査に役立つ）、`q` と `page`（検索条件は個人情報ではない）、GitHub のステータス、`x-ratelimit-remaining` / `x-ratelimit-reset`、所要時間 ms

### BFF 側の流れ

役割分担:

| 部品 | 役割 |
| --- | --- |
| 各処理（`handleSearch` / `handleRepo`） | 入力を解析して `GitHubClient` を呼び、`Result<値, AppError>` を返すだけ。`Response` もログも作らない |
| `withErrorHandling` | すべての Route Handler を包む共通部品。`requestId` の発行、`Result` → `Response` の変換（`respond` を呼ぶ）、ログの記録、想定外の例外の捕捉。応答・ログ・`requestId` はここにだけ集まる |
| `respond.ts` | `AppError` → ステータスと `ErrorResponse` の変換表（純粋関数）。網羅的な `switch`。`detail` を含めるのは development のときだけ |

```ts
// lib/api/handlers.ts（route.ts とは別ファイル。Next.js 16.4 では route.ts に余計な export があってもビルドは通ることを確認したが、テストから直接 import できるよう分ける）
export async function handleSearch(req: NextRequest, _ctx: RouteContext, { github }: Deps) {
  const condition = searchConditionFromParams(req.nextUrl.searchParams);
  if (!condition.ok) return fail({ kind: "bad_request", detail: ... });
  return github.search(condition.value);
}
export async function handleRepo(_req: NextRequest, ctx: RouteContext, { github }: Deps) {
  const path = parseRepoPath(await ctx.params);          // params は Promise（Next.js 16）
  if (!path.ok) return fail({ kind: "not_found" });
  return github.getRepo(path.value);
}

// app/api/search/route.ts
export const GET = withErrorHandling(handleSearch);
// app/api/repos/[owner]/[repo]/route.ts
export const GET = withErrorHandling(handleRepo);

// lib/api/withErrorHandling.ts
type RouteContext = { params: Promise<Record<string, string>> };
function withErrorHandling(handler: (req: NextRequest, ctx: RouteContext, deps: Deps) => Promise<Result<unknown, AppError>>, deps: Deps = defaultDeps) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const result = await handler(req, ctx, deps);
      if (result.ok) return Response.json(result.value, { headers: { "x-request-id": requestId } });
      logFailure(deps.logger, result.error, requestId);
      return respond(result.error, requestId, deps.env);
    } catch (e) {
      deps.reporter.report(e, { requestId, route: req.nextUrl.pathname });
      return respond({ kind: "internal", detail: String(e) }, requestId, deps.env);
    }
  };
}
```

- `Deps` は `{ github: GitHubClient; logger; reporter; env }`。既定は環境から組み立て、テストでは差し替える
- `requestId` はレスポンスの `x-request-id` ヘッダー、`ApiError.requestId`、ログの 3 か所で同じ値
- 想定外の例外の本文は `message: "Internal error"` だけ（development では `detail` に元の例外）
- 正常時は記録しない

### ブラウザ側の流れ

- BFF のエラー応答は `lib/api/client.ts` が `ApiError` に変換し、`Result` の失敗側として返す。画面は `code` で分岐する（5 節の表）
- 描画時の想定外の例外は `app/error.tsx`（ルート単位）と `app/global-error.tsx`（レイアウト含む）で受け、「問題が発生しました」と再試行ボタン（`retry()`）を出す（Next.js 16.3 以降は `reset()` より `retry()` が推奨。同梱ドキュメント `error.md`）。development では例外のメッセージも表示する
- 存在しない URL は `app/not-found.tsx`
- ブラウザ側のエラー記録は `console.error` のみ。BFF 経由でサーバーに送る仕組みはスコープ外 → 理由: 無認証の受け口を増やすリスクに見合わない
