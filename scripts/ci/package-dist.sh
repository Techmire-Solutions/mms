#!/usr/bin/env bash
# Package the production build into the release tarball consumed by
# scripts/deploy-on-server.sh. Shared by ci.yml (build once, on push to main)
# and deploy.yml (manual-dispatch rebuild) so both produce the same layout.
set -euo pipefail

# Source maps are build-time artefacts (CI builds with Vite `sourcemap: "hidden"`),
# not deploy payloads: everything under apps/tenant-web/dist apps/platform-web/dist is publicly served, so a
# shipped `*.map` would expose the frontend source at /assets/*.js.map
# (docs/project-review-2026-10-30.md P-03). Keep them on disk for a future Sentry
# upload; never put them in the release tarball.
DIST_PATHS=(
  apps/api/dist
  apps/tenant-web/dist
  apps/platform-web/dist
  packages/contracts/dist
  packages/db/dist
  packages/db/migrations_drizzle
  packages/be-core/dist
)

for mod_dir in packages/modules/*/; do
  [ -f "${mod_dir}package.json" ] || continue
  dist_dir="${mod_dir}dist"
  if [ ! -d "${dist_dir}" ]; then
    echo "package-dist: missing module build directory ${dist_dir}" >&2
    exit 1
  fi
  DIST_PATHS+=("${dist_dir}")
done

tar czf mms-dist.tar.gz --exclude='*.map' "${DIST_PATHS[@]}"

if tar tzf mms-dist.tar.gz | grep -q '\.map$'; then
  echo "package-dist: release tarball must not contain source maps" >&2
  exit 1
fi

sha256sum mms-dist.tar.gz > mms-dist.tar.gz.sha256
