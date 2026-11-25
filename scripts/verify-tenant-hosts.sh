#!/usr/bin/env bash
# Verify tenant subdomain routing (DNS, TLS, Apache, workspace API).
# Usage: bash scripts/verify-tenant-hosts.sh [subdomain] [apps/api/.env]
#   subdomain optional — when omitted, uses first entry from workspace registry.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"
# shellcheck source=lib/curl-local-backend.sh
source "$ROOT_DIR/scripts/lib/curl-local-backend.sh"
# shellcheck source=lib/tenant-https-guard.sh
source "$ROOT_DIR/scripts/lib/tenant-https-guard.sh"

SUBDOMAIN="${1:-}"
ENV_FILE="${2:-apps/api/.env}"
FAIL=0
ALL_SUBDOMAINS=()

warn() { echo "WARNING: $*"; }
fail() { echo "ERROR: $*"; FAIL=1; }
ok() { echo "OK: $*"; }

BACKEND_PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT" "$ENV_FILE")"
APP_DOMAIN="$(read_env_var MMS_APP_DOMAIN '' "$ENV_FILE")"
LOCAL="http://127.0.0.1:${BACKEND_PORT}"

echo "══ Tenant host verification ══"
echo "MMS_APP_DOMAIN: ${APP_DOMAIN:-<not set>}"
echo "Backend: ${LOCAL}"
echo ""

if [[ -z "$APP_DOMAIN" ]]; then
  fail "MMS_APP_DOMAIN missing in ${ENV_FILE} — set full apex hostname (e.g. mmsv2.example.com)"
  exit 1
fi

dot_count="$(printf '%s' "$APP_DOMAIN" | tr -cd '.' | wc -c | tr -d ' ')"
if [[ "$dot_count" -lt 2 ]]; then
  warn "MMS_APP_DOMAIN=${APP_DOMAIN} has only ${dot_count} dot(s) — use full platform host (e.g. mmsv2.yourdomain.com)"
fi

# ── DNS ──────────────────────────────────────────────────────────────────────
echo "── DNS ──"
if command -v dig >/dev/null 2>&1; then
  APEX_IP="$(dig +short "$APP_DOMAIN" A 2>/dev/null | head -1 || true)"
  if [[ -n "$APEX_IP" ]]; then
    ok "A ${APP_DOMAIN} → ${APEX_IP}"
  else
    fail "No A record for ${APP_DOMAIN}"
  fi

  PROBE="tenant-dns-probe-${RANDOM}.${APP_DOMAIN}"
  WILD_IP="$(dig +short "$PROBE" A 2>/dev/null | head -1 || true)"
  if [[ -n "$WILD_IP" ]]; then
    ok "Wildcard DNS resolves (${PROBE} → ${WILD_IP})"
  else
    fail "Wildcard DNS missing — add *.${APP_DOMAIN} A (or CNAME) → same server as apex"
    echo "       Without this, {slug}.${APP_DOMAIN} never reaches Apache."
  fi
else
  warn "dig not installed — skip DNS checks"
fi
echo ""

# ── Apache vhost ─────────────────────────────────────────────────────────────
echo "── Apache ──"
VHOST=""
for candidate in /etc/apache2/sites-enabled/000-mmsv2.conf /etc/apache2/sites-enabled/z-mmsv2.conf /etc/apache2/sites-enabled/mmsv2.conf; do
  if [[ -f "$candidate" ]]; then
    VHOST="$candidate"
    break
  fi
done
if [[ -n "$VHOST" ]]; then
  if grep -F -q "ServerAlias *.${APP_DOMAIN}" "$VHOST" 2>/dev/null; then
    ok "$(basename "$VHOST") has ServerAlias *.${APP_DOMAIN}"
  else
    fail "$(basename "$VHOST") missing ServerAlias *.${APP_DOMAIN} — run: bash scripts/apache/install-mms-vhost.sh ${ENV_FILE}"
  fi
else
  fail "Missing MMS Apache vhost — run: bash scripts/apply-production-host-isolation.sh ${ENV_FILE}"
fi
echo ""

# ── Workspace registry ───────────────────────────────────────────────────────
echo "── Workspaces ──"
REGISTRY="$(curl_local_backend "${LOCAL}/api/workspace/registry" "$APP_DOMAIN" 2>/dev/null || true)"
if [[ -z "$REGISTRY" ]]; then
  fail "GET /api/workspace/registry failed — is backend running on :${BACKEND_PORT}?"
else
  ok "Workspace registry reachable"
  mapfile -t ALL_SUBDOMAINS < <(printf '%s' "$REGISTRY" | grep -oE '"subdomain":"[a-z0-9-]+"' | cut -d'"' -f4 | sort -u)
  if [[ ${#ALL_SUBDOMAINS[@]} -eq 0 ]]; then
    warn "No tenants in registry yet — create a madrasa on https://${APP_DOMAIN}/ first"
  else
    echo "Registered tenants: ${ALL_SUBDOMAINS[*]}"
  fi
  if [[ -z "$SUBDOMAIN" && ${#ALL_SUBDOMAINS[@]} -gt 0 ]]; then
    SUBDOMAIN="${ALL_SUBDOMAINS[0]}"
  fi
fi
echo ""

# Random probe only when the cert includes *.APP_DOMAIN (wildcard TLS).
PROBE_SLUG="tenant-probe-${RANDOM}"
TENANT_HOSTS=()
if [[ ${#ALL_SUBDOMAINS[@]} -gt 0 ]]; then
  for slug in "${ALL_SUBDOMAINS[@]}"; do
    TENANT_HOSTS+=("${slug}.${APP_DOMAIN}")
  done
fi
CERT_FILE="/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem"
if [[ -f "$CERT_FILE" ]] && openssl x509 -in "$CERT_FILE" -noout -ext subjectAltName 2>/dev/null | grep -qF "DNS:*.${APP_DOMAIN}"; then
  TENANT_HOSTS+=("${PROBE_SLUG}.${APP_DOMAIN}")
else
  warn "No wildcard TLS (*.${APP_DOMAIN}) — skipping random tenant probe (add new tenants to cert with certbot --expand)"
fi

if [[ ${#TENANT_HOSTS[@]} -gt 0 ]]; then
  echo "── Public HTTPS (all tenants + probe — must not redirect off-platform) ──"
  for TENANT_HOST in "${TENANT_HOSTS[@]}"; do
    REASON="$(tenant_https_guard_failures "$TENANT_HOST" "$APP_DOMAIN" || true)"
    if [[ -z "$REASON" ]]; then
      if tenant_https_serves_mms_api "$TENANT_HOST"; then
        ok "https://${TENANT_HOST}/ → MMS (/health 200, no foreign redirect)"
      else
        ok "https://${TENANT_HOST}/ → no foreign redirect (check /health separately)"
      fi
    else
      fail "https://${TENANT_HOST}/ → ${REASON}"
      echo "       Fix: bash scripts/production/fix-tenant-tls-wildcard.sh ${ENV_FILE}"
    fi
  done
  echo ""
fi

if [[ -n "$SUBDOMAIN" ]]; then
  TENANT_HOST="${SUBDOMAIN}.${APP_DOMAIN}"
  echo "── API (sample tenant: ${SUBDOMAIN}) ──"
  CODE="$(curl -s -o /tmp/mms-tenant-ws.json -w '%{http_code}' \
    -H "Host: ${TENANT_HOST}" -H "X-Forwarded-Host: ${TENANT_HOST}" \
    "${LOCAL}/api/workspace/by-subdomain/${SUBDOMAIN}")"
  if [[ "$CODE" == "200" ]]; then
    ok "GET /api/workspace/by-subdomain/${SUBDOMAIN} → 200 (with tenant Host)"
  else
    fail "GET /api/workspace/by-subdomain/${SUBDOMAIN} → HTTP ${CODE} (expected 200)"
    head -c 400 /tmp/mms-tenant-ws.json 2>/dev/null || true
    echo ""
  fi

  echo ""
  echo "Tenant login URL: https://${TENANT_HOST}/login"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Tenant host checks passed."
  exit 0
fi
echo "Tenant host checks failed — fix errors above."
exit 1
