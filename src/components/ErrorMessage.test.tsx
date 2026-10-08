import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { anApiError } from "@/test/builders";
import { ErrorMessage } from "./ErrorMessage";

const requestId = "3f9c2a1e-7b44-4d8e-9a10-5c6e7f8a9b01";

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
});
