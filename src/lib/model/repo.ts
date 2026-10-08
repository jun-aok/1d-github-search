import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import { fail, type ParseError, type Result } from "./result";
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

export type RepoDetail = DeepReadonly<{
  id: number;
  fullName: string;
  owner: { login: string; avatarUrl: string };
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  watchers: number;
  forks: number;
  openIssues: number;
}>;

export function parseRepoSummary(input: unknown): Result<RepoSummary, ParseError> {
  return safeParse(summarySchema, input);
}

export function parseRepoDetail(input: unknown): Result<RepoDetail, ParseError> {
  void input;
  return fail({ issues: [] });
}
