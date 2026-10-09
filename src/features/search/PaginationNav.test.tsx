import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pagination } from "@/lib/model/pagination";
import { aSearchCondition } from "@/test/builders";
import { PaginationNav } from "./PaginationNav";

function renderNav(page: number, totalCount: number) {
  const onMove = vi.fn();
  render(
    <PaginationNav
      pagination={pagination(aSearchCondition("react", page), totalCount)}
      onMove={onMove}
    />,
  );
  const nav = screen.getByRole("navigation", { name: "ページネーション" });
  return { nav, onMove };
}

const previousButton = () => screen.getByRole("button", { name: "← 前へ" });
const nextButton = () => screen.getByRole("button", { name: "次へ →" });

describe("PaginationNav", () => {
  it("1 ページ目は「前へ」が無効、「次へ」が有効で、現在 / 総ページ数を表示する。「次へ」で次のページへ", async () => {
    const user = userEvent.setup();
    // GitHub は先頭 1,000 件までしか返さないので、総ページ数は 50 で頭打ちになる
    const { nav, onMove } = renderNav(1, 7297834);
    expect(nav).toHaveTextContent("1 / 50 ページ");
    expect(previousButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();
    await user.click(nextButton());
    expect(onMove).toHaveBeenCalledWith(2);
  });

  it("総ページ数を超えるページでは「次へ」が無効で、「前へ」は最終ページへ移る", async () => {
    const user = userEvent.setup();
    const { nav, onMove } = renderNav(3, 2);
    expect(nav).toHaveTextContent("3 / 1 ページ");
    expect(nextButton()).toBeDisabled();
    await user.click(previousButton());
    expect(onMove).toHaveBeenCalledWith(1);
  });
});
