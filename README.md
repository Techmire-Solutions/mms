# Madrasa Management System (MMS)

A full-stack, multi-tenant **Madrasa Management System** built for Islamic educational institutions. MMS manages students, teachers, sessions, enrollments, attendance, finance, examinations, messaging, and more — with robust multi-tenancy, encrypted backups, tamper-evident audit trails, and RTL/BiDi internationalisation (English, Arabic, Urdu, Persian).

---

## Stack

| Layer             | Technology                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**      | React 19 · Vite 8 · Tailwind CSS v4 · Radix UI / shadcn · TanStack Query v5 · Framer Motion · Recharts                                                               |
| **Backend**       | Fastify 5 · Node.js ≥ 24.14 (`--experimental-strip-types`) · TypeScript 7 (strict)                                                                                   |
| **Database**      | PostgreSQL 16 · Drizzle ORM · Row-Level Security (RLS) · Forward-only migrations                                                                                     |
| **Cache / Queue** | Redis 7 · BullMQ                                                                                                                                                     |
| **Shared**        | `@mms/shared` — Zod DTOs, types, manifests, pure utils (zero DOM/React/Fastify deps)                                                                                 |
| **Monorepo**      | pnpm workspaces · Turborepo task graph (`^build` ordering)                                                                                                           |
| **CI/CD**         | GitHub Actions — change-gated parallel jobs (ratchets · build+provenance · unit/coverage · DB · E2E) behind a required "CI Gate"; separate deploy workflow on `main` |
| **Production**    | Hetzner VPS · PM2 · Apache reverse proxy (PORT 5002)                                                                                                                 |

---

## Repository Layout

```
mms/
├── apps/
│   ├── backend/          # Fastify 5 API server + BullMQ worker
│   └── frontend/         # React 19 SPA
├── packages/
│   └── shared/           # @mms/shared — SSOT types, Zod schemas, pure utils
├── e2e/                  # Playwright end-to-end tests
├── scripts/              # i18n checker, ESLint TS compat shim, sync scripts
├── docker-compose.yml    # Postgres 16 + Redis 7 + backend + worker
├── ecosystem.config.cjs  # PM2 config (production)
├── restart_servers.sh    # Local dev entry point (GNU screen)
└── turbo.json
```

### Backend source (`apps/backend/src/`)

| Directory       | Purpose                                             |
| --------------- | --------------------------------------------------- |
| `contacts/`     | Canonical person/contact registry                   |
| `students/`     | Student module — enrollment linking, field guards   |
| `faculty/`      | Faculty (teachers) module                           |
| `sessions/`     | Class sessions                                      |
| `enrollments/`  | Session ↔ student enrollments                       |
| `attendance/`   | Attendance records                                  |
| `examinations/` | Exam + question bank                                |
| `finance/`      | Invoices, payments, double-entry ledger             |
| `accounting/`   | Accounting / chart of accounts                      |
| `messaging/`    | SMS / WhatsApp campaigns                            |
| `hasanat/`      | Hasanat (merit) points module                       |
| `obligations/`  | Obligations / dues tracking                         |
| `questionBank/` | Question bank                                       |
| `users/`        | Workspace users + RBAC                              |
| `services/`     | Auth, audit verification, artifact purge schedulers |
| `lib/`          | DB pool, Redis, Pino logger, live WebSocket push    |
| `db/`           | Drizzle schema, migrations, RLS helpers             |
| `worker/`       | BullMQ job processors (exports, imports, bulk ops)  |
| `middleware/`   | Auth, CSRF, rate-limit, tenant isolation            |

### Frontend source (`apps/frontend/src/`)

| Directory                   | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `tenant/features/`          | 20 feature modules (students, faculty, sessions, finance, …) |
| `tenant/hooks/collections/` | TanStack Query facades per resource                          |
| `platform/`                 | Platform apex (super-admin, tenant management)               |
| `components/ui/`            | Shared design-system primitives                              |
| `lib/`                      | `apiClient`, query factories, i18n, routing                  |

---

## Documentation

All repository documentation is indexed in [`docs/README.md`](docs/README.md) — architecture,
soft-delete, ADRs (`docs/adr/`), audits, and plans.

---

## Prerequisites

| Tool       | Version                                 |
| ---------- | --------------------------------------- |
| Node.js    | ≥ 24.14.0                               |
| pnpm       | 11.15.1 (enforced via `packageManager`) |
| PostgreSQL | 16 (or use Docker)                      |
| Redis      | 7 (or use Docker)                       |

---

## Quick Start — Local Development

### 1. Clone and install

```bash
git clone <repo-url> mms
cd mms
pnpm install
```

### 2. Configure environment

```bash
# Root secrets (for docker-compose)
cp .env.example .env

# Backend app config
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` — minimum required vars:

```env
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mms
REDIS_URL=redis://:your-redis-password@localhost:6379
PLATFORM_APP_URL=http://localhost:5173
```

### 3. Start infrastructure (Postgres + Redis)

**Option A — Docker Compose (recommended):**

```bash
docker compose up postgres redis -d
```

**Option B — Local Postgres/Redis already running:** skip this step.

### 4. Run migrations

```bash
cd apps/backend
pnpm db:migrate
```

### 5. Start dev servers

```bash
# From repo root — starts backend :3000 + frontend :5173 in GNU screen
./restart_servers.sh

# Attach to see logs
screen -r mms-dev

# Or run in foreground (Ctrl+C to stop)
./restart_servers.sh --foreground
```

| URL                            | Service              |
| ------------------------------ | -------------------- |
| `http://localhost:5173`        | Frontend             |
| `http://localhost:3000/health` | Backend health check |

---

## Available Commands

### Root (Turborepo)

```bash
pnpm dev            # Start frontend + backend in parallel
pnpm build          # Build all packages
pnpm typecheck      # TypeScript strict check across all workspaces
pnpm test           # Run all unit tests (Vitest)
pnpm test:coverage  # Coverage report
pnpm lint           # ESLint across all workspaces
pnpm test:e2e       # Playwright E2E suite
pnpm check:i18n     # Verify translation key completeness (en/ar/ur/fa)
```

### Backend (`apps/backend/`)

```bash
pnpm dev              # tsx watch (hot reload)
pnpm worker           # BullMQ worker process (hot reload)
pnpm build            # tsc + copy migrations + worker templates
pnpm db:migrate       # Run forward-only Drizzle migrations
pnpm db:reset         # ⚠️ Wipe and re-seed (dev only)
pnpm test:db          # Integration tests against a real DB
pnpm audit:verify     # Verify audit chain integrity
pnpm audit:detach     # Detach an old audit partition (archival)
```

### Frontend (`apps/frontend/`)

```bash
pnpm dev         # Vite dev server
pnpm build       # Production bundle
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint
pnpm test        # Vitest unit tests
```

---

## Docker Compose (Full Stack)

Runs Postgres 16 + Redis 7 + backend API + BullMQ worker — all secrets interpolated from `.env` (never hardcoded).

```bash
# Copy and fill root .env first
cp .env.example .env   # set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET

docker compose up -d
```

| Container      | Port             | Notes                             |
| -------------- | ---------------- | --------------------------------- |
| `mms-postgres` | `127.0.0.1:5432` | Bound to loopback only            |
| `mms-redis`    | `127.0.0.1:6379` | Password-protected, loopback only |
| `mms-backend`  | `5002`           | API + health endpoint             |
| `mms-worker`   | —                | BullMQ job processor              |

---

## Production Deploy (Hetzner + PM2)

```bash
# Build
pnpm build

# Start / restart via PM2
pm2 start ecosystem.config.cjs
pm2 save
```

PM2 manages two processes: `mmsv2-backend` (API on PORT 5002) and `mmsv2-worker` (BullMQ). Apache proxies `yourdomain.com → 127.0.0.1:5002`.

Automated deploys on push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

---

## Environment Variables Reference

### Root `.env` (docker-compose only)

| Variable            | Required | Description                                 |
| ------------------- | -------- | ------------------------------------------- |
| `POSTGRES_PASSWORD` | ✅       | PostgreSQL password                         |
| `REDIS_PASSWORD`    | ✅       | Redis `requirepass` value                   |
| `JWT_SECRET`        | ✅       | 256-bit hex secret (`openssl rand -hex 32`) |
| `POSTGRES_USER`     | —        | Default: `postgres`                         |
| `POSTGRES_DB`       | —        | Default: `mms`                              |

### `apps/backend/.env`

| Variable                       | Required | Description                               |
| ------------------------------ | -------- | ----------------------------------------- |
| `JWT_SECRET`                   | ✅       | Same 256-bit hex key                      |
| `DATABASE_URL`                 | ✅       | `postgresql://user:pass@host:5432/db`     |
| `REDIS_URL`                    | ✅       | `redis://:password@host:6379`             |
| `NODE_ENV`                     | —        | `development` / `production` / `test`     |
| `PORT`                         | —        | `3000` dev · `5002` prod                  |
| `PLATFORM_APP_URL`             | —        | Frontend URL for CORS + email links       |
| `MMS_APP_DOMAIN`               | —        | Apex domain for tenant subdomains         |
| `PG_POOL_MAX`                  | —        | Default: `20`                             |
| `PG_STATEMENT_TIMEOUT_MS`      | —        | Default: `30000`                          |
| `PLATFORM_RESEND_API_KEY`      | —        | Transactional email via Resend            |
| `PLATFORM_SMTP_HOST`           | —        | Transactional email via SMTP              |
| `PLATFORM_ALLOW_ENV_BOOTSTRAP` | —        | `false` by default; enables admin seeding |

See [`apps/backend/.env.example`](apps/backend/.env.example) for the full reference with comments.

---

## Feature Modules

MMS uses a **three-tier module architecture** (Work · Reports · Setup) across all domains:

| Module            | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| **Contacts**      | Canonical person registry shared across all person modules    |
| **Students**      | Student profiles, custom fields, tab guards, guardian linking |
| **Teachers**      | Teacher profiles, custom fields, employment fields            |
| **Sessions**      | Class/lecture sessions, scheduling                            |
| **Enrollments**   | Session ↔ student many-to-many with status tracking           |
| **Attendance**    | Per-session attendance with bulk entry                        |
| **Examinations**  | Exam management linked to sessions and question bank          |
| **Question Bank** | Categorised question library with source citations            |
| **Finance**       | Invoices, payment collection, fee plans                       |
| **Accounting**    | Double-entry ledger, chart of accounts, journal entries       |
| **Hasanat**       | Islamic merit points — track, assign, redeem                  |
| **Obligations**   | Dues and obligation tracking per student                      |
| **Messaging**     | SMS/WhatsApp campaigns with template personalisation          |
| **Users**         | Workspace users with role-based access control (RBAC)         |
| **Dashboard**     | Configurable widget dashboard with trend metrics              |
| **Settings**      | Global, branding, i18n, email, backup/restore                 |

---

## Security Architecture

- **Multi-tenancy:** Every tenant table uses `FORCE ROW LEVEL SECURITY` + `SET LOCAL app.current_tenant` via `withTenantTransaction`.
- **Auth:** `@fastify/cookie` HttpOnly session cookies + `@fastify/jwt`. No JWTs in `localStorage`.
- **CSRF:** `Sec-Fetch-Site: same-origin|same-site|none` origin gate on all cookie-mutating routes.
- **RBAC:** `can()` permission checks via `@mms/shared` — no raw `role ===` comparisons.
- **Soft-Delete System:** In-place lifecycle archiving across all tenant entities · partial unique indexes (`WHERE deleted_at IS NULL`) · `BEFORE DELETE` triggers forbidding physical deletes · atomic conditional latches · transactional outbox CDC tombstones · URL-synced trash directories with 5–10s optimistic Undo toasts · scheduled chunked hard-purge workers (see [`docs/soft-delete.md`](docs/soft-delete.md) · skill `mms-soft-delete`).
- **Audit Trail:** RFC 8785 canonical JSON payloads · per-tenant sharded hash chains · Merkle rollups · `INSERT`-only audit tables · crypto-shredding for Right to Erasure.
- **Backups:** AES-256-GCM encrypted workspace exports with PBKDF2-derived keys · validate-before-wipe safety gate.
- **Input validation:** All DTOs via `@mms/shared` Zod schemas (`.strict()` on write paths) — raw client bodies are never trusted.

---

## Internationalisation (i18n)

Full BiDi / RTL support with four languages:

| Locale | Language              |
| ------ | --------------------- |
| `en`   | English (LTR)         |
| `ar`   | Arabic (RTL)          |
| `ur`   | Urdu (RTL)            |
| `fa`   | Persian / Farsi (RTL) |

Translation keys live in `@mms/shared` (`appTranslationsEn.ts`, `appTranslationsAr.ts`, etc.). Run `pnpm check:i18n` to verify completeness.

---

## Testing

```bash
pnpm test              # Unit tests (all workspaces via Turborepo)
pnpm test:coverage     # Coverage with @vitest/coverage-v8
pnpm test:e2e          # Playwright E2E (requires running stack)

# Scoped
cd apps/backend && pnpm test:db   # Integration tests against real Postgres
cd packages/shared && pnpm test   # Shared utility unit tests
```

CI runs on every PR and push to `main` via [`.github/workflows/ci.yml`](.github/workflows/ci.yml): a
`changes` job selects the scope, then typecheck/lint + ratchets, build (+ provenance attestation),
secret scan, frontend/backend unit tests + coverage, DB integration tests and E2E run as a parallel
job graph. The required status is the aggregate **CI Gate (All Checks Passed)**.

Deployment is not part of that workflow — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
runs on `workflow_run` after CI succeeds on `main`.

---

## Agent / AI Tooling

This repository ships configuration for multiple AI coding agents:

| Tool        | Config                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| Antigravity | [`AGENTS.md`](AGENTS.md) · [`.agent/`](.agent/)                           |
| Cursor      | [`.cursor/rules/`](.cursor/rules/) · [`.cursor/skills/`](.cursor/skills/) |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) · [`.claude/`](.claude/)                         |

Start with [`AGENTS.md`](AGENTS.md) for the full skill/rule index and workspace orientation.

---

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full connect → commit → push → PR → deploy flow.

1. Branch off `main` (`feat/`, `fix/`, `chore/`) and use Conventional Commits for commit messages and PR titles.
2. Prefer `pnpm ci:local` before opening a PR (`pnpm ci:local:full` / `--with-db` / `--with-e2e` when those buckets changed). Pre-commit checks secrets and lints staged files; pre-push blocks direct pushes to `main` and runs the affected-only `ci:local`.
3. Never commit `.env` files, secrets, or credentials.
4. When changing rules or skills, run `bash .agent/scripts/sync-all.sh` to keep Antigravity, Cursor, and Claude Code in sync.
