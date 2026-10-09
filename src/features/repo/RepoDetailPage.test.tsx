import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BFF_ORIGIN,
  bffError,
  bffHandlers,
  repoReactReactDetail,
  TEST_REQUEST_ID,
} from "@/mocks/bffHandlers";
import { RepoDetailPage, type RepoParams } from "./RepoDetailPage";

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

// 次の詳細の要求を、release を呼ぶまで返さない。取り直しの間の表示を確かめるため
function holdNextRepo(respond: () => Response) {
  const gate = Promise.withResolvers<undefined>();
  server.use(
    http.get(
      `${BFF_ORIGIN}/api/repos/:owner/:repo`,
      async () => {
        await gate.promise;
        return respond();
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

function renderPage(params: RepoParams, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoDetailPage params={params} />
    </QueryClientProvider>,
  );
}

describe("RepoDetailPage", () => {
  it("スケルトンを出してから、取得した詳細を出す", async () => {
    renderPage({ owner: "react", repo: "react" });
    expect(screen.getByText("読み込んでいます")).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { level: 1, name: "react/react" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("読み込んでいます")).toBeNull();
    expect(requests.map((u) => u.pathname)).toEqual(["/api/repos/react/react"]);
  });

  it("BFF が NOT_FOUND を返したら、見つからない案内と検索ページへのリンクを出す", async () => {
    renderPage({ owner: "__not_found__", repo: "x" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "リポジトリが見つかりません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("削除されたか、名前が変更された可能性があります。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "検索ページへ戻る" })).toHaveAttribute("href", "/");
  });

  it("パスが RepoPath にならない（.. など）ときは、BFF に問い合わせず見つからない案内を出す", () => {
    renderPage({ owner: "..", repo: "x" });
    expect(
      screen.getByRole("heading", { level: 1, name: "リポジトリが見つかりません" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("読み込んでいます")).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("パスの値は符号化されたまま届くので、復号して RepoPath にならない（%20 = 空白）なら問い合わせない", () => {
    renderPage({ owner: "a%20b", repo: "x" });
    expect(
      screen.getByRole("heading", { level: 1, name: "リポジトリが見つかりません" }),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("レート制限なら上限到達の案内・再試行ボタン・問い合わせ番号を出す", async () => {
    renderPage({ owner: "__rate_limited__", repo: "x" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("GitHub API の利用回数の上限に達しました");
    expect(alert).toHaveTextContent(`問い合わせ番号: ${TEST_REQUEST_ID}`);
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("その他の失敗なら、詳細の取得に失敗した案内・再試行ボタン・問い合わせ番号を出す", async () => {
    renderPage({ owner: "__error__", repo: "x" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("リポジトリ情報の取得に失敗しました");
    expect(alert).toHaveTextContent(`問い合わせ番号: ${TEST_REQUEST_ID}`);
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("再試行ボタンでもう一度取得し、一時的な失敗なら詳細の表示に回復する", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BFF_ORIGIN}/api/repos/:owner/:repo`, () => bffError("UPSTREAM_ERROR", 502), {
        once: true,
      }),
    );
    renderPage({ owner: "react", repo: "react" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "リポジトリ情報の取得に失敗しました",
    );

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "react/react" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("取得できた詳細は覚えておき、もう一度表示するときは取得し直さない", async () => {
    const queryClient = new QueryClient();
    const first = renderPage({ owner: "react", repo: "react" }, queryClient);
    await screen.findByRole("heading", { level: 1, name: "react/react" });
    first.unmount();

    renderPage({ owner: "react", repo: "react" }, queryClient);
    expect(screen.getByRole("heading", { level: 1, name: "react/react" })).toBeInTheDocument();
    // 取り直しが起きないことは待たないと確かめられないので、少し（50 ミリ秒）待ってから数える
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toHaveLength(1);
  });

  it("成功した結果が古くなって（60 秒過ぎて）から開き直した直後は、取り直す間その詳細を薄くして残す", async () => {
    const queryClient = new QueryClient();
    const heading = { level: 1, name: "react/react" } as const;
    const first = renderPage({ owner: "react", repo: "react" }, queryClient);
    await screen.findByRole("heading", heading);
    first.unmount();

    // 時計だけを進める（MSW の待ちは本物のタイマーのまま）
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 成功を覚える 60 秒（useRepo の SUCCESS_STALE_TIME_MS）を過ぎた時刻にする
      vi.setSystemTime(Date.now() + 61_000);
      const hold = holdNextRepo(() => HttpResponse.json(repoReactReactDetail));
      renderPage({ owner: "react", repo: "react" }, queryClient);
      const faded = screen.getByRole("heading", heading).closest("section")?.parentElement;
      expect(faded).toHaveClass("opacity-50");
      expect(faded).toHaveAttribute("aria-busy", "true");

      hold.release();
      await waitFor(() => {
        expect(document.querySelector("[aria-busy]")).toBeNull();
      });
      expect(screen.getByRole("heading", heading)).toBeInTheDocument();
      expect(requests).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("失敗は覚えておかず、もう一度表示するときは必ず取得し直す", async () => {
    const queryClient = new QueryClient();
    const first = renderPage({ owner: "__error__", repo: "x" }, queryClient);
    await screen.findByRole("alert");
    first.unmount();

    renderPage({ owner: "__error__", repo: "x" }, queryClient);
    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
  });

  describe("取り直しの間は、前の失敗の表示を薄くして残す（検索ページと同じ）", () => {
    it("再試行ボタンを押した直後", async () => {
      const user = userEvent.setup();
      renderPage({ owner: "__error__", repo: "x" });
      await screen.findByRole("alert");

      const hold = holdNextRepo(() => HttpResponse.json(repoReactReactDetail));
      await user.click(screen.getByRole("button", { name: "再試行" }));
      await waitFor(() => {
        expect(screen.getByRole("alert").parentElement).toHaveAttribute("aria-busy", "true");
      });
      expect(screen.getByRole("alert").parentElement).toHaveClass("opacity-50");
      expect(screen.queryByText("読み込んでいます")).toBeNull();

      hold.release();
      expect(
        await screen.findByRole("heading", { level: 1, name: "react/react" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(document.querySelector("[aria-busy]")).toBeNull();
    });

    it("失敗したリポジトリをもう一度開いた直後", async () => {
      const queryClient = new QueryClient();
      const first = renderPage({ owner: "__error__", repo: "x" }, queryClient);
      await screen.findByRole("alert");
      first.unmount();

      const hold = holdNextRepo(() => bffError("UPSTREAM_ERROR", 502));
      renderPage({ owner: "__error__", repo: "x" }, queryClient);
      const faded = screen.getByRole("alert").parentElement;
      expect(faded).toHaveClass("opacity-50");
      expect(faded).toHaveAttribute("aria-busy", "true");

      hold.release();
      await waitFor(() => {
        expect(screen.getByRole("alert").parentElement).not.toHaveAttribute("aria-busy");
      });
      expect(requests).toHaveLength(2);
    });

    it("見つからなかったリポジトリをもう一度開いた直後", async () => {
      const queryClient = new QueryClient();
      const notFound = { level: 1, name: "リポジトリが見つかりません" } as const;
      const first = renderPage({ owner: "__not_found__", repo: "x" }, queryClient);
      await screen.findByRole("heading", notFound);
      first.unmount();

      const hold = holdNextRepo(() => bffError("NOT_FOUND", 404));
      renderPage({ owner: "__not_found__", repo: "x" }, queryClient);
      const faded = screen.getByRole("heading", notFound).closest("section")?.parentElement;
      expect(faded).toHaveClass("opacity-50");
      expect(faded).toHaveAttribute("aria-busy", "true");

      hold.release();
      await waitFor(() => {
        expect(document.querySelector("[aria-busy]")).toBeNull();
      });
      expect(screen.getByRole("heading", notFound)).toBeInTheDocument();
    });
  });
});
