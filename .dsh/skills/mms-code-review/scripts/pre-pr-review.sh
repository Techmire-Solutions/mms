#!/usr/bin/env bash
# MMS Pre-PR Quality & Completion Review Verifier
# Runs mandatory automated gates per mms-completion-review.md, in parallel.
# MMS_CI_SCOPE=affected (set by scripts/ci/local-ci.sh) narrows typecheck to
# turbo --affected vs MMS_CI_BASE, lint to the paths in MMS_CI_CHANGED, and the
# code-norm / DB-projection ratchets to changed files (--changed).
# Bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
SCOPE="${MMS_CI_SCOPE:-full}"

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT
NAMES=()
PIDS=()

# Usage: gate <label> <command...> — starts the gate in the background.
gate() {
  local label="$1"; shift
  local index=${#NAMES[@]}
  ("$@") > "$LOG_DIR/$index.log" 2>&1 &
  NAMES+=("$label")
  PIDS+=("$!")
}

lint_changed() { printf '%s\n' "${MMS_CI_CHANGED:-}" | bash scripts/ci/lint-changed.sh; }
typecheck_affected() { TURBO_SCM_BASE="${MMS_CI_BASE:-main}" pnpm exec turbo run typecheck --affected; }

echo "=================================================="
echo "🚀 MMS Pre-PR Automated Verification (scope: $SCOPE, parallel)"
echo "=================================================="

# Advisory only (never fails): flags backend domain files changed without a
# changed spec. Test-first ordering itself is unprovable (rule mms-tdd §2).
node scripts/check-tdd-pairing.mjs || true

gate "Staged secrets" pnpm run check:secrets
gate "Rules & skills integrity" node scripts/verify-rules-integrity.mjs
gate "i18n completeness (en/ar/ur/fa)" pnpm run check:i18n
gate "i18n unused keys" pnpm run check:i18n-unused
gate "@mms/shared purity & boundaries" pnpm run check:shared-purity
gate "@mms/shared structure" pnpm run check:shared-structure
gate "Faculty domain legacy surface" pnpm run check:faculty-domain
gate "Migration index quality" pnpm run check:migration-indexes
gate "Migration hygiene" pnpm run check:migration-hygiene
gate "Migrations are forward-only" pnpm run check:migrations-forward-only
gate "Work directory convergence" pnpm run check:work-directory
gate "Frontend structure ratchets" pnpm run check:frontend-structure
gate "Shared UI architecture & governance" pnpm run check:shared-ui
gate "Documentation ratchets" pnpm run check:docs
if [[ "$SCOPE" == "affected" ]]; then
  gate "DB projection hygiene (changed files)" node scripts/check-db-projections.mjs --changed
  gate "Backend route→storage boundary (changed files)" node scripts/check-backend-boundaries.mjs --changed
  gate "Backend structural ratchets" pnpm run check:backend-structure
  gate "Code norms (changed files)" node scripts/check-code-norms.mjs --changed
  gate "TypeScript typecheck (affected vs ${MMS_CI_BASE:-main})" typecheck_affected
  gate "ESLint (changed files)" lint_changed
else
  gate "DB projection hygiene" pnpm run check:db-projections
  gate "Backend route→storage boundary" pnpm run check:backend-boundaries
  gate "Code norms ratchet" pnpm run check:code-norms
  gate "TypeScript typecheck" pnpm typecheck
  gate "ESLint" pnpm lint
fi

FAILED=0
for i in "${!NAMES[@]}"; do
  if wait "${PIDS[$i]}"; then
    echo "✓ ${NAMES[$i]}"
  else
    FAILED=$((FAILED + 1))
    echo "✗ ${NAMES[$i]} — output:"
    sed 's/^/    /' "$LOG_DIR/$i.log"
  fi
done

echo "=================================================="
if [[ "$FAILED" -gt 0 ]]; then
  echo "💥 $FAILED gate(s) failed."
  exit 1
fi
echo "✨ All automated completion review checks passed!"
echo "=================================================="
exit 0
