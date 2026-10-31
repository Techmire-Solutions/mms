#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../" && pwd)"
cd "$ROOT"

echo "=== MMS environment check ==="

command -v pnpm >/dev/null || { echo "FAIL: pnpm not installed"; exit 1; }
echo "OK: pnpm $(pnpm --version)"

command -v node >/dev/null || { echo "FAIL: node not installed"; exit 1; }
echo "OK: node $(node --version)"

if [ -f "apps/backend/.env" ]; then
  grep -q '^JWT_SECRET=' apps/backend/.env && echo "OK: JWT_SECRET in apps/backend/.env" || echo "WARN: JWT_SECRET missing in apps/backend/.env"
else
  echo "WARN: apps/backend/.env not found (JWT_SECRET required at runtime)"
fi

if grep -qE '^DATABASE_URL=postgres(ql)?://' apps/backend/.env 2>/dev/null; then
  echo "OK: PostgreSQL configured via DATABASE_URL"
elif command -v docker >/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^mms-postgres$'; then
  echo "OK: mms-postgres container running"
elif command -v docker >/dev/null; then
  echo "INFO: mms-postgres not running (use local PostgreSQL or docker start mms-postgres)"
else
  echo "INFO: docker not available — ensure PostgreSQL is reachable via DATABASE_URL"
fi

if grep -qE '^REDIS_URL=redis(s)?://' apps/backend/.env 2>/dev/null; then
  echo "OK: Redis configured via REDIS_URL"
elif command -v docker >/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^mms-redis$'; then
  echo "OK: mms-redis container running"
elif command -v docker >/dev/null; then
  echo "INFO: mms-redis not running (use local Redis or docker start mms-redis)"
else
  echo "INFO: docker not available — ensure Redis is reachable (default 127.0.0.1:6379)"
fi

if [ -d "node_modules" ]; then
  echo "OK: node_modules present — run pnpm install if packages are stale"
else
  echo "WARN: run pnpm install from repo root"
fi

echo "=== Done ==="
