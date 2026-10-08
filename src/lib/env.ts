import { z } from "zod";

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

export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const r = schema.safeParse({
    NODE_ENV: source.NODE_ENV === "" ? undefined : source.NODE_ENV,
    GITHUB_CLIENT: source.GITHUB_CLIENT === "" ? undefined : source.GITHUB_CLIENT,
    GITHUB_TOKEN: source.GITHUB_TOKEN === "" ? undefined : source.GITHUB_TOKEN,
  });
  if (!r.success) {
    throw new Error(`環境変数が不正です:\n${z.prettifyError(r.error)}`);
  }
  return {
    nodeEnv: r.data.NODE_ENV,
    githubClient: r.data.GITHUB_CLIENT,
    githubToken: r.data.GITHUB_TOKEN,
  };
}

export const env: Env = parseEnv(process.env);
