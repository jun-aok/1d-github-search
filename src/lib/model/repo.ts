import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const count = z.number().int().min(0);
const httpsUrl = z.url({ protocol: /^https$/ });

const summarySchema = z.object({
  id: count,
  fullName: z.string(),
  owner: z.object({ login: z.string(), avatarUrl: httpsUrl }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: count,
  url: httpsUrl,
});

export type RepoSummary = DeepReadonly<z.infer<typeof summarySchema>>;

const detailSchema = summarySchema.extend({
  watchers: count,
  forks: count,
  openIssues: count,
});

export type RepoDetail = DeepReadonly<z.infer<typeof detailSchema>>;

export function parseRepoSummary(input: unknown): Result<RepoSummary, ParseError> {
  return safeParse(summarySchema, input);
}

export function parseRepoDetail(input: unknown): Result<RepoDetail, ParseError> {
  return safeParse(detailSchema, input);
}
