#!/usr/bin/env bash
# First-time Ubuntu VPS bootstrap for MMS production.
# Run as a user with sudo on a fresh 22.04/24.04 host (Hetzner, DigitalOcean, etc.).
#
# Usage:
#   curl -fsSL .../bootstrap-ubuntu-vps.sh | bash   # or clone repo first
#   sudo bash scripts/production/bootstrap-ubuntu-vps.sh
#
# After this script: set apps/api/.env, DNS, certbot, then apply-production-host-isolation.sh
set -Eeuo pipefail

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

if [[ "${EUID}" -eq 0 ]]; then
  echo -e "${YELLOW}WARNING: Running as root is not recommended for nvm/pm2 paths.${NC}"
  echo "         Prefer running as a standard user with sudo privileges."
fi

DEPLOY_ROOT="${MMS_DEPLOY_ROOT:-/var/www/mmsv2}"
DEPLOY_USER="${SUDO_USER:-$USER}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" 2>/dev/null | cut -d: -f6 || true)"
DEPLOY_HOME="${DEPLOY_HOME:-/home/${DEPLOY_USER}}"

# Match package.json engines (>=24.14) and GitHub Actions (Node 24).
NODE_VERSION="${MMS_NODE_VERSION:-24}"
PNPM_VERSION="${MMS_PNPM_VERSION:-11.15.1}"

echo -e "${GREEN}══ MMS Ubuntu VPS bootstrap ══${NC}"
echo "Deploy root: ${DEPLOY_ROOT}"
echo "Deploy user: ${DEPLOY_USER} (${DEPLOY_HOME})"

if ! command -v apt-get >/dev/null 2>&1; then
  echo -e "${RED}ERROR: This script targets Debian/Ubuntu (apt-get).${NC}"
  exit 1
fi

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl git build-essential ca-certificates gnupg \
  apache2 certbot python3-certbot-apache \
  postgresql-client \
  ufw

echo "── PostgreSQL Client ──"
# Installs postgresql-client for pg_dump and psql tools.
# The target database is typically run in a Docker container or via an external service.

echo "── Node ${NODE_VERSION} (nvm) ──"
export NVM_DIR="${DEPLOY_HOME}/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  sudo -u "$DEPLOY_USER" bash -c "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
fi
# shellcheck disable=SC1091
sudo -u "$DEPLOY_USER" bash -lc "
  export NVM_DIR=\"\$HOME/.nvm\"
  . \"\$NVM_DIR/nvm.sh\"
  nvm install ${NODE_VERSION}
  nvm alias default ${NODE_VERSION}
  corepack enable
  corepack prepare pnpm@${PNPM_VERSION} --activate
  node -v && pnpm -v
"

echo "── PM2 ──"
sudo -u "$DEPLOY_USER" bash -lc "
  export NVM_DIR=\"\$HOME/.nvm\"
  . \"\$NVM_DIR/nvm.sh\"
  npm install -g pm2@latest
  pm2 install pm2-logrotate || true
  pm2 set pm2-logrotate:max_size 20M
  pm2 set pm2-logrotate:retain 14
"

echo "── Apache modules ──"
sudo a2enmod proxy proxy_http proxy_wstunnel ssl headers rewrite http2 2>/dev/null || true

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable apache2 2>/dev/null || true
  sudo systemctl restart apache2
elif command -v service >/dev/null 2>&1; then
  sudo service apache2 restart
fi

echo "── Firewall (ufw) ──"
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'
sudo ufw --force enable || true

echo "── Deploy directory ──"
sudo mkdir -p "$DEPLOY_ROOT"
sudo chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$DEPLOY_ROOT"
mkdir -p "${DEPLOY_ROOT}/.logs" "${DEPLOY_ROOT}/.backups/postgres"

if [ ! -f "${DEPLOY_ROOT}/package.json" ]; then
  echo ""
  echo "Clone the repo into ${DEPLOY_ROOT}:"
  echo "  sudo -u ${DEPLOY_USER} git clone <your-repo-url> ${DEPLOY_ROOT}"
fi

echo ""
echo "══ Next steps (manual) ══"
echo "1. Clone repo to ${DEPLOY_ROOT} (if not done)"
echo "2. Create ${DEPLOY_ROOT}/apps/api/.env with:"
echo "     JWT_SECRET=<32+ chars>"
echo "     DATABASE_URL=postgres://username:password@localhost:5432/mms"
echo "     PORT=5002"
echo "     NODE_ENV=production"
echo "     MMS_APP_DOMAIN=mmsv2.yourdomain.com"
echo "3. DNS: A record for MMS_APP_DOMAIN + wildcard *.MMS_APP_DOMAIN → this server IP"
echo "4. TLS (wildcard required for tenant subdomains):"
echo "     sudo certbot certonly --manual --preferred-challenges dns \\"
echo "       -d your-platform.example.com -d '*.your-platform.example.com'"
echo "     Then: bash scripts/apache/install-mms-vhost.sh apps/api/.env"
echo "5. Build + PM2:"
echo "     cd ${DEPLOY_ROOT} && pnpm install && pnpm build"
echo "     bash scripts/production/setup-pm2-startup.sh"
echo "6. Apache isolation:"
echo "     bash scripts/apply-production-host-isolation.sh apps/api/.env"
echo "7. Backups cron:"
echo "     (crontab -l 2>/dev/null; echo \"0 3 * * * bash ${DEPLOY_ROOT}/scripts/production/backup-postgres.sh\") | crontab -"
echo ""
echo "Bootstrap complete."
