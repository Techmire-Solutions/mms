#!/usr/bin/env bash
# Check Prettier formatting only for files a pull request changed.
#
# A full-repo Prettier pass costs 45-57 s in CI; a changed-file pass is ~2-3 s.
# Pushes to main still run the full `pnpm format:check`, so drift cannot persist.
# The caller is expected to fall back to the full check when the base commit is
# unavailable (shallow clone) or when formatting config changed.
#
# Usage: bash scripts/ci/format-changed.sh <base-sha> [head-ref]
# Bash 3.2 compatible (macOS /bin/bash): no mapfile, no associative arrays.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE="${1:?usage: format-changed.sh <base-sha> [head-ref]}"
HEAD_REF="${2:-HEAD}"
PRETTIER="$ROOT/node_modules/.bin/prettier"

if [[ ! -x "$PRETTIER" ]]; then
  echo "format-changed: prettier binary not found at $PRETTIER" >&2
  exit 1
fi

full_check() {
  echo "format-changed: $1 — running full repo check" >&2
  exec "$PRETTIER" --check .
}

if ! git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null; then
  full_check "base commit ${BASE} is not available"
fi

# NUL-delimited so paths with spaces survive; AC MR skips deletions.
FILES=()
while IFS= read -r -d '' file; do
  FILES+=("$file")
done < <(git diff -z --name-only --diff-filter=ACMR "${BASE}...${HEAD_REF}")

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "format-changed: no changed files (${BASE}...${HEAD_REF})"
  exit 0
fi

echo "format-changed: checking ${#FILES[@]} changed file(s)"
exec "$PRETTIER" --check --ignore-unknown "${FILES[@]}"
