import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/model/result";
import { aSearchCondition } from "@/test/builders";
import { useSearchUrl } from "./useSearchUrl";

// jsdom には Next.js のルーターが無いので、useSearchParams だけを差し替える
const url = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => url.params }));

function renderAt(search: string) {
  window.history.replaceState(null, "", `/${search}`);
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

  it("URL のパラメータが不正なら失敗を返し、アドレスバーを / に直す", () => {
    const { result } = renderAt("?q=react&page=51");
    expect(result.current.condition?.ok).toBe(false);
    expect(`${window.location.pathname}${window.location.search}`).toBe("/");
  });

  it("URL が正しければアドレスバーはそのまま", () => {
    renderAt("?q=react&page=2");
    expect(`${window.location.pathname}${window.location.search}`).toBe("/?q=react&page=2");
  });

  it("navigate は履歴を 1 つ積んで URL を書き換える。1 ページ目は page を付けない", () => {
    const { result } = renderAt("");
    const before = window.history.length;
    result.current.navigate(aSearchCondition("next.js 日本語"));
    expect(window.history.length).toBe(before + 1);
    expect(new URLSearchParams(window.location.search).get("q")).toBe("next.js 日本語");
    expect(new URLSearchParams(window.location.search).has("page")).toBe(false);

    result.current.navigate(aSearchCondition("react", 3));
    expect(`${window.location.pathname}${window.location.search}`).toBe("/?q=react&page=3");
  });
});
