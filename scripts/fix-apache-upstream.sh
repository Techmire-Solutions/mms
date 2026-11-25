#!/usr/bin/env bash
# Point Apache ProxyPass at the Fastify backend (default :5002). Requires root/sudo.
set -Eeuo pipefail

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

ENV_FILE="${1:-apps/api/.env}"

BACKEND_PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN '' "$ENV_FILE")"
if [[ -z "$APP_DOMAIN" && -n "${MMS_APP_DOMAIN:-}" ]]; then
  APP_DOMAIN="${MMS_APP_DOMAIN}"
fi

if ! command -v apache2ctl >/dev/null 2>&1; then
  echo -e "${YELLOW}WARNING: Apache not installed — skip upstream patch${NC}"
  exit 0
fi

run_priv() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo -e "${RED}ERROR: need root/sudo to patch Apache${NC}"
    exit 1
  fi
}

UPSTREAM="http://127.0.0.1:${BACKEND_PORT}/"
PATCHED=false

patch_proxy_in_file() {
  local conf="$1"
  if ! grep -E -q "(ProxyPass|RewriteRule.*ws://)" "$conf" 2>/dev/null; then
    return 1
  fi
  echo "Patching ProxyPass and WebSocket rules in ${conf} → ${UPSTREAM}"
  run_priv sed -i -E \
    "s#(ProxyPass(Reverse)?[[:space:]]+/[[:space:]]+)http://(127\\.0\\.0\\.1|localhost):[0-9]+/?#\1${UPSTREAM}#g" \
    "$conf"
  run_priv sed -i -E \
    "s#(RewriteRule[[:space:]]+\\^/?\\(\\.\\*\\)[[:space:]]+\"?ws://)(127\\.0\\.0\\.1|localhost):[0-9]+(/\\\$1\"?[[:space:]]+\\[P,L\\])#\1127.0.0.1:${BACKEND_PORT}\3#g" \
    "$conf"
  return 0
}

should_patch_file() {
  local conf="$1"
  # Only patch vhosts for MMS_APP_DOMAIN — never other sites (aabtaab.com, darulquran.pk, …).
  if [[ -n "$APP_DOMAIN" ]] && grep -F -q "$APP_DOMAIN" "$conf" 2>/dev/null; then
    return 0
  fi
  return 1
}

if [[ -d /etc/apache2/sites-enabled ]]; then
  for conf in /etc/apache2/sites-enabled/*; do
    [[ -f "$conf" ]] || continue
    if should_patch_file "$conf" && patch_proxy_in_file "$conf"; then
      PATCHED=true
    fi
  done
fi

if [[ "$PATCHED" != true ]]; then
  echo -e "${RED}ERROR: no Apache ProxyPass vhost patched for ${APP_DOMAIN:-MMS}${NC}"
  echo "Check: grep -r ProxyPass /etc/apache2/sites-enabled/"
  echo "Template: scripts/apache/mmsv2-vhost.conf.template"
  exit 1
fi

run_priv a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite http2 2>/dev/null || true
run_priv apache2ctl configtest

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet apache2 2>/dev/null; then
  run_priv systemctl reload apache2
elif command -v service >/dev/null 2>&1; then
  run_priv service apache2 reload
else
  run_priv apache2ctl graceful
fi

echo -e "${GREEN}Apache reloaded — upstream is ${UPSTREAM}${NC}"
