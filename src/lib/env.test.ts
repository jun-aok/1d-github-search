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

describe("parseEnv: トークンが要らない構成は通る", () => {
  it("production でも GITHUB_CLIENT=fake ならトークンは要らない（E2E・CI のビルド）", () => {
    expect(parseEnv({ NODE_ENV: "production", GITHUB_CLIENT: "fake" })).toEqual({
      ok: true,
      value: { nodeEnv: "production", githubClient: "fake", githubToken: undefined },
    });
  });

  it("production + http でトークンがあれば通る", () => {
    expect(parseEnv({ NODE_ENV: "production", GITHUB_CLIENT: "http", GITHUB_TOKEN: "t" })).toEqual({
      ok: true,
      value: { nodeEnv: "production", githubClient: "http", githubToken: "t" },
    });
  });

  it.each(["development", "test"])("%s では http でもトークンは要らない", (nodeEnv) => {
    expect(parseEnv({ NODE_ENV: nodeEnv, GITHUB_CLIENT: "http" })).toEqual({
      ok: true,
      value: { nodeEnv, githubClient: "http", githubToken: undefined },
    });
  });

  it("未設定・空文字は既定値（development、http）にする", () => {
    expect(parseEnv({})).toEqual({
      ok: true,
      value: { nodeEnv: "development", githubClient: "http", githubToken: undefined },
    });
    expect(parseEnv({ NODE_ENV: "", GITHUB_CLIENT: "", GITHUB_TOKEN: "" })).toEqual({
      ok: true,
      value: { nodeEnv: "development", githubClient: "http", githubToken: undefined },
    });
  });
});

describe("parseEnv: 値が不正なら失敗する", () => {
  it.each([
    ["NODE_ENV", { NODE_ENV: "staging" }],
    ["GITHUB_CLIENT", { GITHUB_CLIENT: "mock" }],
  ])("%s が想定外の値", (path, source) => {
    const r = parseEnv(source);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.issues.map((i) => i.path)).toEqual([path]);
  });
});
