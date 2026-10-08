import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientError } from "@/lib/model/apiError";
import { anApiError } from "@/test/builders";
import { ErrorMessage } from "./ErrorMessage";

const requestId = "3f9c2a1e-7b44-4d8e-9a10-5c6e7f8a9b01";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ErrorMessage", () => {
  it("レート制限は固定の案内と問い合わせ番号を出し、再試行ボタンで onRetry を呼ぶ", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorMessage
        error={anApiError("RATE_LIMITED", requestId)}
        failedTitle="検索に失敗しました"
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("GitHub API の利用回数の上限に達しました");
    expect(alert).toHaveTextContent("しばらく待ってから再試行してください。");
    expect(alert).toHaveTextContent(`問い合わせ番号: ${requestId}`);
    expect(alert).not.toHaveTextContent("検索に失敗しました");
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("それ以外は呼び出し側の見出しと通信の案内を出す。問い合わせ番号が無ければその行を出さない", () => {
    const { rerender } = render(
      <ErrorMessage
        error={anApiError("UPSTREAM_ERROR", requestId)}
        failedTitle="検索に失敗しました"
        onRetry={vi.fn()}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("検索に失敗しました");
    expect(alert).toHaveTextContent("ネットワークの状態を確認して、もう一度お試しください。");
    expect(alert).toHaveTextContent(`問い合わせ番号: ${requestId}`);
    expect(alert).not.toHaveTextContent("上限");

    rerender(
      <ErrorMessage
        error={createClientError("BFF に接続できません")}
        failedTitle="検索に失敗しました"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("問い合わせ番号");
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("development では detail を折りたたみで出し、production では出さない", () => {
    const error = createClientError("応答の形が想定と違います", "totalCount: Too small");
    vi.stubEnv("NODE_ENV", "development");
    const { unmount } = render(
      <ErrorMessage error={error} failedTitle="検索に失敗しました" onRetry={vi.fn()} />,
    );
    expect(screen.getByText("totalCount: Too small")).toBeInTheDocument();
    expect(screen.getByText("totalCount: Too small").closest("details")).not.toBeNull();
    unmount();

    vi.stubEnv("NODE_ENV", "production");
    render(<ErrorMessage error={error} failedTitle="検索に失敗しました" onRetry={vi.fn()} />);
    expect(screen.queryByText("totalCount: Too small")).toBeNull();
  });
});
