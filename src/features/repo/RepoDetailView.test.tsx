import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseRepoDetail, type RepoDetail } from "@/lib/model/repo";
import { repoReactReactDetail } from "@/mocks/bffHandlers";
import { RepoDetailView } from "./RepoDetailView";

// fixture の一部の項目だけを差し替える。モデルの parse を通して作る
function repoWith(overrides: Partial<RepoDetail>): RepoDetail {
  const r = parseRepoDetail({ ...repoReactReactDetail, ...overrides });
  if (!r.ok) throw new Error(`テストのリポジトリが不正です: ${JSON.stringify(r.error.issues)}`);
  return r.value;
}

describe("RepoDetailView", () => {
  it("owner/name・アイコン・言語・description と、4 つの数をカンマ区切りで丸めずに表示する", () => {
    const repo = repoWith({
      fullName: "react/react",
      owner: { login: "react", avatarUrl: "https://avatars.githubusercontent.com/u/102812?v=4" },
      description: "The library",
      language: "JavaScript",
      stars: 250916,
      watchers: 6603,
      forks: 1234567,
      openIssues: 999,
    });
    render(<RepoDetailView repo={repo} />);

    expect(screen.getByRole("heading", { level: 1, name: "react/react" })).toBeInTheDocument();
    // アイコンは表示 64px の 2 倍のサイズを指定する
    expect(screen.getByRole("img", { name: "react のアイコン" })).toHaveAttribute(
      "src",
      "https://avatars.githubusercontent.com/u/102812?v=4&s=128",
    );
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("The library")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((e) => e.textContent)).toEqual([
      "Star 数",
      "Watcher 数",
      "Fork 数",
      "Issue 数",
    ]);
    expect(screen.getAllByRole("definition").map((e) => e.textContent)).toEqual([
      "250,916",
      "6,603",
      "1,234,567",
      "999",
    ]);
  });

  it("言語が null なら「—」を表示する", () => {
    render(<RepoDetailView repo={repoWith({ language: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("「GitHub で開く」はリポジトリの URL を別タブで開く", () => {
    render(<RepoDetailView repo={repoWith({ url: "https://github.com/react/react" })} />);
    const link = screen.getByRole("link", { name: /GitHub で開く/ });
    expect(link).toHaveAttribute("href", "https://github.com/react/react");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
