#!/usr/bin/env bash
# PostgreSQL restore script for MMS.
# Restores a gzipped (.gz) sql backup.
#
# Usage:
#   bash scripts/production/restore-postgres.sh /path/to/backup.sql.gz
#
set -eEuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[MMS-RESTORE]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[MMS-RESTORE-WARN]${NC} $1"; }
log_err() { echo -e "${RED}[MMS-RESTORE-ERR]${NC} $1"; }

trap 'log_err "Failed at line $LINENO: command \"$BASH_COMMAND\" exited with status $?"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${MMS_DEPLOY_ENV:-${ROOT_DIR}/apps/api/.env}"

# 1. Parse input arguments
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-backup-file>"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  log_err "Backup file not found at ${BACKUP_FILE}"
  exit 1
fi

# 2. Read database configuration
source "${ROOT_DIR}/scripts/lib/read-env.sh"

DATABASE_URL="$(read_env_var DATABASE_URL 'postgres://postgres:postgres@localhost:5432/mms')"

if ! command -v psql >/dev/null 2>&1; then
  log_err "psql CLI not found. Please install postgresql-client."
  exit 1
fi

# 3. Stop PM2 service to prevent concurrent write transactions
PM2_PROCESS="mmsv2-backend"
PM2_STOPPED=false

# Load NVM if present so PM2 is in PATH
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
    log_info "Stopping PM2 process: ${PM2_PROCESS}..."
    pm2 stop "$PM2_PROCESS"
    PM2_STOPPED=true
  fi
else
  log_warn "PM2 not found. Continuing without stopping PM2."
fi

# 3.5. Take pre-restore database backup for rollback capability in case of failure
if command -v pg_dump >/dev/null 2>&1; then
  log_info "Creating pre-restore safety backup..."
  TEMP_BACKUP_DIR="/tmp/mms_pre_restore_backups"
  mkdir -p "$TEMP_BACKUP_DIR"
  STAMP_PRE="$(date -u +%Y%m%dT%H%M%SZ)"
  PRE_RESTORE_BACKUP="${TEMP_BACKUP_DIR}/mms-pre-restore-${STAMP_PRE}.sql.gz"
  
  if pg_dump "$DATABASE_URL" | gzip -9 > "$PRE_RESTORE_BACKUP"; then
    echo "Pre-restore safety backup created: ${PRE_RESTORE_BACKUP}"
  else
    echo "WARNING: Pre-restore backup failed. Proceeding with caution..."
    unset PRE_RESTORE_BACKUP
  fi
else
  echo "WARNING: pg_dump not found. Continuing without pre-restore safety backup..."
fi

# 4. Clean target database schema to ensure clean restore
echo "Cleaning schema 'public' in PostgreSQL database..."
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 5. Perform the restore
echo "Restoring PostgreSQL database from backup..."
RESTORE_SUCCESS=true
if [[ "$BACKUP_FILE" == *.gz ]]; then
  if ! (gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" > /dev/null); then
    RESTORE_SUCCESS=false
  fi
else
  if ! (psql "$DATABASE_URL" < "$BACKUP_FILE" > /dev/null); then
    RESTORE_SUCCESS=false
  fi
fi

if [[ "$RESTORE_SUCCESS" == "false" ]]; then
  echo "ERROR: Database restore failed!"
  if [[ -n "${PRE_RESTORE_BACKUP:-}" && -f "$PRE_RESTORE_BACKUP" ]]; then
    echo "Attempting to roll back to pre-restore safety backup..."
    psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    if gunzip -c "$PRE_RESTORE_BACKUP" | psql "$DATABASE_URL" > /dev/null; then
      echo "Rollback successful. Database restored to pre-restore state."
    else
      echo "CRITICAL ERROR: Rollback failed! Database may be in an inconsistent state."
      echo "Please manually restore using the safety backup file: ${PRE_RESTORE_BACKUP}"
    fi
  fi
  
  # Restart PM2 backend process if stopped
  if [[ "$PM2_STOPPED" == "true" ]]; then
    echo "Restarting PM2 process: ${PM2_PROCESS}..."
    pm2 start "$PM2_PROCESS"
  fi
  exit 1
fi

# 6. Restart PM2 backend process if stopped
if [[ "$PM2_STOPPED" == "true" ]]; then
  echo "Restarting PM2 process: ${PM2_PROCESS}..."
  pm2 start "$PM2_PROCESS"
fi

echo "Database restore completed successfully!"
