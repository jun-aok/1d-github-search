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
