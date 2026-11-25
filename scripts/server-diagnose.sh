#!/usr/bin/env bash
# Quick production diagnostics — run on the Hetzner host over SSH.
# Usage: bash scripts/server-diagnose.sh [apps/api/.env]
set -uo pipefail

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
FRONTEND_PORT="$MMS_PROD_FRONTEND_PORT"

BACKEND_PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
FRONTEND_PORT="$(read_env_var FRONTEND_PORT "$MMS_PROD_FRONTEND_PORT" "$ENV_FILE")"
if ! assert_production_backend_port "$BACKEND_PORT" "Backend PORT in ${ENV_FILE}"; then
  echo "Fix: bash scripts/merge-backend-env.sh ${ENV_FILE}"
fi

echo "══ MMS server diagnose ══"
echo "Root: ${ROOT_DIR}"
echo "Node: $(node -v 2>/dev/null || echo 'missing')"
echo "pnpm: $(pnpm -v 2>/dev/null || echo 'missing')"
APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN '' "$ENV_FILE")"
echo "MMS_APP_DOMAIN: ${APP_DOMAIN:-<NOT SET — tenant subdomains will not work>}"
echo "PORT: ${BACKEND_PORT}"
DEPLOYED_SHA="$(cat "${ROOT_DIR}/.deploy-current-sha" 2>/dev/null || echo 'unknown')"
echo "Deployed SHA: ${DEPLOYED_SHA}"
echo ""

echo "── PM2 ──"
pm2 status 2>/dev/null || echo "pm2 not available"
echo ""

echo "── Local ports ──"
if curl_local_backend_ok "http://127.0.0.1:${BACKEND_PORT}/" "$APP_DOMAIN" \
  || curl_local_backend_ok "http://127.0.0.1:${BACKEND_PORT}/health" "$APP_DOMAIN"; then
  echo "port ${BACKEND_PORT} (backend + SPA): responding"
else
  echo "port ${BACKEND_PORT} (backend + SPA): NOT responding"
fi
echo ""

echo "── Redis ──"
if command -v redis-cli &>/dev/null; then
  REDIS_PING="$(redis-cli ping 2>/dev/null || echo 'FAILED')"
  echo "redis-cli ping: ${REDIS_PING}"
else
  echo "redis-cli: not installed or not in PATH"
fi
echo ""

echo "── Backend health ──"
curl_local_backend "http://127.0.0.1:${BACKEND_PORT}/health" "$APP_DOMAIN" || echo "backend /health failed"
echo ""
curl_local_backend "http://127.0.0.1:${BACKEND_PORT}/ready" "$APP_DOMAIN" || echo "backend /ready failed"
echo ""

echo "── Workspace registry (first 1.5k) ──"
curl_local_backend "http://127.0.0.1:${BACKEND_PORT}/api/workspace/registry" "$APP_DOMAIN" | head -c 1500 || echo "registry failed"
echo ""
echo ""

if [[ -n "$APP_DOMAIN" ]] && [[ -f "$ROOT_DIR/scripts/verify-tenant-hosts.sh" ]]; then
  echo "── Tenant subdomain checks ──"
  bash "$ROOT_DIR/scripts/verify-tenant-hosts.sh" "" "$ENV_FILE" || true
  echo ""
fi

DATABASE_URL="$(read_env_var DATABASE_URL '' "$ENV_FILE")"
if [[ -n "$DATABASE_URL" ]] && command -v psql &>/dev/null; then
  echo "── Workspace module grants (DB) ──"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -c \
    "SELECT subdomain, granted_modules, enabled_modules FROM workspaces ORDER BY subdomain;" \
    2>/dev/null | head -50 || echo "psql query failed"
  echo ""
else
  echo "── Workspace module grants ──"
  echo "skipped (no DATABASE_URL or psql)"
  echo ""
fi

echo "── Recent backend logs ──"
pm2 logs mmsv2-backend --lines 20 --nostream 2>/dev/null || true
echo ""
echo "── Recent worker logs ──"
pm2 logs mmsv2-worker --lines 20 --nostream 2>/dev/null || true
