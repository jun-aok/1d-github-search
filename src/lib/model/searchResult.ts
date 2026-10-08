import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import { parseRepoSummary, type RepoSummary } from "./repo";
import { fail, ok, type ParseError, type Result } from "./result";
import { safeParse } from "./zodResult";

// items の中身は RepoSummary のスキーマを export せず、parseRepoSummary に任せる
const schema = z.object({
  totalCount: z.number().int().min(0),
  items: z.array(z.unknown()).max(20),
});

export type SearchResult = DeepReadonly<{ totalCount: number; items: RepoSummary[] }>;

export function parseSearchResult(input: unknown): Result<SearchResult, ParseError> {
  const outline = safeParse(schema, input);
  if (!outline.ok) return outline;

  const items: RepoSummary[] = [];
  const issues: ParseError["issues"] = [];
  outline.value.items.forEach((item, index) => {
    const r = parseRepoSummary(item);
    if (r.ok) {
      items.push(r.value);
      return;
    }
    for (const issue of r.error.issues) {
      const at = `items.${String(index)}`;
      const path = issue.path === "" ? at : `${at}.${issue.path}`;
      issues.push({ path, message: issue.message });
    }
  });
  if (issues.length > 0) return fail({ issues });

  return ok({ totalCount: outline.value.totalCount, items });
}
