import type { z } from "zod";
import { fail, ok, type ParseError, type Result } from "./result";

// zod の検証結果を Result<値, ParseError> に詰め替える。zod を使ってよい場所（lib/model/・lib/github/parse.ts）だけが使う（ZodError を外に出さないため）
export function safeParse<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Result<z.infer<S>, ParseError> {
  const r = schema.safeParse(input);
  if (r.success) return ok(r.data);
  return fail({
    issues: r.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
  });
}
