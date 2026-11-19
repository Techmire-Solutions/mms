#!/usr/bin/env bash
# Poll a public site until it serves health (+SPA), then verify the platform
# setup probe is not a misconfigured apex (403). Shared by deploy.yml and
# production-apache-isolate.yml so their "is the site actually up?" logic cannot
# drift apart.
#
#   verify-site.sh <base-url> [--require-ready] [--attempts N] [--sleep S]
#
# Exports SETUP_CODE to $GITHUB_ENV when running under GitHub Actions.
set -euo pipefail

BASE="${1:?usage: verify-site.sh <base-url> [--require-ready] [--attempts N] [--sleep S]}"
shift

REQUIRE_READY=0
ATTEMPTS=10
SLEEP=10
while [ "$#" -gt 0 ]; do
  case "$1" in
    --require-ready) REQUIRE_READY=1 ;;
    --attempts) ATTEMPTS="$2"; shift ;;
    --sleep) SLEEP="$2"; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

# Fast-fail on TLS certificate errors — retrying won't fix an expired cert.
if curl -sS --connect-timeout 15 --max-time 20 "${BASE}/health" 2>&1 | grep -qi \
  "certificate has expired\|SSL certificate problem\|certificate verify failed"; then
  echo "::error::TLS certificate expired or invalid on ${BASE}" >&2
  echo "Fix: renew the certificate on the server (e.g. sudo certbot renew --force-renewal && sudo systemctl reload apache2)" >&2
  exit 1
fi

for i in $(seq 1 "$ATTEMPTS"); do
  if curl -fsS --connect-timeout 15 --max-time 25 "${BASE}/health" >/dev/null \
    && { [ "$REQUIRE_READY" -ne 1 ] || curl -fsS --connect-timeout 15 --max-time 25 "${BASE}/ready" >/dev/null; } \
    && curl -fsS --connect-timeout 15 --max-time 25 "${BASE}/" >/dev/null; then
    break
  fi
  echo "Waiting for public site (attempt ${i}/${ATTEMPTS})..."
  sleep "$SLEEP"
  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "::error::${BASE} unreachable — check the reverse proxy / Apache ProxyPass" >&2
    exit 1
  fi
done
echo "Health and SPA OK: ${BASE}/"

SETUP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 15 --max-time 25 "${BASE}/api/platform/auth/setup/status")"
echo "Platform setup/status → HTTP ${SETUP_CODE}"
if [ "${SETUP_CODE}" = "403" ]; then
  echo "::error::Apex misconfigured — MMS_APP_DOMAIN must match the full hostname" >&2
  exit 1
fi
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "SETUP_CODE=${SETUP_CODE}" >> "$GITHUB_ENV"
fi
