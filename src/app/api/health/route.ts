// ヘルスチェック（docs/design.md 6 節）。GitHub は呼ばない
export function GET(): Response {
  return Response.json({ status: "ok" });
}
