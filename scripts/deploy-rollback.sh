#!/usr/bin/env bash
# Restore a previous dist tarball from .deploy-releases/ and reload PM2.
# Usage:
#   bash scripts/deploy-rollback.sh              # previous release (2nd newest)
#   bash scripts/deploy-rollback.sh <sha>        # specific release
#   bash scripts/deploy-rollback.sh list         # list retained releases
set -euo pipefail

ROOT_DIR="${MMS_DEPLOY_ROOT:-/var/www/mmsv2}"
ENV_FILE="${MMS_DEPLOY_ENV:-apps/backend/.env}"
RELEASES_DIR="${ROOT_DIR}/.deploy-releases"

cd "$ROOT_DIR" || { echo "FATAL: cannot cd to ${ROOT_DIR}"; exit 1; }

# shellcheck source=lib/deploy-ports.sh
source "$ROOT_DIR/scripts/lib/deploy-ports.sh"

list_releases() {
  if [ ! -d "$RELEASES_DIR" ]; then
    echo "No releases directory at ${RELEASES_DIR}"
    return 0
  fi
  # shellcheck disable=SC2012
  ls -1t "$RELEASES_DIR"/*.tar.gz 2>/dev/null | while read -r path; do
    base="$(basename "$path" .tar.gz)"
    echo "$base  $path"
  done
}

if [ "${1:-}" = "list" ]; then
  list_releases
  exit 0
fi

TARGET_SHA="${1:-}"
TARBALL=""

if [ -n "$TARGET_SHA" ]; then
  TARBALL="${RELEASES_DIR}/${TARGET_SHA}.tar.gz"
  if [ ! -f "$TARBALL" ]; then
    echo "FATAL: release not found: ${TARBALL}"
    echo "Available:"
    list_releases
    exit 1
  fi
else
  # Second-newest = previous successful deploy (newest is usually current).
  # shellcheck disable=SC2012
  NEWEST="$(ls -1t "$RELEASES_DIR"/*.tar.gz 2>/dev/null | sed -n '1p' || true)"
  PREV="$(ls -1t "$RELEASES_DIR"/*.tar.gz 2>/dev/null | sed -n '2p' || true)"
  if [ -n "$PREV" ]; then
    TARBALL="$PREV"
    echo "Rolling back to previous release: $(basename "$TARBALL")"
  elif [ -n "$NEWEST" ]; then
    TARBALL="$NEWEST"
    echo "WARNING: only one retained release — restoring ${TARBALL}"
  else
    echo "FATAL: no retained releases under ${RELEASES_DIR}"
    exit 1
  fi
fi

if [ -f "${TARBALL}.sha256" ]; then
  EXPECTED_HASH="$(awk '{print $1}' "${TARBALL}.sha256")"
  ACTUAL_HASH="$(sha256sum "$TARBALL" | awk '{print $1}')"
  if [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
    echo "FATAL: release checksum mismatch (expected ${EXPECTED_HASH}, got ${ACTUAL_HASH})"
    exit 1
  fi
fi

echo "Extracting ${TARBALL} → ${ROOT_DIR}"
rm -rf "${ROOT_DIR}/apps/frontend/dist" "${ROOT_DIR}/apps/backend/dist"
tar xzf "$TARBALL" -C "$ROOT_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi
export PATH="$HOME/.local/share/pnpm:$PATH"
export PUPPETEER_SKIP_DOWNLOAD=true
export NODE_ENV=production

if [ -f "$ROOT_DIR/ecosystem.config.cjs" ]; then
  pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --only mmsv2-backend --update-env \
    || pm2 restart mmsv2-backend --update-env
else
  pm2 restart mmsv2-backend --update-env
fi

if [ -f scripts/deploy-recover-backend.sh ]; then
  bash scripts/deploy-recover-backend.sh "$ENV_FILE"
fi

ROLLBACK_SHA="$(basename "$TARBALL" .tar.gz)"
printf '%s\n' "$ROLLBACK_SHA" > "${ROOT_DIR}/.deploy-current-sha"
pm2 save 2>/dev/null || true

echo "Rollback complete — dist from ${ROLLBACK_SHA}"
echo "Note: git working tree was not changed; only dist/ was restored."
exit 0
