import { http, HttpResponse } from "msw";
import repoNotFound from "./fixtures/repo-not-found.json";
import repoReactReact from "./fixtures/repo-react-react.json";
import searchReact from "./fixtures/search-react.json";

export const GITHUB_API = "https://api.github.com";

// GitHub の形（生の JSON）で応答する MSW のハンドラ。HttpGitHubClient のテストが使う。
// fixture は FakeGitHubClient と共有する（docs/design.md 7 節）
export const githubHandlers = [
  http.get(`${GITHUB_API}/search/repositories`, () => HttpResponse.json(searchReact)),
  http.get(`${GITHUB_API}/repos/:owner/:repo`, ({ params }) =>
    params["owner"] === "react" && params["repo"] === "react"
      ? HttpResponse.json(repoReactReact)
      : HttpResponse.json(repoNotFound, { status: 404 }),
  ),
];
