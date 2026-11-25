#!/usr/bin/env bash
# Register MMS backend with PM2 and enable boot persistence (systemd).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-apps/api/.env}"
# shellcheck source=../lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"
# shellcheck source=../lib/read-env.sh
source "$ROOT_DIR/scripts/lib/read-env.sh"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

export PORT="$(read_env_var PORT "$MMS_PROD_BACKEND_PORT")"
export NODE_ENV=production
assert_production_backend_port "$PORT" "PM2 PORT" || exit 1

mkdir -p "$ROOT_DIR/.logs"

if [[ ! -f "$ROOT_DIR/apps/api/dist/index.js" ]]; then
  echo "ERROR: apps/api/dist/index.js missing — run: pnpm build"
  exit 1
fi

pm2 delete mmsv2-frontend 2>/dev/null || true
pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --only mmsv2-backend --update-env
pm2 save

echo ""
echo "Run the command printed below (if pm2 startup has not been configured yet):"
pm2 startup systemd -u "$USER" --hp "$HOME" || true

pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 20M 2>/dev/null || true
pm2 set pm2-logrotate:retain 14 2>/dev/null || true

echo "PM2 backend registered on port ${PORT}"
