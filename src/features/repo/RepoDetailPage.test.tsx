import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { bffHandlers } from "@/mocks/bffHandlers";
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
});
