import { readJson } from "@/lib/http/readJson";
import { createClientError, parseErrorResponse, type ApiError } from "@/lib/model/apiError";
import { fail, type ParseError, type Result } from "@/lib/model/result";
import { toSearchParams, type SearchCondition } from "@/lib/model/searchCondition";
import { parseSearchResult, type SearchResult } from "@/lib/model/searchResult";

// ブラウザから BFF を呼ぶ（docs/design.md 5・8 節）。例外を投げず Result を返す。
// BFF のエラー応答は ApiError に、BFF に届かない・JSON でない・形が違うといった失敗も ApiError（通信エラー）に変換する

// jsdom では相対 URL の fetch が解決できないことがあるので絶対 URL にする
function bffUrl(path: string): URL {
  return new URL(path, window.location.origin);
}

function describeIssues(error: ParseError): string {
  return error.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
}

async function getFromBff<T>(
  path: string,
  parse: (input: unknown) => Result<T, ParseError>,
): Promise<Result<T, ApiError>> {
  let res: Response;
  try {
    res = await fetch(bffUrl(path));
  } catch (e) {
    return fail(createClientError("BFF に接続できません", String(e)));
  }

  const body = await readJson(res);
  if (!body.ok) {
    return fail(
      createClientError(
        "応答を JSON として読めません",
        `${String(res.status)} ${body.error.message}`,
      ),
    );
  }

  if (!res.ok) {
    const error = parseErrorResponse(body.value);
    if (error.ok) return fail(error.value.error);
    return fail(
      createClientError(
        "エラー応答の形が想定と違います",
        `${String(res.status)} ${describeIssues(error.error)}`,
      ),
    );
  }

  const value = parse(body.value);
  if (value.ok) return value;
  return fail(createClientError("応答の形が想定と違います", describeIssues(value.error)));
}

export function fetchSearch(condition: SearchCondition): Promise<Result<SearchResult, ApiError>> {
  return getFromBff(`/api/search?${toSearchParams(condition).toString()}`, parseSearchResult);
}
