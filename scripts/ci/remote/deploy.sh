# Streamed to the production host by scripts/ci/ssh-exec.sh (deploy.yml).
# Pins the checkout to DEPLOY_SHA so this run's server scripts are on disk,
# then hands over to scripts/deploy-on-server.sh. The repo is public, so the
# fetch is anonymous — no GitHub token is sent to the server.
set -e
export GIT_TERMINAL_PROMPT=0
cd /var/www/mmsv2

echo "=== Host Diagnostics & Pre-Deploy Health ==="
df -h / /var /tmp 2>/dev/null || true
free -m 2>/dev/null || true

# Check for low disk space (< 2GB free on / or /var/www/mmsv2) and clean up
AVAIL_KB="$(df -k /var/www/mmsv2 2>/dev/null | awk 'NR==2 {print $4}' || echo 9999999)"
if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -lt 2097152 ] 2>/dev/null; then
  echo "Notice: low disk space (${AVAIL_KB}KB free) — running pre-deploy cleanup..."
  rm -rf /tmp/mms-* /tmp/*.sql* 2>/dev/null || true
  sudo -n journalctl --vacuum-size=50M 2>/dev/null || true
fi

# Pre-deploy PostgreSQL health check
DB_URL="$(grep '^DATABASE_URL=' apps/backend/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"\r' || true)"
if [ -n "$DB_URL" ] && command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -d "$DB_URL" >/dev/null 2>&1; then
    echo "Notice: PostgreSQL is not accepting connections (pg_isready exit code $?)."
    echo "--- PostgreSQL Service Status ---"
    systemctl status postgresql --no-pager 2>/dev/null || sudo -n systemctl status postgresql --no-pager 2>/dev/null || true
    echo "--- Recent PostgreSQL Logs ---"
    sudo -n journalctl -u postgresql -n 30 --no-pager 2>/dev/null || tail -n 30 /var/log/postgresql/*.log 2>/dev/null || true

    # Check if a standby.signal exists without an active replica configuration
    echo "--- Standby/Recovery Signal Check ---"
    SIGNAL_FILES="$(find /var/lib/postgresql/ -name "*signal*" 2>/dev/null || sudo -n find /var/lib/postgresql/ -name "*signal*" 2>/dev/null || true)"
    if [ -n "$SIGNAL_FILES" ]; then
      echo "Found signal files: ${SIGNAL_FILES}"
    fi

    echo "Attempting PostgreSQL restart to clear transient recovery locks..."
    sudo -n systemctl restart postgresql 2>/dev/null || systemctl restart postgresql 2>/dev/null || true

    # Wait up to 30s for recovery/startup to finish
    for i in $(seq 1 15); do
      if pg_isready -d "$DB_URL" >/dev/null 2>&1; then
        echo "PostgreSQL is now ready and accepting connections."
        break
      fi
      echo "Waiting for PostgreSQL to accept connections ($((i*2))s)..."
      sleep 2
    done
  else
    echo "PostgreSQL is ready and accepting connections."
  fi
fi

if [ -n "${DEPLOY_SHA:-}" ]; then
  git fetch --depth=1 origin "${DEPLOY_SHA}" 2>/dev/null \
    || git fetch origin "${DEPLOY_SHA}" 2>/dev/null \
    || git fetch origin 2>/dev/null \
    || true
  git checkout --detach "${DEPLOY_SHA}" 2>/dev/null \
    || echo 'Notice: git checkout skipped (using current workspace state)'
fi

bash scripts/deploy-on-server.sh < /dev/null
