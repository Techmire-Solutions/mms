#!/usr/bin/env bash
# Fix tenant URLs serving the wrong Apache vhost (e.g. Moodle → edu.aabtaab.com).
# Root cause: TLS cert lacks *.MMS_APP_DOMAIN — Apache falls back to default SSL site.
#
# Usage (on production VPS as root):
#   cd /var/www/mmsv2
#   bash scripts/production/fix-tenant-tls-wildcard.sh apps/api/.env
#
# Requires interactive certbot DNS challenge unless MMS_WILDCARD_CERT_DIR is preset.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=../lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=../lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

ENV_FILE="${1:-apps/api/.env}"

APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN "${MMS_APP_DOMAIN:-}")"
if [[ -z "$APP_DOMAIN" ]]; then
  echo "ERROR: MMS_APP_DOMAIN required in ${ENV_FILE}"
  exit 1
fi

WILDCARD_SAN="*.${APP_DOMAIN}"
PROBE_HOST="tenant-tls-probe-${RANDOM}.${APP_DOMAIN}"
CERT_DIR="${MMS_WILDCARD_CERT_DIR:-/etc/letsencrypt/live/${APP_DOMAIN}}"

cert_sans_for_sni() {
  local sni="$1"
  echo | openssl s_client -servername "$sni" -connect "${APP_DOMAIN}:443" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null || true
}

cert_covers_tenant_sni() {
  local sni="$1"
  local sans
  sans="$(cert_sans_for_sni "$sni")"
  echo "$sans" | grep -qF "DNS:${WILDCARD_SAN}" \
    || echo "$sans" | grep -qF "DNS:${sni}"
}

tenant_https_headers() {
  curl -sI --connect-timeout 8 --max-time 20 "https://${PROBE_HOST}/" 2>/dev/null || true
}

echo "══ Fix tenant TLS / Apache routing ══"
echo "MMS_APP_DOMAIN=${APP_DOMAIN}"
echo "Probe host: ${PROBE_HOST}"
echo ""

echo "── Current TLS for tenant SNI ──"
TENANT_SANS="$(cert_sans_for_sni "$PROBE_HOST")"
echo "${TENANT_SANS:-<could not read certificate>}"
if cert_covers_tenant_sni "$PROBE_HOST"; then
  echo "OK: Certificate already covers ${WILDCARD_SAN}"
else
  echo "ERROR: Certificate does NOT cover tenant subdomains (often shows edu.aabtaab.com / Moodle)"
fi
echo ""

echo "── Apache vhost map (443) ──"
if command -v apache2ctl >/dev/null 2>&1; then
  apache2ctl -S 2>&1 | grep -E ':443|${APP_DOMAIN}' || apache2ctl -S 2>&1 | grep 443 || true
else
  echo "WARNING: apache2ctl not found"
fi
echo ""

echo "── Reinstall MMS vhost (000-mmsv2.conf, ServerAlias *.${APP_DOMAIN}) ──"
export MMS_REQUIRE_WILDCARD_TLS="${MMS_REQUIRE_WILDCARD_TLS:-0}"
bash "$ROOT_DIR/scripts/apache/install-mms-vhost.sh" "$ENV_FILE"
bash "$ROOT_DIR/scripts/fix-apache-upstream.sh" "$ENV_FILE"
echo ""

if cert_covers_tenant_sni "$PROBE_HOST"; then
  echo "── Verify tenant HTTPS (all registered + random probe) ──"
  export MMS_REQUIRE_WILDCARD_TLS=1
  if bash "$ROOT_DIR/scripts/verify-tenant-hosts.sh" "" "$ENV_FILE"; then
    echo "Done — tenant subdomains serve MMS only."
    exit 0
  fi
  exit 1
fi

echo "── Wildcard certificate required ──"
echo "HTTP-01 cannot issue *.${APP_DOMAIN}. Use DNS challenge once:"
echo ""
echo "  sudo certbot certonly --cert-name ${APP_DOMAIN} --expand \\"
echo "    --manual --preferred-challenges dns \\"
echo "    -d ${APP_DOMAIN} -d '${WILDCARD_SAN}'"
echo ""
echo "Add ONE TXT at host _acme-challenge.mmsv2 (not *.mmsv2) — value = certbot token only, never the server IP."
echo "Verify before pressing Enter in certbot (must show token, not 157.90.168.216):"
echo ""
echo "  dig @dns1.name-services.com _acme-challenge.mmsv2.aabtaab.com TXT +short"
echo ""
echo "If you see the IP, delete duplicate TXT rows in Enom and wait 2–5 min."
echo ""
echo "HTTP-01 fallback (known tenants only, no wildcard probe):"
echo ""
echo "  sudo certbot certonly --cert-name ${APP_DOMAIN} --expand --apache \\"
echo "    -d ${APP_DOMAIN} -d aabtaab.${APP_DOMAIN} -d dar-ul-quran.${APP_DOMAIN} \\"
echo "    -d marzia-academy.${APP_DOMAIN}"
echo ""
echo "Then: MMS_REQUIRE_WILDCARD_TLS=0 bash scripts/apache/install-mms-vhost.sh ${ENV_FILE}"
echo ""

if [[ "${MMS_RUN_CERTBOT:-}" == "1" ]] && [[ -t 0 ]]; then
  read -r -p "Run certbot now? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    sudo certbot certonly --cert-name "$APP_DOMAIN" --expand \
      --manual --preferred-challenges dns \
      -d "$APP_DOMAIN" -d "$WILDCARD_SAN"
    bash "$ROOT_DIR/scripts/apache/install-mms-vhost.sh" "$ENV_FILE"
    sudo systemctl reload apache2
  fi
fi

if cert_covers_tenant_sni "$PROBE_HOST"; then
  echo "Certificate OK after certbot."
  exit 0
fi

echo "After certbot completes, run:"
echo "  bash scripts/apache/install-mms-vhost.sh ${ENV_FILE}"
echo "  sudo systemctl reload apache2"
echo "  bash scripts/verify-tenant-hosts.sh aabtaab ${ENV_FILE}"
exit 1
