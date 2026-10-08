import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ok } from "@/lib/model/result";
import type { SearchCondition } from "@/lib/model/searchCondition";
import { bffHandlers } from "@/mocks/bffHandlers";
import { SearchPage } from "./SearchPage";
import type { SearchUrl } from "./useSearchUrl";

const server = setupServer(...bffHandlers);
const requests: URL[] = [];

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", ({ request }) => {
    requests.push(new URL(request.url));
  });
});
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => {
  server.close();
});

const guideText = "キーワードを入力して GitHub のリポジトリを検索します。";

// useSearchUrl の偽物。URL の代わりにメモリ上で検索条件を読み書きする（docs/design.md 5 節）
function MemoryUrlSearchPage({
  initial,
  navigations,
}: {
  initial: SearchUrl["condition"];
  navigations: SearchCondition[];
}) {
  const [condition, setCondition] = useState(initial);
  const url: SearchUrl = {
    condition,
    navigate: (next) => {
      navigations.push(next);
      setCondition(ok(next));
    },
  };
  return <SearchPage url={url} />;
}

function renderPage(initial: SearchUrl["condition"]) {
  const navigations: SearchCondition[] = [];
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryUrlSearchPage initial={initial} navigations={navigations} />
    </QueryClientProvider>,
  );
  return { ...view, navigations };
}

describe("SearchPage", () => {
  it("検索条件が無ければ初期の案内を出し、検索しない", () => {
    renderPage(null);
    expect(screen.getByText(guideText)).toBeInTheDocument();
    expect(screen.getByLabelText("リポジトリ名")).toHaveValue("");
    expect(screen.queryByRole("list")).toBeNull();
    expect(requests).toHaveLength(0);
  });
});
