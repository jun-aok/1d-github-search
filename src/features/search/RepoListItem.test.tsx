import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseRepoSummary, type RepoSummary } from "@/lib/model/repo";
import { searchReactResult } from "@/mocks/bffHandlers";
import { RepoListItem } from "./RepoListItem";

function firstRepo(): RepoSummary {
  const repo = searchReactResult.items[0];
  if (repo === undefined) throw new Error("fixture が空です");
  return repo;
}

// fixture の 1 件の一部の項目だけを差し替える。モデルの parse を通して作る
function repoWith(overrides: Partial<RepoSummary>): RepoSummary {
  const r = parseRepoSummary({ ...firstRepo(), ...overrides });
  if (!r.ok) throw new Error(`テストのリポジトリが不正です: ${JSON.stringify(r.error.issues)}`);
  return r.value;
}

describe("RepoListItem", () => {
  it("行全体が詳細ページへのリンクで、アイコン・owner/name・description・言語・Star 数を表示する", () => {
    const repo = repoWith({
      fullName: "react/react",
      owner: { login: "react", avatarUrl: "https://avatars.githubusercontent.com/u/102812?v=4" },
      description: "The library",
      language: "JavaScript",
      stars: 250916,
    });
    render(<RepoListItem repo={repo} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/repos/react/react");
    const row = within(link);
    expect(row.getByText("react/react")).toBeInTheDocument();
    expect(row.getByText("The library")).toBeInTheDocument();
    expect(row.getByText("JavaScript")).toBeInTheDocument();
    expect(row.getByText("★ 250,916")).toBeInTheDocument();
    // アイコンは装飾（alt は空）。表示 40px の 2 倍のサイズを指定する
    const icon = link.querySelector("img");
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("src", "https://avatars.githubusercontent.com/u/102812?v=4&s=80");
  });

  it("リンク先は owner と name をそれぞれ URL の 1 区切りとして符号化する（詳細の取得と同じ）", () => {
    render(<RepoListItem repo={repoWith({ fullName: "a b/c#d?e" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/repos/a%20b/c%23d%3Fe");
  });

  it("言語が null のときは「—」、description が null のときは空にする", () => {
    render(<RepoListItem repo={repoWith({ language: null, description: null })} />);
    const link = screen.getByRole("link");
    expect(within(link).getByText("—")).toBeInTheDocument();
    expect(link).not.toHaveTextContent("null");
  });
});
