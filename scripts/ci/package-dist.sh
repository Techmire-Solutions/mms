#!/usr/bin/env bash
# Package the production build into the release tarball consumed by
# scripts/deploy-on-server.sh. Shared by ci.yml (build once, on push to main)
# and deploy.yml (manual-dispatch rebuild) so both produce the same layout.
set -euo pipefail

# Source maps are build-time artefacts (CI builds with Vite `sourcemap: "hidden"`),
# not deploy payloads: everything under apps/frontend/dist is publicly served, so a
# shipped `*.map` would expose the frontend source at /assets/*.js.map
# (docs/project-review-2026-10-30.md P-03). Keep them on disk for a future Sentry
# upload; never put them in the release tarball.
tar czf mms-dist.tar.gz --exclude='*.map' apps/backend/dist apps/frontend/dist packages/shared/dist

if tar tzf mms-dist.tar.gz | grep -q '\.map$'; then
  echo "package-dist: release tarball must not contain source maps" >&2
  exit 1
fi

sha256sum mms-dist.tar.gz > mms-dist.tar.gz.sha256
