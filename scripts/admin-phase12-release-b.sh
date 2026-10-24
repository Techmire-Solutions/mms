#!/usr/bin/env bash
# Phase 12 release B gate: verify, then apply migration 0182 (the irreversible drop).
#
# Run on the production host, from the repository root, with apps/backend/.env in place:
#   bash scripts/admin-phase12-release-b.sh            # verify only, change nothing
#   bash scripts/admin-phase12-release-b.sh --apply    # verify, then migrate and reload
#
# Stops at the first failure. Nothing is dropped unless every check passes AND --apply is given.
# Migration 0182 repeats the same checks inside its own transaction, so a direct `db:migrate` is
# guarded too; this script exists to fail early, before anything is touched.
set -euo pipefail

APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."

step() { printf '\n[release-b] == %s ==\n' "$1"; }
fail() { printf '\n[release-b] ABORTED: %s\n' "$1" >&2; exit 1; }

[ -f apps/backend/.env ] || fail "apps/backend/.env not found - run this on the server, from the repo root."

step "1/3 pre-flight audit (release A applied, dates converted, indexes valid)"
# audit:academic-contract exits non-zero when any blocking count is above 0, and its first check
# fails outright if release A has not been applied.
pnpm --filter mms-backend audit:academic-contract \
  || fail "pre-flight audit reported blocking rows - fix them and re-run. Nothing was changed."

if [ "$APPLY" -ne 1 ]; then
  step "2/3 dry run complete - nothing was changed"
  cat <<'EOF'

[release-b] All checks passed. NOTHING was changed.
[release-b]
[release-b] Applying 0182 permanently drops:
[release-b]   sessions.type, session_class_timetable_periods.subject, exams.subject
[release-b]   attendance.date, enrollments.enrolled_date
[release-b]   students.registered_date, students.enrollment_date
[release-b]   session_lookups rows of kind 'types'
[release-b]   table student_enrolled_sessions
[release-b]
[release-b] THERE IS NO ROLLBACK for these columns except restoring a backup.
[release-b] Take a backup, then re-run with --apply.
EOF
  exit 0
fi

step "2/3 applying migration 0182"
echo "[release-b] The guard inside 0182 re-checks every precondition and aborts the transaction"
echo "[release-b] if any of them fails, so this is safe to run."
bash scripts/admin-migrate-and-reload.sh

step "3/3 done"
echo "[release-b] 0182 applied. Verify: curl -fsS http://127.0.0.1:5002/ready"
