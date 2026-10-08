import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ok } from "@/lib/model/result";
import type { SearchCondition } from "@/lib/model/searchCondition";
import { bffHandlers } from "@/mocks/bffHandlers";
import { aSearchCondition } from "@/test/builders";
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

// 子要素（<span> など）をまたいだ文言で段落を探す
function paragraphWithText(text: string) {
  return screen.findByText(
    (_, element) => element?.tagName === "P" && element.textContent === text,
  );
}

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

  it("検索条件があれば、スケルトンを出してから一覧・件数・ページネーションを出す", async () => {
    renderPage(ok(aSearchCondition("react", 2)));
    expect(screen.getByText("検索しています")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "検索" })).toBeDisabled();

    expect(await screen.findByText("7,297,834 件中 21〜40 件を表示")).toBeInTheDocument();
    expect(screen.queryByText("検索しています")).toBeNull();
    expect(within(screen.getByRole("list")).getAllByRole("link")).toHaveLength(20);
    expect(screen.getByRole("navigation", { name: "ページネーション" })).toHaveTextContent(
      "2 / 50 ページ",
    );
    expect(screen.getByLabelText("リポジトリ名")).toHaveValue("react");
    expect(screen.getByRole("button", { name: "検索" })).toBeEnabled();
    expect(requests.map((u) => u.search)).toEqual(["?q=react&page=2"]);
  });

  it("0 件なら一致なしの案内を出し、一覧とページネーションは出さない", async () => {
    renderPage(ok(aSearchCondition("__empty__")));
    expect(
      await paragraphWithText("「__empty__」に一致するリポジトリは見つかりませんでした。"),
    ).toBeInTheDocument();
    expect(screen.getByText("別のキーワードで試してください。")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("総ページ数を超えるページは、件数だけ・結果なしの案内・ページネーションを出す", async () => {
    renderPage(ok(aSearchCondition("__few__", 3)));
    expect(await screen.findByText("このページには結果がありません。")).toBeInTheDocument();
    expect(screen.getByText("2 件")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("navigation", { name: "ページネーション" })).toHaveTextContent(
      "3 / 1 ページ",
    );
  });

  it("エラーなら案内と再試行ボタンを出し、再試行でもう一度取得する", async () => {
    const user = userEvent.setup();
    renderPage(ok(aSearchCondition("__error__")));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("検索に失敗しました");
    expect(requests).toHaveLength(1);

    await user.click(within(alert).getByRole("button", { name: "再試行" }));
    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("検索に失敗しました");
  });
});
