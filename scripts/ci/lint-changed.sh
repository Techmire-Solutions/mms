#!/usr/bin/env bash
# Lint only the given files (stdin, repo-relative), grouped by workspace package.
# Uses each package's own eslint.config.js and the TS-6 compat shim; --cache skips unchanged files.
# Bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# package dir | lint scope prefix (mirrors each package's `lint` script target) | path to repo root
PACKAGES=(
  'apps/tenant-web|apps/tenant-web/|../..'
  'apps/platform-web|apps/platform-web/|../..'
  'apps/api|apps/api/src/|../..'
  'packages/contracts|packages/contracts/|../..'
  'packages/db|packages/db/|../..'
  'packages/be-core|packages/be-core/|../..'
  'packages/fe-core|packages/fe-core/|../..'
  'packages/ui|packages/ui/|../..'
  'e2e|e2e/|..'
)
# Every extracted module is its own workspace package with its own eslint config.
for module_dir in packages/modules/*/; do
  module="${module_dir%/}"
  [[ -f "$module/eslint.config.js" ]] && PACKAGES+=("$module|$module/|../../..")
done

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
  extra_rules=()
  if grep -q "no-explicit-any:off" "$pkg/package.json" 2>/dev/null; then
    extra_rules=(--rule '@typescript-eslint/no-explicit-any:off')
  fi
  # Unset MMS_CI_CHANGED (can approach 1 MiB on large refactors) and chunk argv to stay well under macOS ARG_MAX.
  idx=0
  total=${#list[@]}
  while [[ $idx -lt $total ]]; do
    chunk=("${list[@]:$idx:200}")
    (cd "$pkg" && env -u MMS_CI_CHANGED node -r "$up/scripts/eslint-ts-compat.cjs" node_modules/eslint/bin/eslint.js --quiet --no-warn-ignored \
      --cache --cache-strategy content --cache-location node_modules/.cache/eslint/ ${extra_rules[@]+"${extra_rules[@]}"} "${chunk[@]}") || STATUS=1
    idx=$((idx + 200))
  done
done
exit "$STATUS"
