#!/usr/bin/env bash
# Restrict MMS to MMS_APP_DOMAIN Apache vhost only — run on Hetzner (SSH or GitHub Actions).
set -eEuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[MMS-ISOLATION]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[MMS-ISOLATION-WARN]${NC} $1"; }
log_err() { echo -e "${RED}[MMS-ISOLATION-ERR]${NC} $1"; }

trap 'log_err "Failed at line $LINENO: command \"$BASH_COMMAND\" exited with status $?"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
ENV_FILE="${1:-apps/api/.env}"

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

log_info "══ MMS host isolation (MMS only on MMS_APP_DOMAIN) ══"

if [ -f scripts/merge-backend-env.sh ]; then
  bash scripts/merge-backend-env.sh "$ENV_FILE"
fi

APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN "${MMS_APP_DOMAIN:-}" "$ENV_FILE")"
if [[ -z "$APP_DOMAIN" ]]; then
  log_err "MMS_APP_DOMAIN must be set (e.g. mmsv2.aabtaab.com)"
  exit 1
fi
log_info "MMS_APP_DOMAIN=${APP_DOMAIN}"

TRUST_PROXY_VAL="$(read_env_var TRUST_PROXY "" "$ENV_FILE")"
if [[ -z "$TRUST_PROXY_VAL" ]]; then
  echo 'TRUST_PROXY="127.0.0.1,::1"' >> "$ENV_FILE"
  log_info "Configured default TRUST_PROXY=\"127.0.0.1,::1\" in $ENV_FILE"
fi

bash scripts/apache/isolate-mms-vhost.sh "$ENV_FILE"
# Honour caller override (e.g. MMS_REQUIRE_WILDCARD_TLS=0 via GH secret) — default 1.
export MMS_REQUIRE_WILDCARD_TLS="${MMS_REQUIRE_WILDCARD_TLS:-1}"
bash scripts/apache/install-mms-vhost.sh "$ENV_FILE"
bash scripts/fix-apache-upstream.sh "$ENV_FILE"

export PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
export NODE_ENV=production
assert_production_backend_port "$PORT" "Backend PORT" || exit 1

if [ -f scripts/deploy-recover-backend.sh ]; then
  bash scripts/deploy-recover-backend.sh "$ENV_FILE"
else
  pm2 restart mmsv2-backend --update-env 2>/dev/null || true
fi
bash scripts/deploy-verify.sh "$ENV_FILE"
pm2 save 2>/dev/null || true

log_info "Done — MMS should only respond on https://${APP_DOMAIN}/ and *.${APP_DOMAIN}"
