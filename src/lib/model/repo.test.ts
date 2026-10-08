import { parseRepoSummary } from "./repo";

const summary = {
  id: 10270250,
  fullName: "facebook/react",
  owner: { login: "facebook", avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4" },
  description: "The library for web and native user interfaces.",
  language: "JavaScript",
  stars: 243000,
  url: "https://github.com/facebook/react",
};

describe("parseRepoSummary", () => {
  it("4 節の JSON の形をそのまま受け取る", () => {
    expect(parseRepoSummary(summary)).toEqual({ ok: true, value: summary });
  });
});
