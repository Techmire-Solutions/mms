#!/usr/bin/env bash
# Auto-fix a file that an agent just edited.
#
# Used by both tool hook layers:
#   - Cursor:      .cursor/hooks.json   → afterFileEdit
#   - Claude Code: .claude/settings.json → PostToolUse (Edit|Write|MultiEdit)
#
# Reads the hook payload on stdin (JSON containing .file_path or .path), then:
#   * runs eslint --fix for TS/JS through the same compatibility shim the pnpm
#     lint scripts use, and
#   * runs prettier via the local binary (a root devDependency since ADR-009;
#     `format:check` gates CI) when it is installed.
#
# Always exits 0 — a formatting failure must never block an agent. Unfixable
# errors are printed so the agent sees them.
set -uo pipefail

ROOT="${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}}"
cd "$ROOT" 2>/dev/null || exit 0

payload="$(cat)"
[ -z "$payload" ] && exit 0

file="$(printf '%s' "$payload" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  try {
    const data = JSON.parse(raw);
    process.stdout.write(String(data.file_path ?? data.path ?? data.tool_input?.file_path ?? ""));
  } catch {
    process.stdout.write("");
  }
});
' 2>/dev/null)"

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0
case "$file" in
  */node_modules/*|*/dist/*|*/coverage/*|*/.git/*) exit 0 ;;
esac

log=/tmp/mms-agent-hook-format.log

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.yml|*.yaml)
    if [ -x "node_modules/.bin/prettier" ]; then
      node_modules/.bin/prettier --write "$file" >"$log" 2>&1 || true
    fi
    ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if [ -x "node_modules/.bin/eslint" ] || [ -x "apps/frontend/node_modules/.bin/eslint" ] || [ -x "apps/backend/node_modules/.bin/eslint" ]; then
      NODE_OPTIONS='-r ./scripts/eslint-ts-compat.cjs' npx --no-install eslint --fix "$file" >"$log" 2>&1 || true
      if grep -qE "^\s+[0-9]+:[0-9]+\s+error" "$log"; then
        echo "eslint reported errors it could not fix in $file:"
        grep -E "^\s+[0-9]+:[0-9]+\s+error" "$log" | head -n 10
      fi
    fi
    ;;
esac

exit 0
