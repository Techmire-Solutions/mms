#!/usr/bin/env bash
# PostgreSQL backup for MMS — schedule via cron (daily 03:00 recommended).
# Usage: bash scripts/production/backup-postgres.sh
set -eEuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[MMS-BACKUP]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[MMS-BACKUP-WARN]${NC} $1"; }
log_err() { echo -e "${RED}[MMS-BACKUP-ERR]${NC} $1"; }

trap 'log_err "Failed at line $LINENO: command \"$BASH_COMMAND\" exited with status $?"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${MMS_DEPLOY_ENV:-${ROOT_DIR}/apps/api/.env}"
BACKUP_DIR="${MMS_BACKUP_DIR:-${ROOT_DIR}/.backups/postgres}"
RETENTION_DAYS="${MMS_BACKUP_RETENTION_DAYS:-14}"

source "${ROOT_DIR}/scripts/lib/read-env.sh"

DATABASE_URL="$(read_env_var DATABASE_URL 'postgres://postgres:postgres@localhost:5432/mms')"
mkdir -p "$BACKUP_DIR"

if ! command -v pg_dump >/dev/null 2>&1; then
  log_err "pg_dump CLI not found. Please install postgresql-client."
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/mms-${STAMP}.sql.gz"

log_info "Starting PostgreSQL backup..."
pg_dump "$DATABASE_URL" | gzip -9 > "$OUT_FILE"

log_info "Backup written: ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'mms-*.sql.gz' -type f -mtime +"${RETENTION_DAYS}" -delete 2>/dev/null || true
log_info "Retention cleanup completed (kept last ${RETENTION_DAYS} days)."

OFFSITE_TARGET="${MMS_BACKUP_OFFSITE_TARGET:-}"
if [[ -n "$OFFSITE_TARGET" ]]; then
  log_info "Syncing backup to offsite target: ${OFFSITE_TARGET}..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -avz "$OUT_FILE" "$OFFSITE_TARGET"
    log_info "Offsite sync completed successfully."
  elif command -v scp >/dev/null 2>&1; then
    scp "$OUT_FILE" "$OFFSITE_TARGET"
    log_info "Offsite scp completed successfully."
  else
    log_warn "Neither rsync nor scp found; skipped offsite sync."
  fi
fi
