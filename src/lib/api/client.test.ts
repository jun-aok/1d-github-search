import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bffHandlers, searchReactResult } from "@/mocks/bffHandlers";
import { aSearchCondition } from "@/test/builders";
import { fetchSearch } from "./client";

const server = setupServer(...bffHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("fetchSearch", () => {
  it("BFF の成功応答を SearchResult にして返す", async () => {
    const result = await fetchSearch(aSearchCondition("react"));
    expect(result).toEqual({ ok: true, value: searchReactResult });
  });
});
