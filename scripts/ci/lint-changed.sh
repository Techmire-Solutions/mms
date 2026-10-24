#!/usr/bin/env bash
# Lint only the given files (stdin, repo-relative), grouped by workspace package.
# Uses each package's own eslint.config.js and the TS-6 compat shim; --cache skips unchanged files.
# Bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# package dir | lint scope prefix (mirrors each package's `lint` script target) | path to repo root
PACKAGES=('apps/frontend|apps/frontend/|../..' 'apps/backend|apps/backend/src/|../..' 'packages/shared|packages/shared/|../..' 'e2e|e2e/|..')

FILES="$(sed '/^$/d' | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' || true)"
if [[ -z "$FILES" ]]; then
  echo "lint-changed: no lintable files."
  exit 0
fi

STATUS=0
for entry in "${PACKAGES[@]}"; do
  IFS='|' read -r pkg scope up <<< "$entry"
  list=()
  while IFS= read -r f; do
    [[ "$f" == "$scope"* && -f "$f" ]] && list+=("${f#"$pkg"/}")
  done <<< "$FILES"
  [[ ${#list[@]} -eq 0 ]] && continue
  echo "lint-changed: $pkg (${#list[@]} files)"
  (cd "$pkg" && node -r "$up/scripts/eslint-ts-compat.cjs" node_modules/eslint/bin/eslint.js --quiet --no-warn-ignored \
    --cache --cache-strategy content --cache-location node_modules/.cache/eslint/ "${list[@]}") || STATUS=1
done
exit "$STATUS"
