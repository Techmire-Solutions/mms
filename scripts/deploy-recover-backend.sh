#!/usr/bin/env bash
# Re-create mmsv2-backend when restart leaves /health down.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"
# shellcheck source=lib/curl-local-backend.sh
source "$ROOT_DIR/scripts/lib/curl-local-backend.sh"

ENV_FILE="${1:-apps/api/.env}"
BACKEND_PORT="$MMS_PROD_BACKEND_PORT"
DIST_ENTRY="apps/api/dist/index.js"
ECOSYSTEM="$ROOT_DIR/ecosystem.config.cjs"

BACKEND_PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN '' "$ENV_FILE")"
if [[ -z "$APP_DOMAIN" && -n "${MMS_APP_DOMAIN:-}" ]]; then
  APP_DOMAIN="${MMS_APP_DOMAIN}"
fi
assert_production_backend_port "$BACKEND_PORT" "Backend recovery PORT" || exit 1

curl_health() {
  curl_local_backend_ok "http://127.0.0.1:${BACKEND_PORT}/health" "$APP_DOMAIN" \
    || curl_local_backend_ok "http://localhost:${BACKEND_PORT}/health" "$APP_DOMAIN"
}

curl_ready() {
  curl_local_backend_ok "http://127.0.0.1:${BACKEND_PORT}/ready" "$APP_DOMAIN" \
    || curl_local_backend_ok "http://localhost:${BACKEND_PORT}/ready" "$APP_DOMAIN"
}

if curl_health && curl_ready; then
  echo "Backend already healthy on port ${BACKEND_PORT}"
  exit 0
fi

echo "Waiting for backend after pm2 restart..."
for i in $(seq 1 90); do
  if curl_health && curl_ready; then
    echo "Backend health+ready OK on port ${BACKEND_PORT} ($(( i * 2 ))s)"
    exit 0
  fi
  if (( i % 5 == 0 )); then
    echo "Waiting for backend on port ${BACKEND_PORT}... ($(( i * 2 ))s elapsed)"
  fi
  sleep 2
done

if [[ ! -f "$DIST_ENTRY" ]]; then
  echo "ERROR: ${DIST_ENTRY} missing — run pnpm run build first"
  exit 1
fi

mkdir -p "$ROOT_DIR/.logs"
export PORT="$BACKEND_PORT"
export NODE_ENV=production

echo "Recovering mmsv2-backend (port ${BACKEND_PORT})..."
if [[ -f "$ECOSYSTEM" ]]; then
  pm2 delete mmsv2-backend 2>/dev/null || true
  pm2 startOrReload "$ECOSYSTEM" --only mmsv2-backend --update-env
else
  pm2 delete mmsv2-backend 2>/dev/null || true
  pm2 start "$DIST_ENTRY" \
    --name mmsv2-backend \
    --cwd "$ROOT_DIR" \
    --update-env \
    --time \
    -e "PORT=${BACKEND_PORT}" \
    -e "NODE_ENV=production"
fi

for i in $(seq 1 90); do
  if curl_health && curl_ready; then
    echo "Backend recovered — health+ready OK on port ${BACKEND_PORT} ($(( i * 2 ))s)"
    pm2 save 2>/dev/null || true
    exit 0
  fi
  if (( i % 5 == 0 )); then
    echo "Waiting for recovered backend on port ${BACKEND_PORT}... ($(( i * 2 ))s elapsed)"
  fi
  sleep 2
done

echo "ERROR: backend recovery failed"
pm2 describe mmsv2-backend 2>/dev/null || true
pm2 logs mmsv2-backend --lines 50 --nostream 2>/dev/null || true
exit 1
