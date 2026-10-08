import { z } from "zod";
import { ok, type ParseError, type Result } from "./model/result";
import { safeParse } from "./model/zodResult";

// 環境変数の検証（docs/design.md 6 節）。next.config.ts から import され、ビルド時・起動時に評価される
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    GITHUB_CLIENT: z.enum(["http", "fake"]).default("http"),
    GITHUB_TOKEN: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      !(v.NODE_ENV === "production" && v.GITHUB_CLIENT === "http" && v.GITHUB_TOKEN === undefined),
    {
      message:
        "GITHUB_TOKEN が未設定です。production では GitHub API の認証トークンが必須です。" +
        "環境変数 GITHUB_TOKEN に Personal Access Token を設定してください（.env.example 参照）。" +
        "GitHub を呼ばないテスト用構成なら GITHUB_CLIENT=fake を設定してください。",
      path: ["GITHUB_TOKEN"],
    },
  );

export type Env = Readonly<{
  nodeEnv: "development" | "test" | "production";
  githubClient: "http" | "fake";
  githubToken: string | undefined;
}>;

export function parseEnv(
  source: Readonly<Record<string, string | undefined>>,
): Result<Env, ParseError> {
  const r = safeParse(schema, {
    NODE_ENV: source.NODE_ENV === "" ? undefined : source.NODE_ENV,
    GITHUB_CLIENT: source.GITHUB_CLIENT === "" ? undefined : source.GITHUB_CLIENT,
    GITHUB_TOKEN: source.GITHUB_TOKEN === "" ? undefined : source.GITHUB_TOKEN,
  });
  if (!r.ok) return r;
  return ok({
    nodeEnv: r.value.NODE_ENV,
    githubClient: r.value.GITHUB_CLIENT,
    githubToken: r.value.GITHUB_TOKEN,
  });
}

// ビルド・起動を止めるために、モジュールの最上位の env だけが例外を投げる（docs/design.md 6 節）
function envOrThrow(source: Readonly<Record<string, string | undefined>>): Env {
  const r = parseEnv(source);
  if (r.ok) return r.value;
  const lines = r.error.issues.map((i) => `- ${i.path}: ${i.message}`);
  throw new Error(`環境変数が不正です:\n${lines.join("\n")}`);
}

export const env: Env = envOrThrow(process.env);
