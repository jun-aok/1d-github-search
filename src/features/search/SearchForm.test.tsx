import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
});
