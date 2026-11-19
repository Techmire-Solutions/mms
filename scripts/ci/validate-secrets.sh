#!/usr/bin/env bash
# Validate that the named secrets/env vars are set and non-empty. Any missing
# name is reported and the script exits 1, so a typo'd or absent secret fails
# loudly at the start of a workflow instead of mid-deploy.
#
#   bash scripts/ci/validate-secrets.sh SERVER_IP SERVER_USER SSH_PRIVATE_KEY
set -euo pipefail

[ "$#" -ge 1 ] || { echo "usage: validate-secrets.sh VAR [VAR ...]" >&2; exit 2; }

missing=""
for name in "$@"; do
  if [ -z "${!name-}" ]; then
    missing="${missing} ${name}"
  fi
done

if [ -n "${missing}" ]; then
  echo "ERROR: Missing required GitHub Actions secrets:${missing}" >&2
  echo "Add them under Settings → Secrets and variables → Actions" >&2
  exit 1
fi

echo "Secrets present: $*"
