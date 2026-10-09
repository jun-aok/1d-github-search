// 失敗し得る処理は例外を投げずにこれを返し、失敗を戻り値の型に出す（docs/design.md 3 節）
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// path は失敗した項目の位置を . でつないだもの（例 items.0.stars）。空文字は値全体
export type ParseError = { issues: { path: string; message: string }[] };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
