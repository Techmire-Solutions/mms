#!/usr/bin/env bash
# MMS accessibility smoke.
#
# Two modes:
#   static (default) — fast heuristics over the UI primitives. Prints findings and
#                      exits non-zero only when MMS_A11Y_STRICT=1 (heuristics
#                      produce false positives by design; they are a nudge, not a gate).
#   full             — runs the real axe gate:
#                      `pnpm --filter e2e-tests exec playwright test tests/a11y-shell.spec.ts`
#                      and propagates its exit code (serious/critical violations fail).
#
# Usage: bash smoke-a11y.sh [static|full]
set -uo pipefail

MODE="${1:-static}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

SRC_GLOBS=("apps/frontend/src/components" "apps/frontend/src/tenant/features" "apps/frontend/src/platform")

if [[ "$MODE" == "full" ]]; then
  echo "🔍 Running axe gate (Playwright)…"
  pnpm --filter e2e-tests exec playwright test tests/a11y-shell.spec.ts
  exit $?
fi

echo "🔍 Running static a11y heuristics (mode: static)…"
FINDINGS=0

report() {
  FINDINGS=$((FINDINGS + 1))
  if [[ "$FINDINGS" -le 5 ]]; then echo "⚠️  $1"; fi
}

# 1. Icon-only buttons with no accessible name.
while IFS= read -r match; do
  report "icon-only button without aria-label: $match"
done < <(grep -rnE '<button[^>]*>[[:space:]]*<[A-Z][a-zA-Z]*' "${SRC_GLOBS[@]}" --include=*.tsx 2>/dev/null | grep -v "\.test\.tsx" | grep -v 'aria-label' || true)

# 2. Interactive controls with a fixed small height and no 44px floor.
while IFS= read -r match; do
  report "control under the 44px touch floor (no min-h-11): $match"
done < <(grep -rnE 'className="[^"]*\b(h-6|h-7|h-8|h-9)\b[^"]*"' "${SRC_GLOBS[@]}" --include=*.tsx 2>/dev/null | grep -v "\.test\.tsx" | grep -vE 'min-h-11|min-w-11|aria-hidden' || true)

if [[ "$FINDINGS" -gt 0 ]]; then
  echo
  echo "⚠️  $FINDINGS heuristic finding(s). Triage against mms-ui-ux-design.md §3/§4."
  echo "   Heuristics are advisory — the enforceable gate is the axe spec:"
  echo "     bash $0 full"
  if [[ "${MMS_A11Y_STRICT:-0}" == "1" ]]; then
    exit 1
  fi
  exit 0
fi

echo "✅ Static a11y heuristics clean."
