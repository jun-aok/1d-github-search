import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/model/result";
import { aSearchCondition } from "@/test/builders";
import { useSearchUrl } from "./useSearchUrl";

// jsdom には Next.js のルーターが無いので、useSearchParams だけを差し替える
const url = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => url.params }));

function renderAt(search: string) {
  url.params = new URLSearchParams(search);
  return renderHook(() => useSearchUrl());
}

describe("useSearchUrl", () => {
  it("URL の q と page を検索条件にする。q も page も無ければ null", () => {
    expect(renderAt("?q=react&page=2").result.current.condition).toEqual(
      ok(aSearchCondition("react", 2)),
    );
    expect(renderAt("?q=react").result.current.condition).toEqual(ok(aSearchCondition("react")));
    expect(renderAt("").result.current.condition).toBeNull();
  });
});
