#!/usr/bin/env bash
# Mirror MMS standards to Cursor, Antigravity, and Claude Code trees.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

bash .agent/scripts/sync-rules.sh "$@"
bash .agent/scripts/sync-skills.sh "$@"
bash .agent/scripts/sync-claude.sh "$@"

# Keep the hand-maintained indexes (manifest, skills README, AGENTS.md count) in
# step with the skills on disk, so adding a skill needs only one command.
node scripts/sync-skill-index.mjs

echo "All agent mirrors synced (.agent, .cursor, .claude)."
