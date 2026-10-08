#!/bin/bash
# Stop: 応答を終える前に lint / typecheck / 単体テスト / E2E を順に実行し、失敗したら exit 2 で停止をブロックする
# 実行はすべてコンテナ内（docker compose）。ホストに Node.js は置かない
# E2E は .claude/loop-active があるとき（ユーザーがループ開始を宣言した後）だけ判定に含める
# 失敗が MAX_BLOCKS 回連続したら、無限ループを防ぐために警告を出して通す
# 回数は UserPromptSubmit（ユーザーの発言）と、成功でリセットされる
MAX_BLOCKS=15
cd "$CLAUDE_PROJECT_DIR" || exit 0

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
counter_file="${TMPDIR:-/tmp}/claude-stop-test-blocks-${session_id}"

# プロジェクト作成前は何もしない
[ -f package.json ] && [ -f compose.yaml ] || exit 0

block() {
  blocks=$(( $(cat "$counter_file" 2>/dev/null || echo 0) + 1 ))
  echo "$blocks" > "$counter_file"
  if [ "$blocks" -gt "$MAX_BLOCKS" ]; then
    echo "{\"systemMessage\": \"$1 が失敗したまま ${MAX_BLOCKS} 回ブロックしたため、停止を許可しました。状態を確認してください。\"}"
    exit 0
  fi
  echo "$1 が失敗しています。修正してから応答を終えてください (${blocks}/${MAX_BLOCKS}):" >&2
  echo "$2" | tail -40 >&2
  exit 2
}

docker info >/dev/null 2>&1 || block "Docker" "Docker デーモンが動いていないため検査できません。Docker を起動してください。"

has_script() { jq -e ".scripts[\"$1\"]" package.json >/dev/null 2>&1; }

for step in lint typecheck test; do
  has_script "$step" || continue
  out=$(docker compose run --rm --no-deps -T app npm run "$step" --silent 2>&1) || block "npm run $step" "$out"
done

if [ -f .claude/loop-active ]; then
  out=$(docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e e2e 2>&1) || block "E2E" "$out"
  docker compose --profile e2e down >/dev/null 2>&1
fi

rm -f "$counter_file"
exit 0
