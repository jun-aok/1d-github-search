// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv: production で GitHub を呼ぶのにトークンが無いときは失敗する", () => {
  it.each([
    ["未設定", {}],
    ["空文字", { GITHUB_TOKEN: "" }],
  ])("GITHUB_TOKEN が%s", (_label, token) => {
    const r = parseEnv({ NODE_ENV: "production", GITHUB_CLIENT: "http", ...token });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.issues).toHaveLength(1);
    const issue = r.error.issues[0];
    expect(issue?.path).toBe("GITHUB_TOKEN");
    // 何をすればよいか分かる文にする（docs/design.md 6 節）
    expect(issue?.message).toContain("GITHUB_TOKEN が未設定です");
    expect(issue?.message).toContain(".env.example");
    expect(issue?.message).toContain("GITHUB_CLIENT=fake");
  });
});
