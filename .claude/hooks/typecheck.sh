#!/bin/bash
# PostToolUse(Write|Edit|MultiEdit): TypeScript ファイルの編集後に型チェックし、失敗したら exit 2 で Claude に差し戻す
# 実行はコンテナ内（docker compose run --rm app）。ホストに Node.js は置かない
cd "$CLAUDE_PROJECT_DIR" || exit 0

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *tsconfig*.json) ;;
  *) exit 0 ;;
esac

# プロジェクト作成前は何もしない
[ -f tsconfig.json ] && [ -f compose.yaml ] || exit 0

if ! docker info >/dev/null 2>&1; then
  echo "Docker デーモンが動いていないため型チェックできません。Docker を起動してください。" >&2
  exit 2
fi

if ! out=$(docker compose run --rm --no-deps -T app npm run typecheck --silent 2>&1); then
  echo "型チェックに失敗しました (tsc --noEmit):" >&2
  echo "$out" | head -20 >&2
  exit 2
fi
