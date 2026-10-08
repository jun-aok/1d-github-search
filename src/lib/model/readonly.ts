// 入れ子の配列・オブジェクトまで書き換え不可にする（docs/design.md 3 節）
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
