#!/usr/bin/env bash
# Path-aware local CI (mirrors high-signal jobs from .github/workflows/ci.yml).
# Usage: bash scripts/ci/local-ci.sh [--full] [--with-db] [--with-e2e]
# Bash 3.2 compatible (macOS /bin/bash).
# Default run is affected-only: turbo typecheck --affected, ESLint on changed files,
# vitest --changed <merge-base>. Tooling/config changes fall back to full runs.
# Enforced by .githooks/pre-push; pre-commit only checks secrets + lints staged files.
# Escape: SKIP_LOCAL_CI=1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FULL=0
WITH_DB=0
WITH_E2E=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --with-db) WITH_DB=1 ;;
    --with-e2e) WITH_E2E=1 ;;
    -h|--help)
      echo "Usage: bash scripts/ci/local-ci.sh [--full] [--with-db] [--with-e2e]"
      echo "  default   pre-pr gates (affected typecheck, changed-file lint) + changed-related unit tests"
      echo "  --full    full typecheck/lint/test suites + i18n/build/bundle; shared test:coverage"
      echo "  --with-db DB integration when backend_db paths changed"
      echo "  --with-e2e Playwright when e2e paths changed"
      exit 0
      ;;
    *) echo "Unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

RAN=""
SKIPPED=""
note_ran() { RAN="${RAN:+$RAN }$1"; }
note_skip() { SKIPPED="${SKIPPED:+$SKIPPED }$1"; }

resolve_base() {
  local base="" ref
  for ref in origin/main main master; do
    if [[ -z "$base" ]] && git rev-parse --verify --quiet "$ref" >/dev/null; then
      base="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
    fi
  done
  if [[ -z "$base" ]]; then
    base="$(git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD)"
  fi
  printf '%s\n' "$base"
}

# stdin: paths. Args: [[ == ]] patterns (* matches across '/').
paths_match() {
  local f p
  while IFS= read -r f || [[ -n "$f" ]]; do
    [[ -z "$f" ]] && continue
    for p in "$@"; do
      [[ "$f" == $p ]] && return 0
    done
  done
  return 1
}

COMMON_ROOT=('packages/shared/*' 'package.json' 'pnpm-lock.yaml' '.github/*')

bucket() {
  case "$1" in
    frontend) printf '%s\n' "$CHANGED_TEXT" | paths_match 'apps/frontend/*' "${COMMON_ROOT[@]}" ;;
    backend_unit) printf '%s\n' "$CHANGED_TEXT" | paths_match 'apps/backend/*' "${COMMON_ROOT[@]}" ;;
    backend_db)
      printf '%s\n' "$CHANGED_TEXT" | paths_match \
        'apps/backend/src/db/*' 'apps/backend/drizzle.config.ts' \
        'apps/backend/src/*/repository/*' 'apps/backend/src/*/ledgerPosting/*' \
        'apps/backend/src/accounting/*' 'apps/backend/vitest.db.config.ts' \
        "${COMMON_ROOT[@]}"
      ;;
    e2e) printf '%s\n' "$CHANGED_TEXT" | paths_match 'e2e/*' 'apps/*' "${COMMON_ROOT[@]}" ;;
  esac
}

echo "=================================================="
echo "MMS local CI (path-aware)"
echo "=================================================="

BASE="$(resolve_base)"
CHANGED_TEXT="$( (git diff --name-only "$BASE"...HEAD 2>/dev/null || true; git diff --cached --name-only 2>/dev/null || true; git diff --name-only "$BASE" 2>/dev/null || true; git diff --name-only 2>/dev/null || true) | sed '/^$/d' | sort -u )"
CHANGED_COUNT=0
[[ -n "$CHANGED_TEXT" ]] && CHANGED_COUNT="$(printf '%s\n' "$CHANGED_TEXT" | grep -c . || true)"
echo "Diff base: $BASE ($CHANGED_COUNT paths)"

# Tooling/config changes invalidate per-file selection: run everything in full.
TOOLING=('package.json' '*/package.json' 'pnpm-lock.yaml' 'pnpm-workspace.yaml' 'turbo.json'
  'tsconfig*.json' '*/tsconfig*.json' '*eslint.config.*' 'scripts/eslint-ts-compat.cjs')
SCOPE=affected
if [[ "$FULL" -eq 1 ]] || printf '%s
' "$CHANGED_TEXT" | paths_match "${TOOLING[@]}"; then
  SCOPE=full
fi
echo "Scope: $SCOPE"
export MMS_CI_SCOPE="$SCOPE" MMS_CI_BASE="$BASE" MMS_CI_CHANGED="$CHANGED_TEXT"

# Usage: run_vitest <pnpm filter> <full-run trigger globs...>
run_vitest() {
  local filter="$1"; shift
  if [[ "$SCOPE" == "full" ]] || printf '%s
' "$CHANGED_TEXT" | paths_match "$@"; then
    pnpm --filter "$filter" exec vitest run
  else
    pnpm --filter "$filter" exec vitest run --changed "$BASE" --passWithNoTests
  fi
}

echo ""
echo "Phase A: quality gates (pre-pr-review.sh)"
bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh
note_ran "gates"

NEED_FE=0; NEED_BE_UNIT=0; NEED_BE_DB=0; NEED_E2E=0
bucket frontend && NEED_FE=1
bucket backend_unit && NEED_BE_UNIT=1
bucket backend_db && NEED_BE_DB=1
bucket e2e && NEED_E2E=1
echo ""
echo "Phase B: buckets frontend=$NEED_FE backend_unit=$NEED_BE_UNIT backend_db=$NEED_BE_DB e2e=$NEED_E2E"

echo ""
echo "Phase C: affected unit tests"
if [[ "$NEED_FE" -eq 1 ]]; then
  run_vitest mms-frontend 'packages/shared/*' 'apps/frontend/vite*.config.ts' 'apps/frontend/src/test/*'
  note_ran "frontend-vitest"
else
  note_skip "frontend-vitest"
fi

if [[ "$NEED_BE_UNIT" -eq 1 ]]; then
  if [[ "$FULL" -eq 1 ]]; then
    pnpm --filter @mms/shared test:coverage
    note_ran "shared-test-coverage"
  else
    run_vitest @mms/shared 'packages/shared/vitest.config.ts'
    note_ran "shared-test"
  fi
  run_vitest mms-backend 'packages/shared/*' 'apps/backend/vitest.config.ts'
  note_ran "backend-vitest"
else
  note_skip "shared+backend-unit"
fi

if [[ "$FULL" -eq 1 ]]; then
  echo ""
  echo "Phase D: --full extras"
  pnpm run check:i18n && note_ran "check:i18n"
  pnpm build && note_ran "build"
  pnpm run check:bundle && note_ran "check:bundle"
fi

if [[ "$WITH_DB" -eq 1 && "$NEED_BE_DB" -eq 1 ]]; then
  if command -v pg_isready >/dev/null 2>&1 && pg_isready -q 2>/dev/null; then
    echo ""
    echo "Phase E: backend DB (--with-db)"
    pnpm --filter mms-backend run db:migrate
    pnpm --filter mms-backend run test:db
    note_ran "backend-db"
  else
    echo "SKIP backend-db: Postgres not ready (pg_isready)."
    note_skip "backend-db(no-postgres)"
  fi
elif [[ "$WITH_DB" -eq 1 ]]; then
  note_skip "backend-db(paths-unchanged)"
else
  note_skip "backend-db(pass--with-db)"
fi

if [[ "$WITH_E2E" -eq 1 && "$NEED_E2E" -eq 1 ]]; then
  echo ""
  echo "Phase F: Playwright (--with-e2e)"
  pnpm test:e2e
  note_ran "e2e"
elif [[ "$WITH_E2E" -eq 1 ]]; then
  note_skip "e2e(paths-unchanged)"
else
  note_skip "e2e(pass--with-e2e)"
fi

echo ""
echo "=================================================="
echo "Local CI summary"
echo "  ran:     ${RAN:-none}"
echo "  skipped: ${SKIPPED:-none}"
echo "=================================================="
echo "Local CI passed."
exit 0
