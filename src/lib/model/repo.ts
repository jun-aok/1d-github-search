import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import { fail, type ParseError, type Result } from "./result";
import { safeParse } from "./zodResult";

const summarySchema = z.object({
  id: z.number(),
  fullName: z.string(),
  owner: z.object({ login: z.string(), avatarUrl: z.string() }),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number(),
  url: z.string(),
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
