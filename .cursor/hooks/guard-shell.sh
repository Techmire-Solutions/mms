#!/usr/bin/env bash
# Guard shell commands that must never run unattended in this repository.
#
# Used by:
#   - Claude Code: .claude/settings.json → PreToolUse (Bash)   [exit 2 blocks]
#   - Cursor:      .cursor/hooks.json    → beforeShellExecution [exit 2 blocks]
#
# Contract: read the hook payload (JSON with the command) on stdin.
#   exit 0 → allow
#   exit 2 → block, with the reason on stderr
#
# NOTE: exit code 1 is a NON-blocking error in both tools — a policy hook must
# use exit 2. Anything else silently allows the action.
set -uo pipefail

payload="$(cat)"
[ -z "$payload" ] && exit 0

command="$(printf '%s' "$payload" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
  try {
    const data = JSON.parse(raw);
    const cmd = data.command ?? data.tool_input?.command ?? data.shell_command ?? "";
    process.stdout.write(String(cmd));
  } catch {
    process.stdout.write("");
  }
});
' 2>/dev/null)"

[ -z "$command" ] && exit 0

block() {
  echo "Blocked by .cursor/hooks/guard-shell.sh: $1" >&2
  echo "This repository's standards forbid it (mms-agent-universal.md). Ask the user to run it explicitly." >&2
  exit 2
}

# Destructive filesystem operations outside the workspace.
case "$command" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf \$HOME"*) block "destructive rm of a root/home path." ;;
esac

# Direct DDL against a live database bypasses the migration pipeline.
case "$command" in
  *"drizzle-kit push"*) block "drizzle-kit push is banned — author a forward migration (mms-schema-migrate)." ;;
esac

# Secrets must not be read into agent context by default.
case "$command" in
  *"cat .env"*|*"cat apps/api/.env"*|*"cat .claude/settings.local.json"*)
    block "reading a secrets file; use .env.example for shape or ask the user." ;;
esac

exit 0
