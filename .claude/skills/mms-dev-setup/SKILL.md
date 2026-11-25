---
name: mms-dev-setup
description: Sets up/runs the monorepo (pnpm, Node 24, PostgreSQL, backend :3000, tenant-web :5173). Use when installing deps, starting servers, fixing env. Do NOT use for prod deploys (use mms-ops-deploy) or Linux audits (use mms-linux-compatibility).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
compatibility: Requires Node >=24.14, pnpm 11.15.1, and reachable PostgreSQL.
---

# MMS Dev Setup

**Rules (norms SSOT):** `mms-ops-infrastructure.md` · `mms-core.md` · `mms-api-interface.md` · `mms-completion-review.md`.

## When to use

- Installing dependencies, starting local servers, or fixing env issues
- Onboarding to the monorepo for the first time

## 1. Quickstart & Dev Server

`./restart_servers.sh` is the canonical dev-server entry point (runs in GNU screen, survives agent disconnect).

```bash
pnpm install
./restart_servers.sh              # start dev servers in background screen
./restart_servers.sh status       # verify screen session + ports + health
./restart_servers.sh stop         # terminate screen session + servers
./restart_servers.sh --foreground # run directly in current terminal
```

## 2. Environment & PostgreSQL Setup

Create `apps/api/.env` (never commit):
- `JWT_SECRET`: Mandatory session signing secret (server exits without it).
- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/mms`).
- `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`: Super-user credentials for platform apex sign-in (platform-web; tenant-web serves on :5173).

*Drizzle Migration Notice:* Any new migration in `migrations_drizzle/*.sql` must be registered in `migrations_drizzle/meta/_journal.json` to execute.

## 3. Node 24 Tooling Standards

- **Config & Net**: Use `--env-file=.env` or `process.loadEnvFile()`. Native `fetch`, `FormData`, and global `WebSocket`.
- **FS & Patterns**: `import { glob } from 'node:fs/promises'`. Native `URLPattern` for route matching.
- **Resource Management**: Use `using` / `await using` for deterministic database/file handle disposal.
- **Crypto & Tests**: Native `crypto.hash()`. App tests use Vitest via `pnpm test` (see `mms-testing-e2e`).

## 4. Verification & Quality Gates

```bash
bash .agent/skills/mms-dev-setup/scripts/verify-env.sh
curl http://localhost:3000/health && curl http://localhost:3000/ready
pnpm typecheck
pnpm test
```

## Related skills

`mms-testing-e2e`, `mms-ops-deploy`, `mms-linux-compatibility`, `mms-agent-standards`.
