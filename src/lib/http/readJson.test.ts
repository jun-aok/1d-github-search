import { describe, expect, it } from "vitest";
import { readJson } from "./readJson";

describe("readJson", () => {
  it("本文の JSON を unknown として返す", async () => {
    const result = await readJson(Response.json({ a: 1 }));

    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("JSON でない本文は失敗として返し、例外を投げない", async () => {
    const result = await readJson(new Response("<html>Bad Gateway</html>"));

    expect(result.ok).toBe(false);
  });
});
