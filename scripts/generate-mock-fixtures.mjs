// src/mocks/fixtures/*.json（GitHub の生の JSON）から mock/fixtures.js を生成する
// 実行: docker compose run --rm --no-deps -T app node scripts/generate-mock-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../src/mocks/fixtures/${name}`, import.meta.url), "utf8"));
const search = read("search-react.json");
const few = read("search-few.json");
const repo = read("repo-react-react.json");

const summary = (r) => ({
  id: r.id,
  full_name: r.full_name,
  owner: r.owner.login,
  avatar_url: r.owner.avatar_url,
  description: r.description,
  language: r.language,
  stargazers_count: r.stargazers_count,
  html_url: r.html_url,
});

const out = `// 自動生成: scripts/generate-mock-fixtures.mjs が src/mocks/fixtures/*.json から作る。手で編集しない
// 検索（q=react, per_page=20）
const SEARCH_FIXTURE = ${JSON.stringify({ total_count: search.total_count, items: search.items.map(summary) }, null, 2)};

// 検索（少数。q=__few__ に対応）
const SEARCH_FEW_FIXTURE = ${JSON.stringify({ total_count: few.total_count, items: few.items.map(summary) }, null, 2)};

// 詳細（GET /repos/react/react）。Watcher 数は subscribers_count
const REPO_FIXTURE = ${JSON.stringify(
  {
    id: repo.id,
    full_name: repo.full_name,
    owner: repo.owner.login,
    avatar: repo.owner.avatar_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    subscribers_count: repo.subscribers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    html_url: repo.html_url,
  },
  null,
  2,
)};
`;
writeFileSync(new URL("../mock/fixtures.js", import.meta.url), out);
console.log("mock/fixtures.js を生成しました");
