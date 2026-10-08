import { focusManager, onlineManager, useQuery } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Providers } from "./providers";

// 取得のたびに回数を数え、表示する。staleTime 0（失敗した検索と同じ。docs/design.md 5 節）なので、既定ならフォーカス・再接続で取り直す
function CountingQuery({ fetchCount }: { readonly fetchCount: () => Promise<number> }) {
  const query = useQuery({ queryKey: ["counting"], queryFn: fetchCount, staleTime: 0 });
  return <p>{query.data === undefined ? "取得中" : `取得 ${String(query.data)} 回`}</p>;
}

async function renderCounting() {
  const calls = { count: 0 };
  const fetchCount = () => {
    calls.count += 1;
    return Promise.resolve(calls.count);
  };
  render(
    <Providers>
      <CountingQuery fetchCount={fetchCount} />
    </Providers>,
  );
  await screen.findByText("取得 1 回");
  return calls;
}

// 保留中の取得が始まる・終わるのを待つ
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe("Providers の QueryClient", () => {
  it("ウィンドウにフォーカスが戻っても取り直さない（レート制限中に GitHub を叩き直さない）", async () => {
    const calls = await renderCounting();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await settle();
    expect(calls.count).toBe(1);
  });

  it("ネットワークに再接続しても取り直さない", async () => {
    const calls = await renderCounting();
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await settle();
    expect(calls.count).toBe(1);
  });
});
