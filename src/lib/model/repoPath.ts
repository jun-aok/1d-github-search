import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const schema = z
  .object({ owner: z.string(), repo: z.string() })
  .transform((v) => ({ owner: v.owner, name: v.repo }));

export type RepoPath = DeepReadonly<z.infer<typeof schema>>;

export function parseRepoPath(input: unknown): Result<RepoPath, ParseError> {
  return safeParse(schema, input);
}
