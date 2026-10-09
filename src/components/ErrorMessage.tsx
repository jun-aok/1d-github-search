import type { ApiError } from "@/lib/model/apiError";

export type ErrorMessageProps = {
  readonly error: ApiError;
  // 通信エラーの見出し（検索ページと詳細ページで違う）
  readonly failedTitle: string;
  readonly onRetry: () => void;
};

type Tone = { box: string; title: string; body: string; button: string; note: string };

// Tailwind はクラス名を文字列のまま探すので、色ごとのクラスは組み立てずに書き並べる
const rateLimitedTone: Tone = {
  box: "rounded-md border border-amber-300 bg-amber-50 p-4",
  title: "font-semibold text-amber-900",
  body: "mt-1 text-sm text-amber-800",
  button: "mt-3 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm",
  note: "mt-2 text-xs text-amber-700",
};

const failedTone: Tone = {
  box: "rounded-md border border-red-300 bg-red-50 p-4",
  title: "font-semibold text-red-900",
  body: "mt-1 text-sm text-red-800",
  button: "mt-3 rounded-md border border-red-400 bg-white px-3 py-1.5 text-sm",
  note: "mt-2 text-xs text-red-700",
};

// ApiError を案内文と再試行ボタンにして出す（docs/design.md 5・8 節）。
// クラス構成は mock/search.html・mock/detail.html のまま。
// button に type を付けないのもモックに合わせている。form の外なので送信はしない
export function ErrorMessage({ error, failedTitle, onRetry }: ErrorMessageProps) {
  // レート制限の文言はモックどおり固定（retryAfter は画面に出さない）
  const { tone, title, body } =
    error.code === "RATE_LIMITED"
      ? {
          tone: rateLimitedTone,
          title: "GitHub API の利用回数の上限に達しました",
          body: "しばらく待ってから再試行してください。",
        }
      : {
          tone: failedTone,
          title: failedTitle,
          body: "ネットワークの状態を確認して、もう一度お試しください。",
        };
  return (
    <section className="mt-6" role="alert">
      <div className={tone.box}>
        <p className={tone.title}>{title}</p>
        <p className={tone.body}>{body}</p>
        <button className={tone.button} onClick={onRetry}>
          再試行
        </button>
        {/* BFF に届かなかった失敗には問い合わせ番号が無い */}
        {error.requestId === undefined ? null : (
          <p className={tone.note}>
            問い合わせ番号: <span>{error.requestId}</span>
          </p>
        )}
        {/* 開発中はログを見ずに原因が分かるよう、詳細を出す。production では出さない */}
        {error.detail === undefined || process.env.NODE_ENV === "production" ? null : (
          <details className={tone.note}>
            <summary>詳細</summary>
            <pre className="mt-1 whitespace-pre-wrap break-all">{error.detail}</pre>
          </details>
        )}
      </div>
    </section>
  );
}
