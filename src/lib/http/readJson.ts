import { fail, ok, type Result } from "@/lib/model/result";

// res.json() の戻り値は any なので、unknown にして解析に渡す（docs/design.md 3 節）。
// JSON として読めない本文（HTML のエラーページなど）は例外にせず失敗として返す
export async function readJson(res: Response): Promise<Result<unknown, { message: string }>> {
  try {
    const value: unknown = await res.json();
    return ok(value);
  } catch (e) {
    return fail({ message: e instanceof Error ? e.message : "JSON として読めません" });
  }
}
