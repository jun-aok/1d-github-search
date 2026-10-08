import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/model/result";
import type { SearchCondition } from "@/lib/model/searchCondition";
import { BFF_ORIGIN, bffHandlers, searchReactResult } from "@/mocks/bffHandlers";
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
  vi.restoreAllMocks();
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

// release() を呼ぶまで、次の検索の応答を返さない（取得中の表示を確かめる）
function holdNextSearch() {
  const gate = Promise.withResolvers<undefined>();
  server.use(
    http.get(
      `${BFF_ORIGIN}/api/search`,
      async () => {
        await gate.promise;
        return HttpResponse.json(searchReactResult);
      },
      { once: true },
    ),
  );
  return {
    release: () => {
      gate.resolve(undefined);
    },
  };
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

  it("同じキーワードで検索し直すと、URL は変えずに取り直し、その間は前の結果を薄く残す", async () => {
    const user = userEvent.setup();
    const { navigations } = renderPage(ok(aSearchCondition("react")));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");

    const hold = holdNextSearch();
    await user.click(screen.getByRole("button", { name: "検索" }));
    await waitFor(() => {
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    });
    expect(screen.getByRole("list")).toHaveClass("opacity-50");
    expect(screen.getByRole("button", { name: "検索" })).toBeDisabled();
    expect(screen.queryByText("検索しています")).toBeNull();
    expect(requests).toHaveLength(2);
    expect(navigations).toEqual([]);

    hold.release();
    await waitFor(() => {
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "false");
    });
    expect(screen.getByRole("button", { name: "検索" })).toBeEnabled();
  });

  it("別のキーワードで検索すると 1 ページ目の URL に移る。覚えている結果があっても取り直す", async () => {
    const user = userEvent.setup();
    const { navigations } = renderPage(ok(aSearchCondition("react", 3)));
    await screen.findByText("7,297,834 件中 41〜60 件を表示");
    const searchBox = screen.getByLabelText("リポジトリ名");

    await user.clear(searchBox);
    await user.type(searchBox, "vue{Enter}");
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    expect(navigations).toEqual([aSearchCondition("vue", 1)]);

    await user.clear(searchBox);
    await user.type(searchBox, "react{Enter}");
    await waitFor(() => {
      expect(requests.map((u) => u.search)).toEqual(["?q=react&page=3", "?q=vue", "?q=react"]);
    });
    expect(navigations).toEqual([aSearchCondition("vue", 1), aSearchCondition("react", 1)]);

    // 一度表示した条件（vue）に戻るときも、検索ボタンなら取り直す
    await user.clear(searchBox);
    await user.type(searchBox, "vue{Enter}");
    await waitFor(() => {
      expect(requests).toHaveLength(4);
    });
  });

  it("「次へ」で次のページの URL に移り、新しいページの結果が表示されたらページの先頭へスクロールする", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { navigations } = renderPage(ok(aSearchCondition("react")));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");

    const hold = holdNextSearch();
    await user.click(screen.getByRole("button", { name: "次へ →" }));
    expect(navigations).toEqual([aSearchCondition("react", 2)]);
    await waitFor(() => {
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    });
    expect(scrollTo).not.toHaveBeenCalled();

    hold.release();
    await screen.findByText("7,297,834 件中 21〜40 件を表示");
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  it("別のキーワードを取得中に「次へ」を押すと、表示中の結果のキーワードの次のページへ移る", async () => {
    const user = userEvent.setup();
    const { navigations } = renderPage(ok(aSearchCondition("react")));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");

    const hold = holdNextSearch();
    const searchBox = screen.getByLabelText("リポジトリ名");
    await user.clear(searchBox);
    await user.type(searchBox, "vue{Enter}");
    await waitFor(() => {
      expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    });

    await user.click(screen.getByRole("button", { name: "次へ →" }));
    expect(navigations).toEqual([aSearchCondition("vue", 1), aSearchCondition("react", 2)]);
    hold.release();
  });

  it("前の結果がエラーでも、次の取得中はそれを薄くして残し、取得できたら結果に替える", async () => {
    const user = userEvent.setup();
    renderPage(ok(aSearchCondition("__error__")));
    await screen.findByRole("alert");

    const hold = holdNextSearch();
    const searchBox = screen.getByLabelText("リポジトリ名");
    await user.clear(searchBox);
    await user.type(searchBox, "react{Enter}");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "検索" })).toBeDisabled();
    });
    const faded = screen.getByRole("alert").parentElement;
    expect(faded).toHaveClass("opacity-50");
    expect(faded).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("検索しています")).toBeNull();

    hold.release();
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("結果 → 初期画面 → 別のキーワード、と進んだときは、前の結果を出さずスケルトンを出す", async () => {
    const queryClient = new QueryClient();
    const at = (condition: SearchUrl["condition"]) => (
      <QueryClientProvider client={queryClient}>
        <SearchPage url={{ condition, navigate: vi.fn() }} />
      </QueryClientProvider>
    );
    const { rerender } = render(at(ok(aSearchCondition("react"))));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    rerender(at(null));
    expect(screen.getByText(guideText)).toBeInTheDocument();

    const hold = holdNextSearch();
    rerender(at(ok(aSearchCondition("vue"))));
    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(screen.getByText("検索しています")).toBeInTheDocument();
    expect(screen.queryByRole("list", { busy: true })).toBeNull();
    expect(screen.queryByText("7,297,834 件中 1〜20 件を表示")).toBeNull();

    hold.release();
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    expect(screen.queryByText("検索しています")).toBeNull();
  });

  it("URL が前の条件に戻ったとき（ブラウザバック）、成功した結果は覚えていて取り直さず、失敗した結果は取り直す", async () => {
    const queryClient = new QueryClient();
    const at = (condition: SearchCondition) => (
      <QueryClientProvider client={queryClient}>
        <SearchPage url={{ condition: ok(condition), navigate: vi.fn() }} />
      </QueryClientProvider>
    );
    const { rerender } = render(at(aSearchCondition("__error__")));
    await screen.findByRole("alert");
    rerender(at(aSearchCondition("react")));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    expect(requests).toHaveLength(2);

    rerender(at(aSearchCondition("__error__")));
    await waitFor(() => {
      expect(requests).toHaveLength(3);
    });
    await screen.findByRole("alert");

    rerender(at(aSearchCondition("react")));
    await screen.findByText("7,297,834 件中 1〜20 件を表示");
    expect(requests).toHaveLength(3);
  });
});
