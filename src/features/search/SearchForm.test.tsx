import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aSearchCondition } from "@/test/builders";
import { SearchForm } from "./SearchForm";

function renderForm(props: Partial<Parameters<typeof SearchForm>[0]> = {}) {
  const onSearch = vi.fn();
  const view = render(<SearchForm query="" busy={false} onSearch={onSearch} {...props} />);
  return { ...view, onSearch };
}

const searchBox = () => screen.getByLabelText("リポジトリ名");
const searchButton = () => screen.getByRole("button", { name: "検索" });

describe("SearchForm", () => {
  it("入力が空・空白のみのときは検索ボタンが無効で、文字を入れると有効になる", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(searchButton()).toBeDisabled();

    await user.type(searchBox(), " 　 ");
    expect(searchButton()).toBeDisabled();

    await user.type(searchBox(), "react");
    expect(searchButton()).toBeEnabled();
  });

  it("ボタンでも Enter でも、前後の空白を除いたキーワードの 1 ページ目で onSearch を呼ぶ", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderForm();
    await user.type(searchBox(), "  react ");
    await user.click(searchButton());
    await user.type(searchBox(), "{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenNthCalledWith(1, aSearchCondition("react", 1));
    expect(onSearch).toHaveBeenNthCalledWith(2, aSearchCondition("react", 1));
  });

  it("読み込み中は検索ボタンが無効で、Enter を押しても onSearch を呼ばない", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderForm({ query: "react", busy: true });
    expect(searchButton()).toBeDisabled();
    await user.type(searchBox(), "{Enter}");
    expect(onSearch).not.toHaveBeenCalled();
  });
});
