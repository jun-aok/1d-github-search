import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const schema = z.object({
  query: z.string().trim().min(1).max(256),
  page: z.number().int().min(1).max(50),
});

export type SearchCondition = DeepReadonly<z.infer<typeof schema>>;

export function parseSearchCondition(input: unknown): Result<SearchCondition, ParseError> {
  return safeParse(schema, input);
}
