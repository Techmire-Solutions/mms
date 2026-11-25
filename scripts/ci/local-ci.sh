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
WITH_LIGHTHOUSE=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --with-db) WITH_DB=1 ;;
    --with-e2e) WITH_E2E=1 ;;
    --with-lighthouse) WITH_LIGHTHOUSE=1 ;;
    -h|--help)
      echo "Usage: bash scripts/ci/local-ci.sh [--full] [--with-db] [--with-e2e] [--with-lighthouse]"
      echo "  default           pre-pr gates (affected typecheck, changed-file lint) + changed-related unit tests"
      echo "  --full            full typecheck/lint/test suites + i18n/build/bundle + Lighthouse; shared test:coverage"
      echo "  --with-db         DB integration when backend_db paths changed"
      echo "  --with-e2e        Playwright when e2e paths changed"
      echo "  --with-lighthouse Lighthouse CI (mobile + desktop) against the production build"
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

COMMON_ROOT=('packages/contracts/*' 'packages/db/*' 'packages/be-core/*' 'packages/fe-core/*' 'packages/ui/*' 'packages/modules/*' 'packages/modules/iam/*' 'tooling/*' 'package.json' 'pnpm-lock.yaml' '.github/*')

bucket() {
  case "$1" in
    # Target app roots (migration plan P0/P7/P8): harmless no-ops today, but a PR
    # touching only a future app root must not skip its bucket silently.
    frontend)
      printf '%s\n' "$CHANGED_TEXT" | paths_match \
        'apps/tenant-web/*' 'apps/platform-web/*' "${COMMON_ROOT[@]}"
      ;;
    backend_unit)
      printf '%s\n' "$CHANGED_TEXT" | paths_match 'apps/api/*' "${COMMON_ROOT[@]}"
      ;;
    backend_db)
      printf '%s\n' "$CHANGED_TEXT" | paths_match \
        'apps/api/src/db/*' 'packages/db/*' 'packages/be-core/*' \
        'packages/db/drizzle.config.ts' \
        'apps/api/src/*/repository/*' \
        'apps/api/src/*/ledgerPosting/*' \
        'apps/api/src/__tests__/db-integration/*' \
        'apps/api/src/__tests__/rls/*' \
        'apps/api/vitest.db.config.ts' \
        'apps/api/vitest.rls.config.ts' \
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
  'tsconfig*.json' '*/tsconfig*.json' '*eslint.config.*' 'scripts/eslint-ts-compat.cjs'
  'tooling/*')
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
# Clear potentially huge path list from child env before Prettier/Turbo/Vitest (macOS ARG_MAX stack headroom).
unset MMS_CI_CHANGED

# Mirrors CI `pnpm format:check`. --end-of-line auto: Windows autocrlf checkouts are
# CRLF on disk but committed as LF, so the configured "lf" would flag every file.
echo ""
echo "Phase A2: formatting (Prettier)"
if [[ "$SCOPE" == "full" ]]; then
  pnpm exec prettier --check --end-of-line auto .
  note_ran "prettier"
else
  FORMAT_FILES=()
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" ]] && FORMAT_FILES+=("$f")
  done <<< "$CHANGED_TEXT"
  if [[ "${#FORMAT_FILES[@]}" -gt 0 ]]; then
    # Chunk args to avoid Windows command line length limits (8191 chars)
    CHUNK_SIZE=40
    for ((i=0; i<${#FORMAT_FILES[@]}; i+=CHUNK_SIZE)); do
      pnpm exec prettier --check --end-of-line auto --ignore-unknown "${FORMAT_FILES[@]:i:CHUNK_SIZE}"
    done
    note_ran "prettier"
  else
    note_skip "prettier(no-changes)"
  fi
fi

NEED_FE=0; NEED_BE_UNIT=0; NEED_BE_DB=0; NEED_E2E=0
if [[ "$FULL" -eq 1 ]]; then
  NEED_FE=1; NEED_BE_UNIT=1; NEED_BE_DB=1; NEED_E2E=1
else
  bucket frontend && NEED_FE=1
  bucket backend_unit && NEED_BE_UNIT=1
  bucket backend_db && NEED_BE_DB=1
  bucket e2e && NEED_E2E=1
fi
echo ""
echo "Phase B: buckets frontend=$NEED_FE backend_unit=$NEED_BE_UNIT backend_db=$NEED_BE_DB e2e=$NEED_E2E"

pnpm run check:module-boundaries && note_ran "module-boundaries"
pnpm run check:move-manifest && note_ran "move-manifest"
pnpm run check:topology && note_ran "topology"
if [[ "$NEED_FE" -eq 1 || "$NEED_BE_UNIT" -eq 1 ]]; then
  for mod_dir in packages/modules/*/; do
    [[ -f "${mod_dir}package.json" ]] || continue
    mod_slice="$(basename "$mod_dir")"
    pnpm --filter "@mms/mod-${mod_slice}" test && note_ran "mod-${mod_slice}-test"
  done
fi

echo ""
echo "Phase C: affected unit tests"
if [[ "$NEED_FE" -eq 1 ]]; then
  run_vitest mms-tenant-web 'packages/contracts/*' 'apps/tenant-web/vite*.config.ts' 'apps/tenant-web/src/test/*'
  note_ran "frontend-vitest"
  run_vitest mms-platform-web 'packages/contracts/*' 'apps/platform-web/vite*.config.ts' 'apps/platform-web/src/test/*'
  note_ran "platform-vitest"
  pnpm --filter @mms/ui test && note_ran "ui-test"
  pnpm --filter @mms/fe-core test && note_ran "fe-core-test"
else
  note_skip "frontend-vitest"
fi

if [[ "$NEED_BE_UNIT" -eq 1 ]]; then
  if [[ "$FULL" -eq 1 ]]; then
    pnpm --filter @mms/contracts test:coverage
    note_ran "shared-test-coverage"
  else
    run_vitest @mms/contracts 'packages/contracts/vitest.config.ts'
    note_ran "shared-test"
  fi
  run_vitest mms-api 'packages/contracts/*' 'apps/api/vitest.config.ts'
  note_ran "backend-vitest"
  pnpm --filter @mms/db test && note_ran "db-test"
  pnpm --filter @mms/be-core test && note_ran "be-core-test"
else
  note_skip "shared+backend-unit"
fi

if [[ "$FULL" -eq 1 ]]; then
  echo ""
  echo "Phase D: --full extras"
  pnpm run check:i18n && note_ran "check:i18n"
  pnpm build && note_ran "build"
  pnpm run check:bundle && note_ran "check:bundle"
  pnpm run check:examinations-tests && note_ran "check:examinations-tests"
  pnpm run check:obligations-tests && note_ran "check:obligations-tests"
  pnpm run check:obligations-route-injection && note_ran "check:obligations-route-injection"
  pnpm run check:examinations-route-injection && note_ran "check:examinations-route-injection"
  pnpm run check:examinations-route-security && note_ran "check:examinations-route-security"
fi

# Lighthouse CI (mobile + desktop) — runs with --full (reusing its build) or
# standalone with --with-lighthouse (which builds the frontend first).
if [[ "$FULL" -eq 1 || "$WITH_LIGHTHOUSE" -eq 1 ]]; then
  echo ""
  echo "Phase G: Lighthouse CI (mobile + desktop)"
  if [[ "$FULL" -ne 1 ]]; then
    pnpm --filter mms-tenant-web build
  fi
  # Clean up stale results from a previous local run (the `mv` below would
  # otherwise fail once .lighthouseci-mobile/.lighthouseci-desktop exist).
  rm -rf .lighthouseci .lighthouseci-mobile .lighthouseci-desktop
  npx --yes @lhci/cli@0.14.0 autorun --config=./lighthouserc.cjs
  if [ -d .lighthouseci ]; then mv .lighthouseci .lighthouseci-mobile; fi
  npx --yes @lhci/cli@0.14.0 autorun --config=./lighthouserc.desktop.cjs
  if [ -d .lighthouseci ]; then mv .lighthouseci .lighthouseci-desktop; fi
  node scripts/perf/format-lhci-comment.cjs
  note_ran "lighthouse"
else
  note_skip "lighthouse(pass--with-lighthouse)"
fi

postgres_ready() {
  if command -v pg_isready >/dev/null 2>&1 && pg_isready -q 2>/dev/null; then
    return 0
  fi
  node -e 'const net=require("node:net"),s=net.connect(Number(process.env.PGPORT||5432),process.env.PGHOST||"127.0.0.1",()=>{s.end();process.exit(0)});s.on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),1500);' 2>/dev/null
}

if [[ "$WITH_DB" -eq 1 && "$NEED_BE_DB" -eq 1 ]]; then
  if postgres_ready; then
    echo ""
    echo "Phase E: backend DB (--with-db)"
    pnpm --filter mms-api run db:migrate
    for mod_dir in packages/modules/*/; do
      [[ -f "${mod_dir}vitest.db.config.ts" ]] || continue
      mod_slice="$(basename "$mod_dir")"
      if ! grep -Fq "packages/modules/${mod_slice}/" apps/api/vitest.db.config.ts; then
        pnpm --filter "@mms/mod-${mod_slice}" run test:db
      fi
    done
    pnpm --filter mms-api run test:db
    pnpm --filter mms-api run test:db:coverage:attendance
    node scripts/ci/check-attendance-coverage.mjs --coverage apps/api/coverage-attendance-db
    node scripts/ci/check-db-test-hygiene.mjs
    node scripts/ci/check-db-test-manifest.mjs
    pnpm --filter mms-api run test:db:concurrency
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
