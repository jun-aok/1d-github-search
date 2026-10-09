import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

// URL の一部として安全でないもの: 空、. と ..、/ と \、空白、制御文字。実在するかは GitHub に判断させる
const UNSAFE = /[/\\\s\u0000-\u001f\u007f]/;

function segment(maxLength: number) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((v) => v !== "." && v !== "..", { message: ". と .. は使えません" })
    .refine((v) => !UNSAFE.test(v), { message: "/ \ 空白 制御文字は使えません" });
}

// 長さの上限（文字）は GitHub の owner 39・リポジトリ名 100 に合わせる（docs/design.md 3 節）。
// 入力はルートの [owner]/[repo] の形で受け、モデルでは repo を name と呼ぶ
const schema = z
  .object({ owner: segment(39), repo: segment(100) })
  .transform((v) => ({ owner: v.owner, name: v.repo }));

export type RepoPath = DeepReadonly<z.infer<typeof schema>>;

export function parseRepoPath(input: unknown): Result<RepoPath, ParseError> {
  return safeParse(schema, input);
}

// ページの params は符号化されたまま届く（Route Handler には復号済みで届く。docs/design.md 4 節）。
// 1 回だけ復号してから同じ規則で確かめる。復号済みの値に使うと % を含む名前の意味が変わる
// 不正な % の並びは decodeURIComponent が URIError を投げるので、ここで受けて ParseError にする
const encodedSegment = z.string().transform((v, ctx) => {
  try {
    return decodeURIComponent(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "% の符号化が不正です", input: v });
    return z.NEVER;
  }
});

const encodedSchema = z.object({ owner: encodedSegment, repo: encodedSegment }).pipe(schema);

export function parseEncodedRepoPath(input: unknown): Result<RepoPath, ParseError> {
  return safeParse(encodedSchema, input);
}
