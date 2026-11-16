#!/usr/bin/env bash
# Mirror MMS standards to Cursor, Antigravity, Claude Code, and DeepSeek Harness trees.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

# Indexes first: sync-skill-index rewrites `.agent/skills/README.md` (and the manifest),
# which the skill mirrors copy. Running it after the mirror step leaves the mirrors one
# description behind — the drift this gate then reports against the source it just wrote.
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Would sync the skill indexes (.agent/skills-manifest.json, skills README, AGENTS.md count)"
else
  node scripts/sync-skill-index.mjs
fi

bash .agent/scripts/sync-rules.sh "$@"
bash .agent/scripts/sync-skills.sh "$@"
bash .agent/scripts/sync-claude.sh "$@"
bash .agent/scripts/sync-dsh.sh "$@"

echo "All agent mirrors synced (.agent, .cursor, .claude, .dsh)."
