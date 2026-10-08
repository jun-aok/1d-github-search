import { parseSearchResult } from "./searchResult";

function repo(id: number) {
  return {
    id,
    fullName: `owner${id}/repo${id}`,
    owner: { login: `owner${id}`, avatarUrl: `https://avatars.githubusercontent.com/u/${id}?v=4` },
    description: id % 2 === 0 ? null : "説明",
    language: id % 3 === 0 ? null : "TypeScript",
    stars: id * 10,
    url: `https://github.com/owner${id}/repo${id}`,
  };
}

function repos(n: number) {
  return Array.from({ length: n }, (_, i) => repo(i + 1));
}

describe("parseSearchResult", () => {
  it("totalCount と items を受け取る", () => {
    const input = { totalCount: 2, items: repos(2) };
    expect(parseSearchResult(input)).toEqual({ ok: true, value: input });
  });
});
