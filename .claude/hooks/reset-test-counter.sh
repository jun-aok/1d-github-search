#!/bin/bash
# UserPromptSubmit: ユーザーが発言したら、Stop フックのブロック回数をリセットする
session_id=$(jq -r '.session_id // "unknown"')
rm -f "${TMPDIR:-/tmp}/claude-stop-test-blocks-${session_id}"
exit 0
