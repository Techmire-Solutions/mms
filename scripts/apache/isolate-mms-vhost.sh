#!/usr/bin/env bash
# Remove MMS backend ProxyPass from Apache vhosts that are NOT for MMS_APP_DOMAIN.
# Fixes cases where aabtaab.com / darulquran.pk incorrectly proxy to :5002.
set -eEuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[MMS-ISOLATE]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[MMS-ISOLATE-WARN]${NC} $1"; }
log_err() { echo -e "${RED}[MMS-ISOLATE-ERR]${NC} $1"; }

trap 'log_err "Failed at line $LINENO: command \"$BASH_COMMAND\" exited with status $?"' ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=../lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=../lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

ENV_FILE="${1:-apps/api/.env}"

APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN "${MMS_APP_DOMAIN:-}" "$ENV_FILE")"
BACKEND_PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"

if [[ -z "$APP_DOMAIN" ]]; then
  log_warn "MMS_APP_DOMAIN unset — skip Apache isolation"
  exit 0
fi

if ! command -v apache2ctl >/dev/null 2>&1; then
  log_warn "Apache not installed — skip isolation"
  exit 0
fi

run_priv() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    log_err "Need root/sudo"
    exit 1
  fi
}

MMS_PORTS="${BACKEND_PORT}"
STRIPPED=false

for conf in /etc/apache2/sites-enabled/*; do
  [[ -f "$conf" ]] || continue
  if grep -F -q "$APP_DOMAIN" "$conf" 2>/dev/null; then
    echo "MMS vhost (keep): ${conf}"
    continue
  fi
  if ! grep -qE "ProxyPass(Reverse)?[[:space:]]+/[[:space:]]+http://(127\\.0\\.0\\.1|localhost):(${MMS_PORTS})" "$conf" 2>/dev/null; then
    continue
  fi
  echo "Stripping MMS ProxyPass from non-MMS vhost: ${conf}"
  run_priv sed -i -E \
    "/ProxyPass(Reverse)?[[:space:]]+\\/[[:space:]]+http:\\/\\/(127\\.0\\.0\\.1|localhost):(${MMS_PORTS})/d" \
    "$conf"
  STRIPPED=true
done

if [[ "$STRIPPED" == true ]]; then
  run_priv apache2ctl configtest
  run_priv systemctl reload apache2
  echo "Apache reloaded — MMS proxy removed from other domains"
else
  echo "No foreign vhosts proxying MMS ports"
fi

if [[ -n "$APP_DOMAIN" ]]; then
  for conf in /etc/apache2/sites-enabled/*; do
    [[ -f "$conf" ]] || continue
    if grep -F -q "$APP_DOMAIN" "$conf" 2>/dev/null; then
      continue
    fi
    if grep -qE 'ServerAlias[[:space:]]+\*' "$conf" 2>/dev/null \
      && grep -q ':443' "$conf" 2>/dev/null; then
      echo "WARNING: ${conf} has wildcard ServerAlias on :443 — may steal tenant SNI if MMS lacks *.${APP_DOMAIN} TLS"
    fi
  done
fi
