import { parseRepoPath } from "./repoPath";

describe("parseRepoPath", () => {
  it("owner と repo を RepoPath（owner, name）にする", () => {
    expect(parseRepoPath({ owner: "facebook", repo: "react" })).toEqual({
      ok: true,
      value: { owner: "facebook", name: "react" },
    });
  });
});
