---
description: Local dev setup, environment variables, Docker, PM2, ports, Linux compatibility, and CI workflows
paths:
  - "package.json"
  - "pnpm-workspace.yaml"
  - "turbo.json"
  - "apps/backend/Dockerfile"
  - "restart_servers.sh"
  - "apps/backend/.env.example"
  - "scripts/**/*.sh"
  - "scripts/apache/**"
  - "scripts/production/**"
  - "apps/backend/src/index.ts"
  - ".github/workflows/**"
  - "ecosystem.config.cjs"
  - "docker-compose*.yml"
---

# MMS Operations & Infrastructure

**Workflow skills:** local install/run → `mms-dev-setup` · production Hetzner/Apache → `mms-ops-deploy` · VPS casing/LF/PM2 → `mms-linux-compatibility`.

## 1. Prerequisites & Environment Setup
- **Runtimes & Tooling:** Node.js `>=24.14.0` (native `--env-file=.env` and `--experimental-strip-types`; `dotenv` is banned), Corepack `pnpm@11.15.1`, Turbo 2 (root devDependency), PostgreSQL 16.
- **Root Commands:** `pnpm dev` (concurrent apps), `pnpm build`, `pnpm typecheck`, `pnpm test`. Local screen session: `./restart_servers.sh [status|stop|--foreground]`.

## 2. Environment Variables & Ports Configuration
- **Port Bindings:** Production Backend **`5002`** (`MMS_PRODUCTION_BACKEND_PORT`); Local Dev Backend `3000` (`MMS_DEV_BACKEND_PORT`); Local Dev Frontend `5173`. Binding to `3000` or `3001` under `NODE_ENV=production` is strictly forbidden (server must exit).
- **Subdomain Routing:** Vite dev proxy forwards `X-Forwarded-Host`; resolved via `AsyncLocalStorage` (standard `node:async_hooks`, no experimental flag).
- **Reverse Proxy & Sockets:** Apache terminates TLS HTTP/2, Brotli/gzip, and routes `/ws` & `/api/ws` via `mod_proxy_wstunnel` (timeout 60s, keepalive on). Fastify synchronizes `keepAliveTimeout` (30s) and `headersTimeout` (35s) with TCP Keep-Alive.
- **Graceful Shutdown:** On `SIGTERM`/`SIGINT`, flip `/ready` to 503, wait `SHUTDOWN_DRAIN_DELAY_MS` (5s), close server, pause BullMQ workers, and close DB pools before exit.
- **Sanctioned Wipes:** Tenant wipe: `deleteWorkspace` → `purgeTenantDataBySubdomain`. Platform reset: `POST /api/platform/settings/reset-database` (super-user only). Ad-hoc `DROP SCHEMA` or client-side wipes are banned.

## 3. Linux & Ubuntu VPS Compatibility
- **File System & Imports:** Strict case-sensitive paths matching disk. Unix LF line endings for all `.sh` scripts. Never hardcode backslashes; prefix core imports with `node:`.
- **Process Security:** Run PM2 and Node under non-root users (`node`, `www-data`). Enforce write containment strictly to `/var/www/mmsv2/data`; application code is read-only.
- **Structured Logging:** Pino emits structured JSON directly to `stdout`. Host process managers handle rotation.

## 4. CI/CD & Deploy Procedures
- **Local CI (before push):** `pnpm ci:local` runs the pre-PR gates plus path-aware FE/BE/shared unit tests (`scripts/ci/local-ci.sh`), scoped to the change set: `turbo typecheck --affected`, ESLint on changed files (`scripts/ci/lint-changed.sh`), code-norm / DB-projection ratchets with `--changed` (per-file vs merge-base), `vitest --changed <merge-base>`, with the gates run in parallel; tooling/config or `packages/shared` changes fall back to full runs. `pnpm ci:local:full` runs every suite in full and adds i18n/build/bundle. Opt-in `--with-db` / `--with-e2e` when those buckets changed. `.githooks/pre-commit` checks staged secrets and lints staged files; `.githooks/pre-push` blocks direct pushes to `main` and enforces `pnpm ci:local` (override either only with `SKIP_LOCAL_CI=1` when the user explicitly asks). Run `pnpm ci:local:full` manually before opening a PR when needed. This is not a full GitHub Actions replay (`act` is out of scope). Norm owner for the gate: `mms-completion-review.md` → skill `mms-code-review`.
- **CI DAG (`ci.yml`):** `changes` path filter, `workflow-lint` (actionlint + zizmor), three parallel quality jobs — `typecheck-lint` (typecheck, lint, audit, ratchets, i18n, mirror sync), `build` (build, bundle budget) and `secret-scan` (gitleaks, full history) — PR-only `dependency-review`, and path-gated `test-frontend` (sharded, blob merge → `test-frontend-coverage`), `test-backend-unit`, `test-backend-db`, `e2e` (sharded Playwright → `merge-reports`) all feed `ci-gate`. **Unit test scope:** `changes` sets `test_scope` — PRs that touch only app code run `vitest --changed HEAD^1` (unsharded, no coverage; `test-frontend-coverage` skipped); PRs touching `packages/shared`, any `package.json`/lockfile/`pnpm-workspace.yaml`/`.nvmrc`, `turbo.json`, tsconfig, Vitest config or test setup, or `.github/**` run the full sharded suites with coverage; every non-PR run is full, and `ci-gate` fails a non-PR run that is not. On push to `main`, `build` also packages, attests, and uploads the `mms-dist` release artifact; it is the only job with `id-token`/`attestations` write.
- **Deployment Flow:** `deploy.yml` triggers on a successful same-repo CI push run for `main`, downloads and attestation-verifies that run's `mms-dist` artifact (build once, promote); a manual dispatch promotes the `mms-dist` artifact of the green push CI run for that exact commit (only the `allow_unverified` incident hatch rebuilds), SCPs it to the VPS, and runs `scripts/deploy-on-server.sh` pinned to `DEPLOY_SHA` via `scripts/ci/ssh-exec.sh`. Rollback via `scripts/deploy-rollback.sh` (restores `dist/` only — migrations must be expand/contract). DDL runs before the PM2 swap and on boot via `initDb`.
- **Workflow Security:** Third-party actions pinned to full commit SHAs; checkouts set `persist-credentials: false`; secrets reach `run:` only through `env:`; the production host key is pinned via `SSH_KNOWN_HOSTS`. Enforced by the `workflow-lint` job.
- **Health Endpoints:**
  - `GET /health`: 200 liveness check (unauthenticated).
  - `GET /ready`: 200 on DB ping; 503 if PostgreSQL disconnected. PM2 curls `/ready` post-deploy.
  - `GET /metrics`: Prometheus format; requires `METRICS_ENABLED=true` and `Authorization: Bearer $METRICS_TOKEN`. Labels route patterns, never raw IDs.

## 5. Audit Operations, Statement Auditing & Storage Tiering
- **Database Auditing (`pgAudit`):** Preload `postgresql-16-pgaudit` (`pgaudit.log = 'write, ddl, role'`) to capture direct console queries and DDL bypassing Fastify.
- **Verification Cron & Tiering:** Scheduled `runAuditVerificationJob` validates Merkle roots and hash chains (`mms-data-layer.md` §5). Cold audit archives (>90 days) export to WORM-locked storage (S3 Object Lock / MinIO); monthly partitions detached via automated lifecycle.

## 6. Environment Variables & Secret Lifecycle
- **Documentation & Hygiene:** Document variable shape and safe defaults in `apps/backend/.env.example` in the same change. Never commit real `.env` files.
- **Client Bundle Isolation:** Only `VITE_*` keys reach the browser. Never expose `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, or server flags in frontend code or Vite `define`.
- **Fail Closed:** Fail process startup immediately if required security credentials (`JWT_SECRET`, `DATABASE_URL`) are missing or defaulted.
- **Zero Echo:** Never log or output secrets into error messages, health endpoints, CI logs, or transcripts.

