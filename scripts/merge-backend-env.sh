#!/usr/bin/env bash
# Merges deploy-time environment variables into apps/backend/.env (used by CI SSH deploy).
# Only overwrites keys present in the runner environment; existing JWT_SECRET / DATABASE_URL are kept.
set -euo pipefail

ENV_FILE="${1:-apps/backend/.env}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

DEPLOY_KEYS=(
  NODE_ENV
  PLATFORM_RESEND_API_KEY
  PLATFORM_SMTP_HOST
  PLATFORM_SMTP_PORT
  PLATFORM_SMTP_SECURE
  PLATFORM_SMTP_USER
  PLATFORM_SMTP_PASS
  PLATFORM_EMAIL_FROM
  PLATFORM_EMAIL_FROM_NAME
  PLATFORM_APP_URL
  PLATFORM_ALLOW_ENV_BOOTSTRAP
  PLATFORM_ALLOW_REMOTE_MIGRATE_RESTART
  PLATFORM_ADMIN_EMAIL
  PLATFORM_ADMIN_PASSWORD
  PLATFORM_ADMIN_NAME
  MMS_APP_DOMAIN
  TRUST_PROXY
  MMS_DB_ROLE_ENFORCEMENT
)

write_env_var() {
  local key="$1"
  local value="${2:-}"
  if [[ -z "$value" ]]; then
    return 0
  fi

  # Strip carriage returns and leading/trailing whitespace
  value="$(echo -n "$value" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  local tmp="${ENV_FILE}.tmp.$$"
  if [[ -f "$ENV_FILE" ]]; then
    grep -v "^${key}=" "$ENV_FILE" >"$tmp" 2>/dev/null || : >"$tmp"
  else
    : >"$tmp"
  fi

  local escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$escaped" >>"$tmp"
  mv "$tmp" "$ENV_FILE"
}

for key in "${DEPLOY_KEYS[@]}"; do
  write_env_var "$key" "${!key-}"
done

# If MMS_DB_ROLE_ENFORCEMENT is not yet in ENV_FILE, default to "strict": a
# missing mode must not silently disable the RLS backstop. Existing single-user
# postgres installs must provision mms_app (docs/rls-operations.md) or set the
# documented override before the next deploy.
if ! grep -q '^MMS_DB_ROLE_ENFORCEMENT=' "$ENV_FILE" 2>/dev/null; then
  write_env_var "MMS_DB_ROLE_ENFORCEMENT" "${MMS_DB_ROLE_ENFORCEMENT:-strict}"
fi

# MMS_API_URL was a legacy separate API host — Apache serves the platform at MMS_APP_DOMAIN only.
if grep -q '^MMS_API_URL=' "$ENV_FILE" 2>/dev/null; then
  tmp="${ENV_FILE}.tmp.$$"
  grep -v '^MMS_API_URL=' "$ENV_FILE" >"$tmp" 2>/dev/null || : >"$tmp"
  mv "$tmp" "$ENV_FILE"
  echo "Removed deprecated MMS_API_URL from ${ENV_FILE} (public URL is https://\${MMS_APP_DOMAIN})"
fi

# Always force production mode on the server.
write_env_var "NODE_ENV" "production"

# Ensure JWT_SECRET exists and is at least 32 chars (required in production).
# Never overwrites a secret that is already long enough.
ensure_jwt_secret() {
  local current
  current="$(grep '^JWT_SECRET=' "$ENV_FILE" 2>/dev/null | tail -1 || true)"
  current="${current#JWT_SECRET=}"
  current="${current%\"}"
  current="${current#\"}"
  if [[ ${#current} -ge 32 ]]; then
    return 0
  fi
  local new_secret
  new_secret="$(openssl rand -hex 32 2>/dev/null \
    || head -c 32 /dev/urandom | base64 | tr -d '\n/+=' | head -c 64)"
  write_env_var "JWT_SECRET" "$new_secret"
  echo "Generated new JWT_SECRET (previous was absent or shorter than 32 chars)"
}
ensure_jwt_secret

# Production always listens on :5002 (Apache upstream).
# shellcheck source=lib/deploy-ports.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/deploy-ports.sh"
assert_prod_backend_port_default || exit 1
write_env_var "PORT" "$MMS_PROD_BACKEND_PORT"
assert_production_backend_port "$MMS_PROD_BACKEND_PORT" "Merged PORT" || exit 1

if [ -z "${PLATFORM_APP_URL:-}" ] && [ -n "${MMS_APP_DOMAIN:-}" ]; then
  write_env_var "PLATFORM_APP_URL" "https://${MMS_APP_DOMAIN}"
fi

echo "Merged deploy env keys into ${ENV_FILE}"
set +e
HAS_PROVIDER=$(grep -E '^PLATFORM_(RESEND_API_KEY|SMTP_HOST)=' "$ENV_FILE" 2>/dev/null | head -1)
HAS_FROM=$(grep '^PLATFORM_EMAIL_FROM=' "$ENV_FILE" 2>/dev/null | head -1)
set -e
if [ -n "$HAS_PROVIDER" ] && [ -n "$HAS_FROM" ]; then
  echo "Platform email: configured in ${ENV_FILE}"
else
  echo "WARNING: Platform email not in ${ENV_FILE} — add PLATFORM_RESEND_API_KEY (or SMTP_*) and PLATFORM_EMAIL_FROM as GitHub Actions secrets"
fi
if ! grep -q '^MMS_APP_DOMAIN=.\+' "$ENV_FILE" 2>/dev/null; then
  echo "WARNING: MMS_APP_DOMAIN missing in ${ENV_FILE} — set to your apex domain (e.g. mmsv2.example.com)"
elif grep -q '^MMS_APP_DOMAIN=' "$ENV_FILE" 2>/dev/null; then
  MERGED_DOMAIN="$(grep '^MMS_APP_DOMAIN=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"')"
  DOT_COUNT="$(printf '%s' "$MERGED_DOMAIN" | tr -cd '.' | wc -c | tr -d ' ')"
  if [[ "$DOT_COUNT" -eq 1 ]]; then
    echo "WARNING: MMS_APP_DOMAIN=${MERGED_DOMAIN} is 2 labels — if your platform URL is mmsv2.${MERGED_DOMAIN}, set MMS_APP_DOMAIN=mmsv2.${MERGED_DOMAIN}"
  fi
fi
