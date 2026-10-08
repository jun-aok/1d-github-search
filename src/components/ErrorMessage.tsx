import type { ApiError } from "@/lib/model/apiError";

export type ErrorMessageProps = {
  readonly error: ApiError;
  // 通信エラーの見出し（検索ページと詳細ページで違う）
  readonly failedTitle: string;
  readonly onRetry: () => void;
};

// エラー表示と再試行（docs/design.md 5・8 節）。クラス構成は mock/search.html・mock/detail.html のまま。
// Tailwind はクラス名を文字列のまま探すので、色ごとのクラスは組み立てずに書き並べる
const rateLimitedTone = {
  box: "rounded-md border border-amber-300 bg-amber-50 p-4",
  title: "font-semibold text-amber-900",
  body: "mt-1 text-sm text-amber-800",
  button: "mt-3 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm",
  note: "mt-2 text-xs text-amber-700",
};

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const tone = rateLimitedTone;
  return (
    <section className="mt-6" role="alert">
      <div className={tone.box}>
        <p className={tone.title}>GitHub API の利用回数の上限に達しました</p>
        <p className={tone.body}>しばらく待ってから再試行してください。</p>
        <button className={tone.button} onClick={onRetry}>
          再試行
        </button>
        <p className={tone.note}>
          問い合わせ番号: <span>{error.requestId}</span>
        </p>
      </div>
    </section>
  );
}
