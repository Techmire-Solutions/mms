# Streamed to the production host by scripts/ci/ssh-exec.sh (ops-audit.yml).
# Runs one allowlisted read-only audit from the deployed build. The server only
# has the compiled dist (prod install, no tsx), so this runs dist/scripts/*.js —
# the same way deploy-on-server.sh runs migrateDb.js.
#
# PGOPTIONS opens every session read-only: PostgreSQL itself rejects any write,
# so the guarantee does not rest on the audit code alone.
#
# The repository is public, so workflow logs are too. Only audits that print counts and fixed
# labels are allowlisted (enrollment-ssot prints student ids; dates prints raw values), and
# AUDIT_REDACT_SAMPLES masks the date audits' sample values down to their shape.
set -euo pipefail

case "${AUDIT:-}" in
  finance-date-columns | date-columns | academic-contract | class-references) ;;
  *) echo "ops-audit: '${AUDIT:-}' is not an allowlisted audit" >&2; exit 2 ;;
esac

cd /var/www/mmsv2/apps/backend
script="dist/scripts/audit-${AUDIT}.js"
[ -f "${script}" ] || { echo "ops-audit: ${script} is not in the deployed build — deploy first" >&2; exit 1; }

echo "=== ${script} @ $(git -C /var/www/mmsv2 rev-parse --short HEAD 2>/dev/null || echo unknown) (read-only session) ==="
AUDIT_REDACT_SAMPLES=1 PGOPTIONS="-c default_transaction_read_only=on" NODE_ENV=production node "${script}"
