import { describe, expect, it } from "vitest";
import { aRepoPath, aSearchCondition } from "@/test/builders";
import { createFakeGitHubClient } from "./fakeGitHubClient";

describe("FakeGitHubClient.search", () => {
  it("通常のキーワードは 20 件・総数 7,297,834 件を返す（どのページでも同じ 20 件）", async () => {
    const github = createFakeGitHubClient();

    const page1 = await github.search(aSearchCondition("react"));
    const page5 = await github.search(aSearchCondition("anything", 5));

    expect(page1.ok && page1.value.totalCount).toBe(7297834);
    expect(page1.ok && page1.value.items).toHaveLength(20);
    expect(page5).toEqual(await github.search(aSearchCondition("react")));
  });

  it("__few__ は 2 件（1 ページ）で、2 ページ目以降は件数だけ残して items が空", async () => {
    const github = createFakeGitHubClient();

    const page1 = await github.search(aSearchCondition("__few__"));
    const page3 = await github.search(aSearchCondition("__few__", 3));

    expect(page1.ok && [page1.value.totalCount, page1.value.items.length]).toEqual([2, 2]);
    expect(page3.ok && [page3.value.totalCount, page3.value.items.length]).toEqual([2, 0]);
  });

  it("__empty__ は 0 件", async () => {
    const result = await createFakeGitHubClient().search(aSearchCondition("__empty__"));

    expect(result).toEqual({ ok: true, value: { totalCount: 0, items: [] } });
  });

  it("__rate_limited__ はレート制限、__error__ は GitHub 側の障害", async () => {
    const github = createFakeGitHubClient();

    expect(await github.search(aSearchCondition("__rate_limited__"))).toEqual({
      ok: false,
      error: { kind: "rate_limited", retryAfter: 60 },
    });
    expect(await github.search(aSearchCondition("__error__"))).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "http" },
    });
  });
});

describe("FakeGitHubClient.getRepo", () => {
  it("通常の owner は fixture の詳細を返す", async () => {
    const result = await createFakeGitHubClient().getRepo(aRepoPath("react", "react"));

    expect(result).toMatchObject({
      ok: true,
      value: { fullName: "react/react", stars: 250916, watchers: 6603 },
    });
  });

  it("owner が __not_found__ / __rate_limited__ / __error__ のときは、それぞれの失敗を返す", async () => {
    const github = createFakeGitHubClient();

    expect(await github.getRepo(aRepoPath("__not_found__", "x"))).toEqual({
      ok: false,
      error: { kind: "not_found" },
    });
    expect(await github.getRepo(aRepoPath("__rate_limited__", "x"))).toEqual({
      ok: false,
      error: { kind: "rate_limited", retryAfter: 60 },
    });
    expect(await github.getRepo(aRepoPath("__error__", "x"))).toMatchObject({
      ok: false,
      error: { kind: "upstream", reason: "http" },
    });
  });
});
