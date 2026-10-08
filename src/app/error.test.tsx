import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("app/error.tsx（描画時の想定外の例外）", () => {
  it("「問題が発生しました」と再試行ボタンを出し、例外を console.error に記録する。再試行で retry を呼ぶ", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();
    const error = new Error("boom");
    render(<ErrorPage error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("問題が発生しました");
    expect(consoleError).toHaveBeenCalledWith(error);
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("development では例外のメッセージも出し、production では出さない", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");
    const { unmount } = render(<ErrorPage error={new Error("boom")} retry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    unmount();

    vi.stubEnv("NODE_ENV", "production");
    render(<ErrorPage error={new Error("boom")} retry={vi.fn()} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("boom");
  });
});
