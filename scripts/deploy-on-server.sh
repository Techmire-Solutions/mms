#!/usr/bin/env bash
# Hetzner deploy — invoked from .github/workflows/deploy.yml over SSH.
# Expects /tmp/mms-dist.tar.gz (and optional .sha256). Pins git to DEPLOY_SHA when set.
set +e

ROOT_DIR="${MMS_DEPLOY_ROOT:-/var/www/mmsv2}"
TARBALL="${MMS_DEPLOY_TARBALL:-/tmp/mms-dist.tar.gz}"
ENV_FILE="${MMS_DEPLOY_ENV:-apps/backend/.env}"
LOCK_HASH_FILE="${ROOT_DIR}/.deploy-lock-hash"
APACHE_FP_FILE="${ROOT_DIR}/.deploy-apache-fingerprint"
RELEASES_DIR="${ROOT_DIR}/.deploy-releases"
RELEASE_KEEP="${MMS_DEPLOY_RELEASE_KEEP:-5}"
# Node floor matches package.json engines (>=24.14) and CI (Node 24).
MMS_NODE_MAJOR_MIN="${MMS_NODE_MAJOR_MIN:-24}"

cd "$ROOT_DIR" || { echo "FATAL: cannot cd to ${ROOT_DIR}"; exit 1; }

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

FAILED_PREFLIGHT_FILE="${ROOT_DIR}/.deploy-preflight-failed"
ENV_BACKUP=""

# A failed preflight used to leave the new `.env` in place. The running
# processes kept the old env, but any restart (including the automated
# rollback's PM2 reload) picked up the new mode and could fail to boot.
# Snapshot the env before merging and restore it on any failed exit.
restore_env_and_cleanup() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
    if cp -p "$ENV_BACKUP" "$ENV_FILE"; then
      echo "Restored ${ENV_FILE} from the pre-deploy snapshot after a failed deploy."
    else
      echo "ERROR: could not restore ${ENV_FILE} from ${ENV_BACKUP}"
    fi
  fi
  if [ -n "$ENV_BACKUP" ]; then
    rm -f "$ENV_BACKUP"
  fi
  exit "$status"
}
trap restore_env_and_cleanup EXIT
rm -f "$FAILED_PREFLIGHT_FILE"

fail_preflight() {
  touch "$FAILED_PREFLIGHT_FILE" 2>/dev/null || true
  exit 1
}

export GIT_TERMINAL_PROMPT=0

# Pin to the CI-validated SHA when provided; otherwise pull main tip (manual fallback).
# scripts/ci/remote/deploy.sh also checks out DEPLOY_SHA before invoking this script
# so the latest scripts are on disk for the current run. The repo is public, so
# fetches are anonymous.
if [ -n "${DEPLOY_SHA:-}" ]; then
  CURRENT="$(git rev-parse HEAD 2>/dev/null || true)"
  if [ "$CURRENT" != "$DEPLOY_SHA" ]; then
    echo "Checking out DEPLOY_SHA=${DEPLOY_SHA}"
    git fetch --depth=1 origin "${DEPLOY_SHA}" 2>/dev/null \
      || git fetch origin "${DEPLOY_SHA}" 2>/dev/null \
      || git fetch origin 2>/dev/null \
      || true
    if ! git checkout --detach "${DEPLOY_SHA}" 2>/dev/null; then
      echo "WARNING: git checkout ${DEPLOY_SHA} failed or skipped (proceeding with workspace files)"
    fi
  else
    echo "Already at DEPLOY_SHA=${DEPLOY_SHA}"
  fi
else
  echo "WARNING: DEPLOY_SHA unset — falling back to origin/main tip"
  git fetch origin main 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || true
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || nvm use stable >/dev/null 2>&1 || true
fi
export PATH="$HOME/.local/share/pnpm:$PATH"
export PUPPETEER_SKIP_DOWNLOAD=true
export CI=true

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt "${MMS_NODE_MAJOR_MIN}" ] 2>/dev/null; then
  echo "WARNING: Node $(node -v 2>/dev/null || echo unknown) — MMS requires Node >= ${MMS_NODE_MAJOR_MIN} (engines >=24.14)"
fi

if [ -f "$TARBALL" ]; then
  if [ -f "${TARBALL}.sha256" ]; then
    echo "Verifying tarball checksum..."
    (
      cd "$(dirname "$TARBALL")" || exit 1
      sha256sum -c "$(basename "$TARBALL").sha256"
    ) || {
      echo "FATAL: tarball checksum mismatch"
      exit 1
    }
  fi

  # Retain release tarball for rollback (best-effort).
  mkdir -p "$RELEASES_DIR"
  RELEASE_NAME="${DEPLOY_SHA:-$(date -u +%Y%m%dT%H%M%SZ)}"
  cp -f "$TARBALL" "${RELEASES_DIR}/${RELEASE_NAME}.tar.gz" 2>/dev/null || true
  if [ -f "${TARBALL}.sha256" ]; then
    EXPECTED_HASH="$(awk '{print $1}' "${TARBALL}.sha256")"
    printf '%s  %s\n' "$EXPECTED_HASH" "${RELEASE_NAME}.tar.gz" > "${RELEASES_DIR}/${RELEASE_NAME}.tar.gz.sha256" 2>/dev/null || true
  fi
  # Prune older releases (keep newest N by mtime).
  if [ -d "$RELEASES_DIR" ]; then
    # shellcheck disable=SC2012
    ls -1t "$RELEASES_DIR"/*.tar.gz 2>/dev/null | tail -n "+$((RELEASE_KEEP + 1))" | while read -r old; do
      rm -f "$old" "${old}.sha256" "${old%.tar.gz}.env" 2>/dev/null || true
    done
  fi

  echo "Extracting production dist..."
  rm -rf "${ROOT_DIR}/apps/frontend/dist" "${ROOT_DIR}/apps/backend/dist"
  tar xzf "$TARBALL" -C "$ROOT_DIR"
  if [ $? -ne 0 ]; then
    echo "FATAL: tar extract failed"
    exit 1
  fi
  rm -f "$TARBALL" "${TARBALL}.sha256"
else
  echo "No tarball found at ${TARBALL} — checking pre-extracted dist folders..."
  if [ ! -d "${ROOT_DIR}/apps/backend/dist" ] || [ ! -d "${ROOT_DIR}/apps/frontend/dist" ]; then
    echo "FATAL: missing pre-built dist directories (apps/backend/dist, apps/frontend/dist) and no tarball at ${TARBALL}"
    exit 1
  fi
fi

if [ -f scripts/merge-backend-env.sh ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "FATAL: ${ENV_FILE} is missing — cannot snapshot it before merging."
    exit 1
  fi
  if ! ENV_BACKUP_TMP="$(mktemp "${ENV_FILE}.pre-deploy.XXXXXX")"; then
    echo "FATAL: could not create a pre-deploy env snapshot."
    exit 1
  fi
  if ! cp -p "$ENV_FILE" "$ENV_BACKUP_TMP"; then
    rm -f "$ENV_BACKUP_TMP"
    echo "FATAL: could not copy ${ENV_FILE} to the pre-deploy snapshot."
    exit 1
  fi
  chmod 600 "$ENV_BACKUP_TMP" 2>/dev/null || true
  # Only arm the trap once the copy is complete; an empty temp file must never
  # overwrite the live env on the failure path.
  ENV_BACKUP="$ENV_BACKUP_TMP"
  bash scripts/merge-backend-env.sh "$ENV_FILE"
else
  echo "WARNING: scripts/merge-backend-env.sh missing — skip env merge"
fi

# Prod install only when lockfile changed (or forced / first deploy).
LOCKFILE="${ROOT_DIR}/pnpm-lock.yaml"
CURRENT_LOCK_HASH=""
if [ -f "$LOCKFILE" ]; then
  CURRENT_LOCK_HASH="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
fi
PREV_LOCK_HASH=""
if [ -f "$LOCK_HASH_FILE" ]; then
  PREV_LOCK_HASH="$(tr -d '[:space:]' < "$LOCK_HASH_FILE")"
fi

if [ "${MMS_FORCE_PNPM_INSTALL:-0}" = "1" ] \
  || [ -z "$CURRENT_LOCK_HASH" ] \
  || [ "$CURRENT_LOCK_HASH" != "$PREV_LOCK_HASH" ]; then
  echo "Running pnpm install --prod --frozen-lockfile (lockfile changed or forced)"
  pnpm install --prod --frozen-lockfile
  if [ $? -ne 0 ]; then
    echo "FATAL: pnpm install --prod failed"
    if [ -f scripts/server-diagnose.sh ]; then
      bash scripts/server-diagnose.sh "$ENV_FILE" || true
    fi
    exit 1
  fi
  echo "Pruning unreferenced packages from pnpm store to free up disk space..."
  pnpm store prune
  if [ -n "$CURRENT_LOCK_HASH" ]; then
    printf '%s\n' "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE"
  fi
else
  echo "Skipping pnpm install — pnpm-lock.yaml unchanged (${CURRENT_LOCK_HASH:0:12}…)"
fi

export PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
export NODE_ENV=production
export MMS_DB_ROLE_ENFORCEMENT="$(read_env_var MMS_DB_ROLE_ENFORCEMENT "strict" "$ENV_FILE")"
assert_production_backend_port "$PORT" "Deploy PORT" || exit 1

# RLS preflight: a role that bypasses row-level security makes every tenant
# policy inert. The check and the mode policy both run before migrations and the
# PM2 reload, so the previous release keeps serving when either fails. `warn`
# and `off` are accepted only with their explicit overrides.
export DATABASE_URL="$(read_env_var DATABASE_URL "" "$ENV_FILE")"
if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is missing from ${ENV_FILE} — cannot verify RLS."
  fail_preflight
fi
if [ -f "$ROOT_DIR/apps/backend/dist/scripts/checkRlsRole.js" ]; then
  echo "Checking database role for RLS enforcement (mode=${MMS_DB_ROLE_ENFORCEMENT})..."
  if ! (cd "$ROOT_DIR/apps/backend" && node dist/scripts/checkRlsRole.js); then
    echo "ERROR: RLS preflight failed — the database role bypasses row-level security."
    echo "       Provision mms_app and point DATABASE_URL at it (docs/rls-operations.md),"
    echo "       then redeploy. The running release has NOT been replaced."
    fail_preflight
  fi
elif [ -f "$ROOT_DIR/apps/backend/src/scripts/checkRlsRole.ts" ]; then
  echo "Checking database role for RLS enforcement (tsx fallback)..."
  if ! (cd "$ROOT_DIR/apps/backend" && node --experimental-strip-types src/scripts/checkRlsRole.ts); then
    echo "ERROR: RLS preflight failed — the database role bypasses row-level security."
    echo "       Provision mms_app and point DATABASE_URL at it (docs/rls-operations.md),"
    echo "       then redeploy. The running release has NOT been replaced."
    fail_preflight
  fi
else
  echo "ERROR: checkRlsRole script not found — cannot verify RLS. Refusing to deploy."
  echo "       The running release has NOT been replaced; restore the backend build and redeploy."
  fail_preflight
fi
if ! node "$ROOT_DIR/scripts/ci/rls-deploy-policy.mjs" \
  --mode "${MMS_DB_ROLE_ENFORCEMENT:-}" \
  --allow-warn "${MMS_ALLOW_RLS_WARN:-0}" \
  --allow-off "${MMS_ALLOW_RLS_OFF:-0}"; then
  echo "ERROR: RLS enforcement policy rejected mode=${MMS_DB_ROLE_ENFORCEMENT}."
  echo "       Provision mms_app and set strict (docs/rls-operations.md), or set the"
  echo "       documented override, then redeploy. The running release has NOT been replaced."
  fail_preflight
fi

mkdir -p "$ROOT_DIR/.logs"
# Legacy vite-preview PM2 app — SPA is served by Fastify from apps/frontend/dist.
pm2 delete mmsv2-frontend 2>/dev/null || true

# Apply schema DDL + data migrations BEFORE swapping the backend over.
#
# initDb() still runs them on startup as a safety net, but doing it here means a
# failing or slow migration fails the deploy while the previous release is still
# serving, instead of taking the API down mid-restart. The runner is idempotent
# (Drizzle tracks applied DDL; data migrations are guarded by an advisory lock
# and a `data_migrations` ledger), so re-running it on boot is harmless.
if [ -f "$ROOT_DIR/apps/backend/dist/scripts/migrateDb.js" ]; then
  echo "Applying database migrations (pre-restart)..."
  if ! (cd "$ROOT_DIR/apps/backend" && node dist/scripts/migrateDb.js); then
    echo "ERROR: database migration failed — leaving the running release in place"
    exit 1
  fi
  echo "Migrations applied."
else
  echo "Notice: dist/scripts/migrateDb.js not found — migrations will run on backend startup."
fi

if [ -f "$ROOT_DIR/ecosystem.config.cjs" ]; then
  pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --update-env \
    || {
      pm2 restart mmsv2-backend --update-env 2>/dev/null || true
      pm2 restart mmsv2-worker --update-env 2>/dev/null || true
    }
else
  pm2 restart mmsv2-backend --update-env 2>/dev/null || pm2 restart mmsv2-backend 2>/dev/null || true
  pm2 restart mmsv2-worker --update-env 2>/dev/null || true
fi
pm2 save 2>/dev/null || true

DEPLOY_OK=true

if [ -f scripts/deploy-recover-backend.sh ]; then
  bash scripts/deploy-recover-backend.sh "$ENV_FILE" || {
    echo "ERROR: backend recovery failed"
    DEPLOY_OK=false
    pm2 logs mmsv2-backend --lines 50 --nostream || true
  }
fi

# Migrations were applied above; initDb() re-checks on startup and is idempotent.

APP_DOMAIN_FOR_FP="$(read_env_var MMS_APP_DOMAIN '' "$ENV_FILE")"
if [[ -z "$APP_DOMAIN_FOR_FP" && -n "${MMS_APP_DOMAIN:-}" ]]; then
  APP_DOMAIN_FOR_FP="${MMS_APP_DOMAIN}"
fi

compute_apache_fingerprint() {
  local domain="$1"
  local port="$2"
  local conf_hash="missing"
  local candidate
  for candidate in \
    /etc/apache2/sites-enabled/000-mmsv2.conf \
    /etc/apache2/sites-enabled/mmsv2.conf \
    /etc/apache2/sites-available/000-mmsv2.conf; do
    if [ -f "$candidate" ]; then
      conf_hash="$(sha256sum "$candidate" | awk '{print $1}')"
      break
    fi
  done
  printf '%s|%s|%s\n' "$domain" "$port" "$conf_hash"
}

CURRENT_APACHE_FP="$(compute_apache_fingerprint "$APP_DOMAIN_FOR_FP" "$PORT")"
PREV_APACHE_FP=""
if [ -f "$APACHE_FP_FILE" ]; then
  PREV_APACHE_FP="$(tr -d '\r' < "$APACHE_FP_FILE" | head -1)"
fi

RUN_APACHE=false
if [ "${MMS_FORCE_APACHE:-0}" = "1" ] || [ "$CURRENT_APACHE_FP" != "$PREV_APACHE_FP" ]; then
  RUN_APACHE=true
  echo "Apache config fingerprint changed (or forced) — running isolate/install/fix"
else
  echo "Skipping Apache suite — fingerprint unchanged"
fi

if [ "$RUN_APACHE" = true ]; then
  if [ -f scripts/apache/isolate-mms-vhost.sh ]; then
    bash scripts/apache/isolate-mms-vhost.sh "$ENV_FILE" || {
      echo "ERROR: failed to strip MMS proxy from non-MMS Apache vhosts"
      DEPLOY_OK=false
    }
  fi

  if [ -f scripts/apache/install-mms-vhost.sh ]; then
    bash scripts/apache/install-mms-vhost.sh "$ENV_FILE" || {
      echo "WARNING: MMS vhost install failed — ensure 000-mmsv2.conf exists for ${APP_DOMAIN_FOR_FP:-MMS_APP_DOMAIN}"
    }
  fi

  if [ -f scripts/fix-apache-upstream.sh ]; then
    bash scripts/fix-apache-upstream.sh "$ENV_FILE" || {
      echo "ERROR: Apache upstream patch failed — ProxyPass must point to :${MMS_PROD_BACKEND_PORT}"
      DEPLOY_OK=false
    }
  fi

  if [ "$DEPLOY_OK" = true ]; then
    # Recompute after install (conf hash may have changed intentionally).
    CURRENT_APACHE_FP="$(compute_apache_fingerprint "$APP_DOMAIN_FOR_FP" "$PORT")"
    printf '%s\n' "$CURRENT_APACHE_FP" > "$APACHE_FP_FILE"
  fi
fi

# Local health gate. Public apex verify is owned by deploy.yml (set MMS_DEPLOY_SKIP_PUBLIC_VERIFY=1).
if [ -f scripts/deploy-verify.sh ]; then
  if bash scripts/deploy-verify.sh "$ENV_FILE"; then
    DEPLOY_OK=true
  else
    DEPLOY_OK=false
  fi
fi

pm2 save 2>/dev/null || true

if [ -n "${DEPLOY_SHA:-}" ]; then
  printf '%s\n' "$DEPLOY_SHA" > "${ROOT_DIR}/.deploy-current-sha"
fi

if [ "$DEPLOY_OK" != true ]; then
  echo "FATAL: MMS deploy finished but services are not healthy"
  if [ -f scripts/server-diagnose.sh ]; then
    bash scripts/server-diagnose.sh "$ENV_FILE" || true
  fi
  exit 1
fi

rm -f "$FAILED_PREFLIGHT_FILE"
if [ -n "${RELEASE_NAME:-}" ]; then
  if cp -p "$ENV_FILE" "${RELEASES_DIR}/${RELEASE_NAME}.env" 2>/dev/null; then
    echo "Saved env snapshot for release ${RELEASE_NAME}."
  else
    echo "WARNING: could not save env snapshot for release ${RELEASE_NAME}; rollback will keep the current env."
  fi
fi

echo "MMSv2 deploy finished — services healthy"
if [ -n "${DEPLOY_SHA:-}" ]; then
  echo "Deployed SHA: ${DEPLOY_SHA}"
fi
exit 0
