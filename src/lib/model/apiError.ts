import { z } from "zod";
import type { DeepReadonly } from "./readonly";
import type { ParseError, Result } from "./result";
import { safeParse } from "./zodResult";

const errorSchema = z.object({
  code: z.enum(["BAD_REQUEST", "NOT_FOUND", "RATE_LIMITED", "UPSTREAM_ERROR", "INTERNAL_ERROR"]),
  message: z.string(),
});

const responseSchema = z.object({ error: errorSchema });

export type ApiError = DeepReadonly<z.infer<typeof errorSchema>>;

export type ErrorResponse = DeepReadonly<z.infer<typeof responseSchema>>;

export function parseErrorResponse(input: unknown): Result<ErrorResponse, ParseError> {
  return safeParse(responseSchema, input);
}
