import { avatarUrl, formatNumber } from "./format";

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1000, "1,000"],
    [243000, "243,000"],
    [1234567, "1,234,567"],
  ])("%i は %s", (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
  });
});

describe("avatarUrl", () => {
  it("既存の ?v=4 を残してサイズ s を足す", () => {
    expect(avatarUrl("https://avatars.githubusercontent.com/u/69631?v=4", 80)).toBe(
      "https://avatars.githubusercontent.com/u/69631?v=4&s=80",
    );
  });

  it("クエリが無い URL にもサイズを付ける", () => {
    expect(avatarUrl("https://avatars.githubusercontent.com/u/69631", 128)).toBe(
      "https://avatars.githubusercontent.com/u/69631?s=128",
    );
  });

  it("すでに s がある URL では上書きし、重複させない", () => {
    expect(avatarUrl("https://avatars.githubusercontent.com/u/69631?v=4&s=400", 80)).toBe(
      "https://avatars.githubusercontent.com/u/69631?v=4&s=80",
    );
  });

  it("URL として読めない文字列はそのまま返す（例外を投げない）", () => {
    expect(avatarUrl("not a url", 80)).toBe("not a url");
  });
});
