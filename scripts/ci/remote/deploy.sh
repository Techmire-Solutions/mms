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

# Inspect space consumers
echo "--- Top Space Consumers ---"
du -h -d 1 /var /home /root 2>/dev/null | sort -hr | head -n 15 || true
du -h -d 1 /var/log 2>/dev/null | sort -hr | head -n 10 || true
du -h -d 2 /var/www/mmsv2 2>/dev/null | sort -hr | head -n 15 || true

# Aggressive disk cleanup when available space on root / is less than 5GB
AVAIL_KB="$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 9999999)"
if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -lt 5242880 ] 2>/dev/null; then
  echo "Notice: low disk space (${AVAIL_KB}KB free) — running aggressive cleanup..."

  # 1. Clean apt cache and autoremove old unneeded packages
  sudo -n apt-get clean 2>/dev/null || true
  sudo -n apt-get autoremove -y 2>/dev/null || true

  # 2. Vacuum systemd journal logs
  sudo -n journalctl --vacuum-time=1d 2>/dev/null || true
  sudo -n journalctl --vacuum-size=50M 2>/dev/null || true

  # 3. Clean rotated log files in /var/log
  sudo -n find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.old" -o -name "*.[0-9]" \) -delete 2>/dev/null || true

  # 4. Truncate oversized log files (>50MB) in /var/log, MMS logs, and PM2 logs
  sudo -n find /var/log -type f -name "*.log" -size +50M -exec truncate -s 10M {} \; 2>/dev/null || true
  find /var/www/mmsv2/.logs -type f -name "*.log" -size +20M -exec truncate -s 5M {} \; 2>/dev/null || true
  pm2 flush 2>/dev/null || sudo -n pm2 flush 2>/dev/null || true
  find ~/.pm2/logs /root/.pm2/logs /home/*/.pm2/logs -type f -name "*.log" -size +20M -exec truncate -s 5M {} \; 2>/dev/null || true

  # 5. Clean tmp directory safely (never delete mms-dist.tar.gz)
  sudo -n find /tmp -mindepth 1 -maxdepth 1 ! -name "mms-dist.tar.gz*" ! -name "systemd-private-*" ! -name ".*-unix" -exec rm -rf {} + 2>/dev/null || true

  # 6. Clean older backups and release archives
  find /var/www/mmsv2/.backups -type f -mtime +2 -delete 2>/dev/null || true
  if [ -d /var/www/mmsv2/.deploy-releases ]; then
    ls -1t /var/www/mmsv2/.deploy-releases/*.tar.gz 2>/dev/null | tail -n +2 | while read -r old; do
      rm -f "$old" "${old}.sha256" "${old%.tar.gz}.env" 2>/dev/null || true
    done
  fi

  # 7. Prune pnpm store & build cache
  pnpm store prune 2>/dev/null || true
  rm -rf /var/www/mmsv2/node_modules/.cache 2>/dev/null || true

  # 8. Clean docker if installed
  if command -v docker >/dev/null 2>&1; then
    docker system prune -af --volumes 2>/dev/null || sudo -n docker system prune -af --volumes 2>/dev/null || true
  fi

  echo "--- Disk space after cleanup ---"
  df -h / || true
fi

# Pre-deploy PostgreSQL health check
DB_URL="$(grep '^DATABASE_URL=' apps/backend/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"\r' || true)"
if command -v pg_isready >/dev/null 2>&1; then
  CHECK_CMD="pg_isready"
  if [ -n "$DB_URL" ]; then
    CHECK_CMD="pg_isready -d $DB_URL"
  fi

  if ! $CHECK_CMD >/dev/null 2>&1; then
    echo "Notice: PostgreSQL is not accepting connections (pg_isready exit code $?)."
    echo "--- PostgreSQL Service Status ---"
    systemctl status postgresql --no-pager 2>/dev/null || sudo -n systemctl status postgresql --no-pager 2>/dev/null || true
    echo "--- Recent PostgreSQL Logs ---"
    sudo -n journalctl -u 'postgresql*' -n 50 --no-pager 2>/dev/null || sudo -n tail -n 50 /var/log/postgresql/*.log 2>/dev/null || true

    # Check if a standby.signal exists without an active replica configuration
    echo "--- Standby/Recovery Signal Check ---"
    SIGNAL_FILES="$(find /var/lib/postgresql/ -name "*signal*" 2>/dev/null || sudo -n find /var/lib/postgresql/ -name "*signal*" 2>/dev/null || true)"
    if [ -n "$SIGNAL_FILES" ]; then
      echo "Found signal files: ${SIGNAL_FILES}"
    fi

    echo "Restarting PostgreSQL now that disk space is available..."
    sudo -n systemctl restart postgresql 2>/dev/null || systemctl restart postgresql 2>/dev/null || true
    sudo -n systemctl restart 'postgresql*' 2>/dev/null || true

    # Wait up to 30s for recovery/startup to finish
    for i in $(seq 1 15); do
      if $CHECK_CMD >/dev/null 2>&1; then
        echo "PostgreSQL is now ready and accepting connections."
        break
      fi
      echo "Waiting for PostgreSQL to accept connections ($((i*2))s)..."
      sleep 2
    done

    if ! $CHECK_CMD >/dev/null 2>&1; then
      echo "::warning::PostgreSQL still not accepting connections after restart attempt."
      sudo -n journalctl -u 'postgresql*' -n 30 --no-pager 2>/dev/null || sudo -n tail -n 30 /var/log/postgresql/*.log 2>/dev/null || true
    fi
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
