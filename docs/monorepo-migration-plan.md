# MMS Monorepo Migration Blueprint

**Status:** backend module extraction **complete** — 21 `@mms/mod-*` packages own every business domain; `apps/api/src` holds only kernel/composition code (see `.agent/rules/mms-migration-status.md` §0). Remaining: frontend app-owned UI (P8) · **Scope:** repository layout and package boundaries only · **Behaviour target:** zero change except the additive `/api/tenant/*` namespace · **Measured against:** the working tree at 2026-11-25 (base commit `edd92a58a` + ≈6,900 uncommitted paths; 6,893 at measurement time — the tree is being edited concurrently, so re-measure before quoting a count).

> **Read this first.** The tree is **not** the tree at `HEAD`. The migration to the 3-tier layout is already
> roughly 60 % executed and almost entirely uncommitted: `packages/{db,be-core,fe-core,ui}`, both module
> packages, `tooling/*`, the `@mms/shared → @mms/contracts` rename and this document are untracked or
> modified. Every number below was measured from the working tree. P0 therefore starts by stabilizing
> that work — never by adding another move on top of an unreviewed tree.

Related: [`SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md) · [`docs/architecture.md`](./architecture.md) ·
[`docs/adr/`](./adr/) · [`docs/migration-milestones.md`](./migration-milestones.md) ·
[`packages/modules/README.md`](../packages/modules/README.md) ·
[`.agent/rules/mms-module-architecture.md`](../.agent/rules/mms-module-architecture.md) ·
[`.agent/rules/mms-data-layer.md`](../.agent/rules/mms-data-layer.md) ·
[`.agent/rules/mms-api-interface.md`](../.agent/rules/mms-api-interface.md) ·
[`.agent/rules/mms-auth-security.md`](../.agent/rules/mms-auth-security.md) ·
[`.agent/rules/mms-migration-status.md`](../.agent/rules/mms-migration-status.md).

---

## 0. How to use this document

1. Read §4 (binding decisions) and §8 (phases) before touching anything. Several phases are only safe
   because of the decisions.
2. Execute phases in order. A phase starts only when the previous phase's **exit** is green.
3. Every directory move is a checked-in map plus `scripts/codemod/move-modules.mjs`. No hand-edited
   specifier rewrites, and never a move and a rename of the same file in one PR.
4. Every phase PR runs its **gate set** (§8) and updates the ratchets it names. A phase that leaves a
   ratchet scanning an empty directory is a failed phase — see R1 and §2.7.
5. The open debt register in [`mms-migration-status.md`](../.agent/rules/mms-migration-status.md) §1 is
   **out of scope**. A move must not "fix" a11y copy, live-push coverage, contacts full loads or finance
   `numeric(12,2)` precision.

---

## 1. Executive summary

### 1.1 Where the migration actually stands

| Target tier                                | State           | Evidence (measured)                                                                                                                                                                 |
| ------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tooling/{eslint,typescript,tailwind}-config` | **done**    | 3 packages, `tooling/*` is a workspace glob (`pnpm-workspace.yaml:5`), consumed by every package's `eslint.config.js`; `tooling/eslint-config/boundaries.mjs` already encodes the target graph |
| `packages/contracts`                       | **done**        | `@mms/contracts`, 1,030 files / 158.6k LOC; only the root barrel plus declared subpaths are importable (`check:shared-structure` green)                                             |
| `packages/db`                              | **partial**     | 125 files: schema (91 files, 12 relation files), 277 SQL migrations + 277 journal entries + 99 snapshots, RLS/tenant scope, soft-delete helpers, seeds. **438 repositories, 21 db root files and 77 TS data migrations are still in `apps/backend/src/db`** |
| `packages/be-core`                         | **partial**     | 91 files (auth, audit, http/crud, jobs/exports, logger, queues, rbac, realtime, redis, telemetry, transports). `apps/backend/src/lib` still holds 119 files (**50 are shims**) and `services` 197 files (**5 shims**) |
| `packages/fe-core`                         | **partial**     | 274 files / 199 export subpaths; `apps/frontend/src/lib` still holds 450 files (**92 facades**), `hooks` 83 (**16 facades**), `components` 834 (**190 facades**)                     |
| `packages/ui`                              | **partial**     | 210 files / 68 export subpaths; `apps/frontend/src/components/ui` is a 31-file facade (mostly 2-LOC re-exports); `components/app` (306 files) and `components/common` (92) are still app-local                   |
| `packages/modules/<domain>`                | **2 of 22**     | `@mms/mod-accounting` 348 files (routes/use-cases/repository/jobs/frontend done, 37 backend shims + 14 adapters left in app) and `@mms/mod-iam` 28 files (backend only; `users` domain still in app; its frontend has 1 consumer) |
| `apps/api`                                 | **missing**     | Backend is still `apps/backend` (`mms-backend`), 2,271 `.ts` files (+10 SQL) / 294.3k LOC                                                                                                     |
| `apps/tenant-web` / `apps/platform-web`    | **missing**     | One Vite app (`mms-frontend`, 4,261 `.ts`/`.tsx`) that chooses tenant vs apex from `window.location.hostname`                                                                        |
| Gates / CI                                 | **partial**     | CI path filters already list `packages/{db,be-core,fe-core,ui,modules/*}` but not `apps/api`, `apps/tenant-web`, `apps/platform-web`; 41 gate scripts exist, **8 of them pass vacuously after a move** |
| Docs / rules                               | **partial**     | `docs/architecture.md` and `packages/modules/README.md` describe the target; `README.md`, `SYSTEM_ARCHITECTURE.md`, `AGENTS.md` layout and `.cursor/rules/mms-structure-naming.mdc` still describe the 2-app topology |

### 1.2 What remains (headline numbers)

- **20 module packages missing**; 143 backend re-export shims (9.3 % of 1,530 non-test backend files) and
  329 frontend facades to retire.
- **Backend kernel is still one strongly connected component**: `lib ↔ services` 20/204, `lib ↔ db`
  4/136, `services ↔ db` 86/67, `services ↔ worker` 6/21 import statements.
- **20 domain↔domain edges / 55 import statements / 47 importer files**, with two SCCs:
  `{accounting, obligations}` and `{students, enrollments, sessions, attendance}`.
- **438 repositories** in one flat directory, 42 filename families, **104 cross-family statements**, and
  **12 repository files importing domain write guards** (the inverted edge).
- **207 route files / 62 registrations**; only 24 tenant route files reference `authenticateTenant`
  directly, and there are 20 `registerModuleAccess` call sites across `apps/backend/src` +
  `packages/modules` (most gating is inherited from parent plugins).
- **54 literal `apps/backend|apps/frontend` lines across 15 deploy/ops files**, plus one constructed path
  in `apps/backend/src/plugins/frontendSpa.ts:19`.
- **8 gates pass vacuously after a move**, 2 lose scan coverage silently, 1 is caught only by the separate
  `--ratchet` CI step (§2.7).

### 1.3 Sequencing principle

Extract **bottom-up by dependency depth**; break the kernel cycles **before** the first module wave; do
the risky irreversible things (renaming apps, splitting the web bundle, changing every deploy literal)
**last**, when every module already lives in a package. Never mix a directory move with a package rename.

### 1.4 Phase map (details in §8)

| Phase | Deliverable                                                                   | Depth | Modules |
| ----- | ----------------------------------------------------------------------------- | ----- | ------- |
| P0    | Governance: stabilize the tree, path SSOT, fail-closed gates, dual-prefix CI   | —     | —       |
| P1    | Backend kernel completion: `packages/db` + `packages/be-core`                  | 0     | —       |
| P2    | Frontend kernel completion: `@mms/ui` + `@mms/fe-core` + shared ESLint rules    | 0     | —       |
| P3    | Finish the in-flight `accounting` package                                     | 0     | 1       |
| P4    | Depth-0 leaves (`contacts` first)                                              | 0     | 10      |
| P5    | Depth-1 (`faculty`, `messaging`, `billing`)                                    | 1     | 3       |
| P6    | Depth-2/3 (`students`/`enrollments`/`sessions`/`attendance` SCC, then 4 more)  | 2–3   | 8       |
| P7    | `apps/api` rename + `/api/tenant/*` dual mount + composition                    | 4     | —       |
| P8    | `apps/tenant-web` + `apps/platform-web` + host-based serving                    | 4     | —       |
| P9    | Cleanup: docs/rules/ADRs, permanent ratchets, close deprecation window          | 5     | —       |

---

## 2. Current-state inventory

### 2.1 Top-level tree

| Path                                                                                                                            | Kind      | Contents / purpose                                                                                                            | Fate                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/backend/`                                                                                                                  | app       | Fastify 5 API + BullMQ worker (`mms-backend`)                                                                                 | → `apps/api` (P7) + `packages/db`/`be-core` (P1) + modules |
| `apps/frontend/`                                                                                                                 | app       | React 19 + Vite 8 SPA hosting **both** consoles in one bundle (`mms-frontend`)                                                 | → `apps/tenant-web` + `apps/platform-web` (P8)         |
| `packages/contracts/`                                                                                                            | package   | `@mms/contracts`: Zod DTOs, ts-rest contracts, manifests, i18n packs, pure utilities                                          | stays                                                  |
| `packages/db/`                                                                                                                   | package   | `@mms/db`: schema, migrations, client, tenant context/RLS, soft-delete, seeds                                                 | stays, absorbs `apps/backend/src/db` (P1)              |
| `packages/be-core/`                                                                                                              | package   | `@mms/be-core`: auth/RBAC guards, audit, http/crud factories, jobs/exports, redis/queues, realtime, transports                 | stays, absorbs kernel (P1)                             |
| `packages/fe-core/`                                                                                                              | package   | `@mms/fe-core`: typed API SDK, query/auth/tenant contexts, providers, forms, i18n, storage, reporting                          | stays, absorbs generic FE runtime (P2)                 |
| `packages/ui/`                                                                                                                   | package   | `@mms/ui`: primitives, layout shells, tables, form controls, dumb UI                                                          | stays, absorbs composites (P2)                         |
| `packages/modules/{iam,accounting}/`                                                                                             | packages  | 2 of ~22 audience-separated vertical slices                                                                                   | 20 more added (P3–P6)                                  |
| `tooling/{eslint-config,typescript-config,tailwind-config}/`                                                                    | packages  | shared flat configs, compiler presets, Tailwind v4 theme                                                                      | stays                                                  |
| `e2e/`                                                                                                                           | package   | Playwright, 28 specs in `tests/{tenant,platform,a11y,responsive,features}`                                                    | stays, gains per-app projects (P8)                     |
| `scripts/`                                                                                                                       | tooling   | 7 subdirs: `apache/ ci/ codemod/ i18n/ lib/ perf/ production/`, 41 gate scripts, deploy/ops                                 | stays; paths centralised (P0), literals updated (P7/P8) |
| `.github/`                                                                                                                       | CI        | 8 workflows (25 jobs), 2 composite actions, CODEOWNERS, dependabot                                                            | filters/literals per phase                             |
| `.githooks/`                                                                                                                     | tooling   | `pre-commit`, `commit-msg`, `pre-push`                                                                                        | P1/P7                                                 |
| `docker/`                                                                                                                        | ops       | Postgres init script for the `mms_app` RLS role                                                                                | unchanged                                              |
| `perf/`                                                                                                                          | docs      | Lighthouse/perf baselines                                                                                                     | unchanged                                              |
| `docs/`                                                                                                                          | docs      | 175 top-level docs, 308 files, ADR 001–018                                                                                    | this document + ADRs 019+. (P9)                        |
| `.agent/ .cursor/ .claude/ .dsh/`                                                                                                | standards | 24 rules, 50 skills, workflows: canonical `.cursor/rules` + `.agent/skills`, mirrored                                        | P9 (sync + verify)                                     |
| `.logs/ .turbo/ .pnpm-store/ .playwright-browsers/ .worktrees/ node_modules/`                                                   | generated | local artefacts (gitignored)                                                                                                  | untouched                                              |
| `.commandcode/ .vscode/ .superpowers/`                                                                                           | misc      | tool state                                                                                                                    | untouched                                              |
| root files                                                                                                                       | mixed     | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `ecosystem.config.cjs`, `docker-compose.yml`, `restart_servers.sh`, `lighthouserc*.cjs`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `SYSTEM_ARCHITECTURE.md`, `CONTRIBUTING.md`, `DECISIONS.md`, 11 `CONTACTS_*.md`, `ACTION_COLUMN_REVIEW.md`, `SETTINGS_REVIEW.md`, `failed_job.log`, `lhci-comment.md` | per phase; stray logs + root audit reports cleaned in P0/P9 |

### 2.2 Workspace projects and build graph

13 workspace projects plus the root (`pnpm-workspace.yaml` globs `apps/*`, `packages/*`, `packages/modules/*`, `tooling/*`, `e2e`).

| Path                            | Name                   | build | typecheck | lint | test | test:coverage | Notes                                                        |
| ------------------------------- | ---------------------- | :---: | :-------: | :--: | :--: | :-----------: | ------------------------------------------------------------ |
| `apps/backend`                  | `mms-backend`          |   ✓   |     ✓     |  ✓   |  ✓   |       ✓       | has `db:migrate`, `test:db`, `test:rls`, 6 coverage scripts   |
| `apps/frontend`                 | `mms-frontend`         |   ✓   |     ✓     |  ✓   |  ✓   |       ✓       | 4-shard CI matrix                                             |
| `packages/contracts`            | `@mms/contracts`       |   ✓   |     ✓     |  ✓   |  ✓   |       ✓       | 20 domain folders under `src/`                                |
| `packages/db`                   | `@mms/db`              |   ✓   |     ✓     |  ✓   |  ✓   |       ✓       | **no `db:migrate`, no `test:db`/`test:rls`** today             |
| `packages/be-core`              | `@mms/be-core`         |   ✓   |     ✓     |  ✓   |  ✓   |       —       |                                                               |
| `packages/fe-core`              | `@mms/fe-core`         |   ✓   |     ✓     |  ✓   |  ✓   |       —       | source-exported, bundled by Vite                              |
| `packages/ui`                   | `@mms/ui`              |   ✓   |     ✓     |  ✓   |  ✓   |       —       | source-exported                                               |
| `packages/modules/accounting`   | `@mms/mod-accounting`  |   ✓   |     ✓     |  ✓   |  ✓   |       —       | has `test:db`                                                 |
| `packages/modules/iam`          | `@mms/mod-iam`         |   ✓   |     ✓     |  ✓   |  ✓   |       —       |                                                               |
| `tooling/eslint-config`         | `@mms/eslint-config`   |   —   |     —     |  —   |  —   |       —       | **no `scripts` block** — turbo silently skips it              |
| `tooling/tailwind-config`       | `@mms/tailwind-config` |   —   |     —     |  —   |  —   |       —       | **no `scripts` block**                                        |
| `tooling/typescript-config`     | `@mms/typescript-config` |  —   |     —     |  —   |  —   |       —       | **no `scripts` block**                                        |
| `e2e`                           | `e2e-tests`            |   —   |     ✓     |  ✓   |  —   |       —       | uses `test:e2e`; no `build`/`test`                            |
| root                            | `mms-monorepo`         |   ✓   |     ✓     |  ✓   |  ✓   |       ✓       | `dev` still filters `--filter=mms-frontend --filter=mms-backend` |

Turbo tasks: `build` (`^build`, `dist/**`), `dev`, `typecheck`, `test`, `test:coverage`, `lint`,
`db:migrate`. `db:migrate` is implemented **only** by `mms-backend`, even though migrations now live in
`packages/db` — a P1 fix.

Catalogs: `zod`, `fastify`, `pino`, `drizzle-orm`, `react`, `react-dom`, `vite`,
`@tanstack/react-query`, `@ts-rest/react-query`, `react-router-dom`. Supply-chain cooldown
`minimumReleaseAge: 1440` plus reviewed exceptions; security `overrides` carry their rationale inline.

The three-behaviour `@mms/ui` alias blocks (vite, vitest, tsconfig) are duplicated in
`apps/frontend` and pin `react`, `react-dom`, `clsx`, `tailwind-merge`, `class-variance-authority`,
`lucide-react` and 12 `@radix-ui/*` packages to the app's `node_modules` — one React copy per bundle.
`packages/ui` and `packages/fe-core` themselves resolve from their own `node_modules` (self-contained).

### 2.3 Frontend entry points and console trees

One HTML entry, one bundle, runtime host branch:

```text
apps/frontend/index.html (script → /src/main.tsx)
└─ src/main.tsx        installChunkLoadRecovery → deferred Sentry → applyBootChrome()
                       → createRoot(<ErrorBoundary><App/></ErrorBoundary>) → registerServiceWorkerDeferred()
   └─ src/App.tsx      useIsTenantHost(); entry-path spinner; UserNotRegisteredError overlay
      ├─ src/providers/AppProviders.tsx  RootErrorBoundary → AuthProvider → QueryClientProvider
      │                                  → BrowserRouter → BrandingPaletteProvider → TenantProvider
      │                                  → TranslationProvider → UiConfigBridge → DirectionProvider
      └─ src/components/routing/HostRoutes.tsx   isTenantHost ? lazy TenantRoutes : lazy ApexRoutesWithSuspense
         ├─ src/tenant/routes/TenantRoutes.tsx   TenantScopedProviders → TenantBootGate → 30 rendered routes
         └─ src/platform/routes/ApexRoutes.tsx   MotionPreferences → PlatformAuthProvider → ApexBootPrefetch → 42 routes
```

- **Tenant registry:** `lib/routing/moduleRegistry.ts` declares `TENANT_APP_ENTRIES` (20 paths),
  `TENANT_APP_ROUTE_ACCESS` (20 keys: 16 module rules, 1 landing rule, 3 `open` rules),
  `TENANT_APP_PATHS` (18) and `TENANT_ROUTE_LOADERS` (20).
- **Platform registry:** `platform/routes/apexRouteRegistry.ts` declares 15 console entries in 8
  permission groups; `ApexRoutes.tsx` renders 9 explicit routes + 18 tenant-path gate routes + 15 console
  entries + 16 pathless guard/layout routes.
- **Host detection:** `useIsTenantHost()` = `!isApex || isBrowserOnTenantHost()` backed by
  `@mms/contracts/tenantUtils`; used by 20 files.
- **Only two files are dual-console:** `components/routing/HostRoutes.tsx` and
  `lib/routing/routePrefetch.ts` (5 dynamic `import("@/platform/…")`). There are **zero** static
  tenant→platform or platform→tenant imports, and zero tenant feature→feature imports (the one
  cross-feature hit is a test importing other features' `lib/` helpers and is not policed because it sits
  at `tenant/features/` root).
- **Boot chrome is console-specific:** apex hydrates platform branding (≤900 ms race) and applies
  `applyApexPlatformTheme("en")`; tenant applies `applyTenantDocumentFavicon` + `applyAppTheme`.
- Both consoles currently register the service worker; P8 makes it tenant-only.
- Sizes: `tenant` 2,487 files, `platform` 372, `components` 834, `lib` 450, `hooks` 83, `providers` 7,
  `__tests__` 18 repo-wide ratchet specs; 1,292 test files colocated under `src/`.

### 2.4 Backend entry points and route tree

Two process entries:

- `apps/backend/src/index.ts` — `buildApp()`, schedulers (auth-artifact purge, audit verification), drain-then-close shutdown.
- `apps/backend/src/worker/index.ts` — BullMQ worker (3 queues, outbox CDC listener, 7 schedulers) → `dist/worker/index.js`.

Composition root: `src/app.ts` → `initDb()` → `registerDefaultBackgroundJobRunners()` →
`registerPlugins()` (`telemetry`, `metrics`, `errorHandler`, `requestHooks`, `security`, `csrfOriginGuard`,
`http`, `productionHostGuard`, `staticAssets`) → `registerRoutes()` → `registerFrontendSpa()` → 404 handler.

`src/routes/index.ts` performs **62 registrations**. Route files: `routes/tenant` 160, `routes/platform`
23, `routes/common` 23, `routes/index.ts` 1 = **207**, plus **23 accounting route files** already inside
`packages/modules/accounting`. Route hygiene is good: **0** route files import `db/repositories` or
`drizzle-orm`; 125 import domain use-cases, 159 import `services/`, 193 import `lib/`.

Access-control surface (authoritative: `apps/backend/src/__tests__/moduleAccessCoverage.test.ts`, 494 lines):

- **17 `SYSTEM_MODULES`** (`globalSettingsModuleRegistry.ts`): `dashboard`, `contacts`, `messaging`,
  `tasks`, `students`, `faculty`, `sessions`, `attendance`, `enrollment`, `hasanat`, `workshops`,
  `examination`, `questionBank`, `finance`, `accounting`, `obligations`, `users`.
- **Manifest-id aliases** (`moduleAccessPolicy.ts`): `enrollments → enrollment`,
  `examinations → examination`.
- **20 module route prefixes** in `MODULE_ROUTE_PREFIXES` (faculty appears three times) and an explicit
  `NON_MODULE_ROUTES` table that classifies every non-module path with a reason.

Current tenant prefixes and target:

| module id          | current prefix(es)                                                              | target                        |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------------- |
| accounting         | `/api/accounting` (module package)                                              | `/api/tenant/accounting`      |
| attendance         | `/api/attendance`, `/api/attendance/calendar`                                   | `/api/tenant/attendance`      |
| contacts           | `/api/contacts`                                                                 | `/api/tenant/contacts`        |
| dashboard          | `/api/dashboard` (ts-rest contract)                                             | `/api/tenant/dashboard`       |
| enrollment         | `/api/enrollments`                                                              | `/api/tenant/enrollments`     |
| examination        | `/api/examinations`                                                             | `/api/tenant/examinations`    |
| faculty            | `/api/faculty`, `/api/tenant/faculty`, `/api/v1/tenant/faculty` (triple-mounted) | `/api/tenant/faculty`         |
| finance            | `/api/finance`                                                                  | `/api/tenant/finance`         |
| hasanat            | `/api/hasanat`                                                                  | `/api/tenant/hasanat`         |
| messaging          | `/api/messaging`                                                                | `/api/tenant/messaging`       |
| obligations        | `/api/obligations`                                                              | `/api/tenant/obligations`     |
| questionBank       | `/api/question-bank`                                                            | `/api/tenant/question-bank`   |
| sessions           | `/api/sessions`                                                                 | `/api/tenant/sessions`        |
| students           | `/api/students`                                                                 | `/api/tenant/students`        |
| tasks              | `/api/tasks`                                                                    | `/api/tenant/tasks`           |
| users              | `/api/users`, `/api/iam` (module package)                                       | `/api/tenant/users`           |
| workshops          | `/api/workshops` (manifest `restBasePath`)                                      | `/api/tenant/workshops`       |
| module-adjacent    | `/api/audit`, `/api/notifications`, `/api/saved-reports`, `/api/templates`, `/api/background-jobs`, `/api/workspace` + `/api/workspaces`, `/api/module-access` | `/api/tenant/<surface>` |

**Do not move into `/api/tenant/*`:** `/api/auth` (the `mms_refresh` cookie is scoped `Path=/api/auth/refresh`),
`/api/platform/*`, `/api/public/*`, `/api/db/*` (legacy document store), `/api/uploads/*`, `/api/ai/*`,
`/api/email|sms|whatsapp/*` (integration settings), `/ws` + `/api/ws` (Apache WS rules), `/health`,
`/ready`, `/metrics`, `/api/openapi.json`.

### 2.5 Database schema and migration directories

| Path                                                     | Contents                                                                                                                                              | Constraint                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/db/src/schema/`                                | 91 `.ts` files (incl. `index.ts`, `relations.ts`, 12 files under `relations/`)                                                                        | every `pgTable` exports `$inferSelect`, `$inferInsert`, bidirectional `relations` (`mms-data-layer` §1.5) |
| `packages/db/migrations_drizzle/`                        | 277 `.sql`, `meta/_journal.json` **277 entries** (last `0276_platform_soft_delete_triggers`), **99** `*_snapshot.json`                                | lock-timeout, snapshot chain, journal chronology, forward-only (4 ratchets)                   |
| `packages/db/migrations_drizzle/*.sql` (RLS)             | 97 files contain `ROW LEVEL SECURITY`, 94 `FORCE ROW LEVEL SECURITY`, 96 `CREATE POLICY`                                                              | new tenant tables require `FORCE RLS` (data-layer §1.2)                                      |
| `packages/db/src/`                                       | `tenant-context.ts` (287 L), `tenantScopeGuard.ts`, `tenantTransactionGuards.ts`, `rlsRoleGuard.ts`, `scope.ts`, `soft-delete/`, `seed/`, `runtime/`, `ddl-maintenance/`, `__tests__/` | single owner of the tenant boundary API; names are frozen (`withTenant`, `withTenantRead`, `withGlobalTenant`) |
| `packages/db/drizzle.config.ts`                          | `schema: ./src/schema.ts`, `out: ./migrations_drizzle`, fails closed without `DATABASE_URL`                                                           | `drizzle-kit push` is banned against shared/prod                                             |
| `apps/backend/src/db/repositories/`                      | **438** flat `.ts` files, **42** filename families, 104 cross-family statements, 12 files importing domain guards                                     | only layer allowed to import `drizzle-orm` (data-layer §2.6)                                 |
| `apps/backend/src/db/*.ts`                               | **21** files: `database`, `dbInit`, `dbPurge`, `documentStore*` (5), `relationalReplaceMapping*` (6) + `relationalSnapshot`, `streamingSnapshotProducer`, `prepared*` (2), `transactionSideEffects`, `genericRelationalConditions` | `dbInit`/`dbPurge` are bootstrap/teardown, not schema                                        |
| `apps/backend/src/db/migrations/`                        | **77** TS data migrations = 70 numbered `NNN_*.ts` + 7 support files; **5** import app services (`084`, `085`, `086`, `088`, `090`)                  | forward-only, idempotent, resumable                                                          |
| `apps/backend/src/scripts/`                              | **60** files: migrate/RLS/index CLIs, 12 `seed*`, resets/purges, audits, 10 `*_concurrent_indexes.sql`                                                | migrate/RLS/index belong to `@mms/db`; seeds/API ops stay app-side                            |
| `packages/db/seeds/`                                     | `seeds.json` + `.gz` (861K/59K, gitignored) and `src/seed/{index,minimalSeeds}.ts`                                                                     | demo fixtures, deterministic                                                                |

### 2.6 CI, deployment and ops

| Artefact                                   | Measured coupling                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/` (8 files)             | 25 jobs / 2,220 lines. `ci.yml` **1,274 lines / 17 jobs / 69 path-filter patterns / 27 `pnpm --filter` lines / 12 report dirs / 3 matrix jobs / 38 gate `run:` steps (48 commands)** |
| `ci.yml` path filters                      | `backend_db`, `frontend`, `backend_unit`, `e2e`, `full_tests` include `packages/{db,be-core,fe-core,ui,modules/*}` and `tooling/**`; **P0 has added `apps/api`, `apps/tenant-web`, `apps/platform-web`** to the matching groups, so the future roots cannot silently skip a job |
| `ci.yml` job conditions                    | `test-frontend` / `test-backend-unit` gate on the old filter outputs; `ci-gate` accepts `skipped` — a PR touching only a new app path would be green with zero tests (R3) |
| `ci.yml` `pnpm --filter`                   | 15× `mms-backend`, 4× `mms-frontend`, 7× packages/e2e; slim installs use `mms-frontend...`, `mms-backend...`, `e2e-tests...`                          |
| `ci.yml` report dirs                       | `apps/frontend/{coverage-changed,.vitest-reports}`, `apps/backend/{coverage-changed,.vitest-reports,coverage-*-db}`, `e2e/{blob-report,playwright-report}`, `all-blob-reports` |
| `scripts/ci/package-dist.sh:12`            | tars exactly `apps/backend/dist apps/frontend/dist packages/contracts/dist packages/db/dist packages/db/migrations_drizzle packages/be-core/dist packages/modules/{iam,accounting}/dist` |
| `scripts/deploy-on-server.sh`              | `/var/www/mmsv2`, `apps/backend/.env`, 6 required dists, `apps/backend/dist/scripts/{checkRlsRole,migrateDb}.js`, PM2 `mmsv2-backend`/`mmsv2-worker`, Apache `000-mmsv2.conf` |
| `scripts/deploy-{rollback,verify,recover-backend}.sh` | same env/dist/PM2 literals; `deploy-verify.sh` asserts the backend `/` returns the SPA                                          |
| `scripts/{merge-backend-env,admin-migrate-and-reload,apply-production-host-isolation}.sh` | `apps/backend/.env`, `PORT=5002`, `pnpm --filter mms-backend db:migrate`, PM2 names               |
| `ecosystem.config.cjs`                    | `apps/backend/.env`, `apps/backend/dist/index.js`, `apps/backend/dist/worker/index.js`, PM2 names, port 5002                                          |
| `apps/backend/Dockerfile`                 | copies `apps/backend` + `packages/{contracts,db,be-core,modules/{iam,accounting}}`, `WORKDIR /app/apps/backend`, **builds no web app**                  |
| `apps/backend/src/plugins/frontendSpa.ts` | `join(resolveBackendRoot(), "..", "frontend", "dist")`; if the dist is missing it **warns and returns false**, so `/` becomes a JSON 404 instead of the SPA |
| `scripts/apache/*`                        | one vhost template proxying everything to one upstream (`:5002`), plus `/ws` and `/api/ws`; one cert per wildcard host                                 |
| `restart_servers.sh`                      | backend `:3000`, frontend `:5173`, process matches `/apps/frontend` + `/apps/backend`, 13 app-path literals                                            |
| `docker-compose.yml`                      | one backend service + worker, `apps/backend/Dockerfile`, `5002:5002`, health `:5002/health`; **no web-app service**                                   |
| `e2e/playwright.config.ts` + `e2e/scripts/start-web-server.mjs` | one `webServer` (`node e2e/scripts/start-web-server.mjs`, url `:5173`), one `baseURL`, starts `apps/backend` (`tsx src/index.ts`, waits `:3000/ready`) and one `apps/frontend` (`vite`, `:5173`); 28 specs |
| `e2e/helpers/*` + platform specs          | 11 code-bearing lines resolving `../../apps/backend` (seed helpers, platform admin seeder, bootstrap)                                                 |
| `lighthouserc*.cjs`, `lighthouse-ci.yml`  | paths `apps/frontend/**`, `packages/{contracts,ui}/**`; `--filter mms-frontend build`                                                                 |

### 2.7 Gate scripts, baselines and blind spots

41 gate scripts (`scripts/check-*.mjs` 25, `scripts/ci/check-*.mjs` 16, plus 2 unit-test files),
6,177 lines excluding those tests, plus `scripts/verify-rules-integrity.mjs`. Baselines:

- 3 ESLint allowlists (`apps/frontend/eslint-rules/{direct-api-client,feature-internal-imports,ui-host-imports}-baseline.json`).
- 2 route-security matrices (`scripts/ci/{accounting,examinations}-route-security.json`: 62 and 22 routes),
  2 empty injection baselines.
- `docs/forms-inventory.md`: 223 form-like `.tsx`, 78 `<FormModal>` files (79 tags), 74 write surfaces.
- Inline baselines: `check-backend-structure` (useCaseStorageImports 46, servicesStorageImports 66,
  routeAggregatorFiles 17, useCasesWithoutDirectTest 51), `check-code-norms` (`any` 0, hex-colour files 25,
  files over the 300-line cap 4), `check-migration-indexes` 174, i18n unused keys 517, 6 DB coverage floors.

**Fail-closed status after a rename** (this is the single most dangerous property of the repo):

| Script                                                                     | Behaviour after a move                                                                 | Result   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| `check-frontend-structure`, `check-work-directory`, `check-faculty-domain`, `check-money-safety`, `check-shared-ui` (inner script), `check-tdd-pairing`, `ci/check-db-test-hygiene`, `ci/check-changed-coverage` | scanned roots become empty, baselines are 0 and findings are compared with `>`                 | **pass silently** |
| `check-shared-structure`                                                  | `CONSUMER_DIRS` stays on the old app roots, so imports from the new roots are never scanned | silent coverage loss |
| `check-migrations-forward-only`                                            | `MIGRATION_DIRS` includes the legacy `apps/backend/src/db/migrations/`                 | new app/migration dirs unchecked |
| `check-code-norms`                                                         | normal mode passes (counts fall below baselines); **only** the separate `--ratchet` CI step fails | caught once |
| `check-form-architecture`, `check-backend-structure`, `check-backend-boundaries`, `check-db-projections`, `check-core-packages`, `ci/check-db-test-manifest`, `ci/check-{accounting,examinations,obligations}-route-injection`, `check-bundle-budget`, `check-pwa-precache`, `check-migration-{hygiene,indexes}` | explicit `existsSync`/`fail()` paths, empty injection baselines, or suite-count manifests | fail loudly |
| `check-shared-ui` (cross-console regexes)                                  | matches static `from "@/platform/…"` only; both dual-console files use dynamic `import()` | sanctioned blind spot for exactly those 2 files |

**P0 status:** every row above is now either hardened or intentionally loud. 11 gates assert a non-empty
scan set (`check-frontend-structure`, `check-work-directory`, `check-faculty-domain`, `check-money-safety`,
`check-tdd-pairing`, `check-code-norms`, `check-shared-structure`, `check-migrations-forward-only`,
`ci/check-db-test-hygiene`, `ci/check-changed-coverage`, and the `mms-shared-ui` skill script), and that
skill now also catches dynamic `import()`/`require()` cross-console edges while allowlisting exactly the two
transitional bridge files (`components/routing/HostRoutes.tsx`, `lib/routing/routePrefetch.ts`) as P8 debt.

### 2.8 Architectural invariants (from the five required rules, plus the two path rules)

| Rule / section                                        | Invariant that constrains the migration                                                                                                                                                                | Consequence                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `mms-module-architecture` §1                          | single manifest SSOT in `packages/contracts/src/**/*ModuleManifest.ts` (`moduleId`, entity/collection keys, filters, `setupSubTabs`, `softDelete`)                                                        | manifests stay in `@mms/contracts`; `moduleId` is **frozen** (persisted grants, i18n keys, route access)                      |
| §2–§4                                                 | required Reports + Setup anchors, `PageHeader` owns Create/Import/Export, dirty-gated Setup preferences, `useFilteredModuleTierTabs`                                                                     | a module's frontend entry must keep exporting a full page; shell chrome lives in `ui`/`fe-core`, never in a module             |
| §5                                                    | BullMQ jobs never in the request path; live progress tray; transfer schemas from `@mms/contracts`; destructive jobs dry-run by default                                                                  | job runners move with their module; the jobs **runtime** moves to `be-core`; modules register runners through a descriptor      |
| §6                                                    | transaction-scoped RLS + `can('module.action')`; soft-delete manifest contract; trash UX; 5–10 s Undo; 23505 traps + outbox CDC                                                                         | module route plugins must keep calling `authenticateTenant` + `registerModuleAccess`; soft-delete routes stay module-owned       |
| `mms-data-layer` §1–§2                                | 3NF, one tenant key/table, `FORCE RLS` on new tables, UUIDv7 from `@mms/contracts`, 1:1 Zod in `packages/contracts/src/schemas`, FK indexes, deliverable trinity, `route → use-case → port → adapter`, `withTenant*` | schema + SQL migrations stay **single-owner** (`packages/db`); repository ports move with modules; tenant-context names frozen    |
| §5                                                    | audit: INSERT-only, RFC 8785 JCS, sharded hash chains, outbox in-transaction, server-owned attribution                                                                                                  | the audit engine lives in `be-core/audit`; modules keep emitting through it                                                   |
| §6                                                    | soft-delete sextuple, 3-tier indexes, partial unique indexes, `forbid_hard_delete()`, single-statement bulk, chunked purge                                                                              | no change; a repository move must not alter SQL                                                                               |
| §7                                                    | forward-only DDL, `lock_timeout`, snapshot per migration, `drizzle-kit push` ban                                                                                                                       | moving the migration directory must update 4 ratchets + `drizzle.config.ts` + pre-commit + CODEOWNERS in one commit            |
| `mms-api-interface` §1, §4, §5, §8                    | `apiClient`/`@ts-rest` only; uniform error envelope; read/write DTO parity; bulk PUT upsert (never wipe); additive contracts, **no `/v2`**                                                               | `/api/tenant/*` must be an additive dual mount with a deprecation window; faculty's `/api/v1/tenant/faculty` collapses          |
| §6, §7                                                | pagination caps, ETag, `Idempotency-Key`, OCC (`expectedUpdatedAt`/`x-expected-updated-at`), soft-delete REST factories                                                                                 | route factory helpers stay in `be-core/http`; modules consume them                                                            |
| `mms-auth-security` §1                                | `mms_access` (15 m) + `mms_refresh` 7 d rotated, `Path=/api/auth/refresh`; platform `mms_platform_access`, no JWT in `localStorage`                                                                      | `/api/auth` must not move; platform and tenant cookies are cleared on the other console's login                                |
| §2–§3                                                 | host-derived tenant binding via `AsyncLocalStorage`; `authenticateTenant`/`authenticatePlatform` only; `registerModuleAccess`; denial codes `MODULE_NOT_GRANTED`/`MODULE_DISABLED`/`PERMISSION_DENIED`/`MODULE_ACCESS_UNAVAILABLE`; **every new route classified** | prefix changes require `MODULE_ROUTE_ACTION_RULES` + `moduleAccessCoverage.test.ts` updates in the **same commit**              |
| `mms-migration-status` §1                             | open debt: copy/a11y, live-push coverage, contacts full loads, finance `numeric(12,2)`                                                                                                                   | out of scope; a move must not regress or opportunistically "fix" them                                                          |
| §2                                                    | 13 forbidden-regression families (data authority, sessions, soft-delete, gold standard, UI DRY, fields/forms, person modules, messaging, reports, layout/a11y, 300-LOC cap, audit trail, performance)    | these are the per-phase gate set                                                                                              |
| `.agent/rules/mms-structure-naming` §1                | currently declares `apps/frontend` + `apps/backend` topology                                                                                                                                            | rewritten **in P9**, not before (it would otherwise describe a half-migrated tree)                                            |
| `.agent/rules/mms-shared-ui` §1                       | `packages/ui` is the primitive SSOT; `apps/frontend/src/components/ui` is a facade; cross-console duplicates banned                                                                                      | the facade survives into both apps; `components/app/Modal.tsx` is the one genuine fork to merge in P2                          |

### 2.9 Migration debt constraints (do not "fix" during a move)

Per [`mms-migration-status.md`](../.agent/rules/mms-migration-status.md) §1: residual hardcoded copy / RTL /
contrast checks, missing WS emit/subscribe in secondary modules, contacts chart full loads, and finance
`numeric(12,2)` (KWD/BHD/OMR refused) are **open debt**. They stay open through P9 and are only closed by
the owning skill (`mms-migration-fixes`). §2's forbidden regressions are enforced by re-running the
ratchets that own them in every phase gate.

---

## 3. Progress ledger (what not to redo)

| Work item (previous plan)              | Status   | Evidence                                                                                       |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| P1 `tooling/*`                         | **done** | 3 packages, workspace glob, consumed by all packages                                           |
| P2 `packages/contracts` move + rename   | **done** | `@mms/contracts`, `check:shared-structure` + `check:shared-purity` green                        |
| P3a kernel de-inversion                | **not started** | `db → lib` 136, `db → services` 67, `lib → services` 20, `services ↔ worker` 6/21 still present |
| P3b `packages/db`                      | **~60 %** | schema/migrations/client/context/soft-delete moved; 21 db root files + 77 data migrations + 438 repositories remain |
| P3c `packages/be-core`                 | **~50 %** | 91 files moved; 50 `lib` + 5 `services` shims and ~69 kernel `lib` files remain                 |
| P1a kernel de-inversion (this phase)   | **done**  | `db → services` 0 (outside migrations); `db → lib` shims 0 (57 app-local remain); auth port wired |
| P4a `packages/ui`                      | **~55 %** | 210 files; `Modal` fork open; `WorkBatchTable` + most `components/app` composites already promoted (app files are 1-line facades); `DataTable` (179 L) still app-local; 94 ui facades remain |
| P4b `packages/fe-core`                 | **~55 %** | 274 files / 199 subpaths; 203 facades remain; `lib/host` not inverted                           |
| P5 module waves                        | **~9 %**  | `accounting` extracted (72 %); `iam` backend extracted; 18 domains untouched                    |
| P6 `apps/api`                          | **0 %**   | `apps/api` does not exist                                                                      |
| P7 two web apps                        | **0 %**   | `apps/{tenant,platform}-web` do not exist                                                       |
| P8 rename/cleanup                      | **0 %**   | docs still 2-app; `@shared/ui` mentions linger in `packages/ui` comments                         |

---

## 4. Target topology and dependency law

### 4.1 Elements and allowed edges

`tooling/eslint-config/boundaries.mjs` is the executable SSOT; `scripts/check-module-boundaries.mjs` +
`scripts/ci/module-audience-boundaries.test.mjs` guard the package sources. The intended graph:

| From                                  | May import                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/api`                            | `contracts`, `db`, `be-core`, `tooling`, module `backend` + `shared`              |
| `apps/tenant-web`                     | `contracts`, `fe-core`, `ui`, `tooling`, module `frontend/tenant` + `shared`      |
| `apps/platform-web`                   | `contracts`, `fe-core`, `ui`, `tooling`, module `frontend/platform` + `shared`    |
| `packages/modules/*/backend`          | `contracts`, `db`, `be-core`, `tooling`, own `shared`                             |
| `packages/modules/*/frontend/*`       | `contracts`, `fe-core`, `ui`, `tooling`, own `shared`/`frontend/components`       |
| `packages/modules/*/shared`           | `contracts`, `tooling`                                                            |
| `packages/be-core`                    | `contracts`, `db`, `tooling`                                                      |
| `packages/fe-core`                    | `contracts`, `ui`, `tooling`                                                      |
| `packages/db`                         | `contracts`, `tooling`                                                            |
| `packages/ui`                         | `contracts`, `tooling`                                                            |
| `packages/contracts`                  | `tooling`                                                                         |
| `e2e`                                 | `contracts`                                                                       |

Hard bans: app → app; module → module; `be-core` → module/app; `db` → `be-core`/app;
`fe-core`/`ui` → app/module; `@/…` alias inside `packages/**`; module root import (only explicit audiences).

### 4.2 Target tree

```text
apps/
  api/                 # mms-api         Fastify + BullMQ worker, composes module descriptors,
                       #                 mounts /api/tenant/* and /api/platform/*, serves both SPA dists by host
  tenant-web/          # mms-tenant-web  React SPA on tenant subdomains, PWA, lazy locale packs
  platform-web/        # mms-platform-web React SPA on the apex, EN-only, no service worker
packages/
  contracts/           # @mms/contracts  Zod DTOs, ts-rest contracts, manifests, i18n, pure utils
  db/                  # @mms/db         schema, SQL + TS data migrations, client, tenant context/RLS,
                       #                 soft-delete, seeds, prepared statements, db/migrate/RLS CLIs
  be-core/             # @mms/be-core    Fastify kernel, auth/session, RBAC, audit/outbox, jobs/queues,
                       #                 realtime, logger/telemetry, transports, db-sync orchestration
  fe-core/             # @mms/fe-core    apiClient/ts-rest, query factories, providers, auth/tenant contexts,
                       #                 i18n, host resolver, routing registry, notify, jobs client
  ui/                  # @mms/ui         primitives + composites (Modal/FormModal, DataTable/Work engines,
                       #                 module scaffold, form + calendar primitives)
  modules/
    iam/ billing/ analytics/ contacts/ students/ faculty/ sessions/ attendance/ enrollments/
    examinations/ questionBank/ hasanat/ workshops/ accounting/ obligations/ messaging/ tasks/
    notifications/ documents/ audit/ workspace/ platform/        # @mms/mod-<slice>
tooling/
  eslint-config/ typescript-config/ tailwind-config/             # @mms/{eslint,typescript,tailwind}-config
e2e/  scripts/  docs/  .github/  .githooks/  docker/  perf/
```

### 4.3 Binding decisions

| #    | Decision                                                                                                                                                                                                                                                                                     | Rationale                                                                                                                     | Rejected alternative                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| D1   | Module packages are `@mms/mod-<slice>` in **lowercase-kebab** (npm names are case-sensitive-restricted; `question-bank` ships the `questionBank` module id); **`moduleId` is never renamed**. `iam` owns the `users` module, `billing` owns `finance`, `analytics` owns `dashboard` + `reports` + `savedReports`. The manifest ids `enrollments`/`examinations` keep mapping through `MODULE_ID_ALIASES`.                | `moduleId` is persisted in workspace grants/`enabledModules`, i18n (`nav.*`), `TENANT_APP_ROUTE_ACCESS` and route-action rules; renaming it needs a data migration for zero user value. | Renaming ids `iam`/`billing`/`analytics` — rejected       |
| D2   | `packages/db` owns schema, SQL migrations, TS data migrations, client, tenant/RLS helpers, soft-delete helpers, prepared statements and the migrate/RLS CLIs. **Repositories move into their module** (`src/backend/repository/**`); only `packages/db` and module repositories may import `drizzle-orm`. | A `packages/db` that also owned 438 repositories would be a new god package and re-create today's coupling; 12 repositories already import domain write guards. | Keep repositories central — rejected                    |
| D3   | `packages/be-core` never imports a module or an app. Modules export a `ModuleDescriptor` (routes, job runners, module-action rules, manifests) and **ports**; `apps/api` composes them. Same shape on the FE via route/widget/report contribution registries.                                    | The only way to break the kernel cycles and the domain↔domain edges without module→module imports.                            | Module→module allowlist — rejected                      |
| D4   | `packages/ui` = all cross-console React components (primitives **and** composites); `packages/fe-core` = non-UI React runtime (api, query, providers, auth, host, routing registry, i18n, notify, jobs client).                                                                                | Keeps the existing `mms-shared-ui` primitives-vs-shell split and gives both apps one component source.                        | Composites in `fe-core` — rejected                      |
| D5   | Canonical tenant namespace = **module routes only**: `/api/tenant/<module>`, including the tenant-scoped module-adjacent surfaces (`audit`, `notifications`, `saved-reports`, `templates`, `background-jobs`, `workspace`, `module-access`). Infra routes stay (§2.4). Dual-mount the legacy prefix for one deprecation window with `Deprecation` + `Sunset` headers. | Moving `/api/auth` breaks the refresh-cookie `Path`; moving `/ws` breaks Apache; `mms-api-interface` §8 bans versioned cutovers. | Hard cut to `/api/tenant/*` — rejected                  |
| D6   | Both web apps are served by the **same** Fastify process on `:5002` by host: apex → `apps/platform-web/dist`, tenant subdomain → `apps/tenant-web/dist`. Apache stays unchanged.                                                                                                                | `frontendSpa.ts` already proves host-based static serving; one port keeps PM2, TLS and the vhost untouched.                    | Separate PM2 apps/ports — documented fallback            |
| D7   | BE-side packages (`contracts`, `db`, `be-core`, module `backend`) compile to Node ESM `dist/`; FE-side packages (`ui`, `fe-core`, module `frontend`) export **source** and are typechecked with `tsc --noEmit`. Every package carries `build`/`typecheck`/`lint`/`test`; the three config packages are explicitly exempt (asserted by a ratchet). | Matches today's behaviour and keeps FE HMR and one-React bundling.                                                            | Build every package — rejected                          |
| D8   | No new third-party dependency. Codemods use the already-installed `typescript-v6`; new ratchets are plain Node scripts.                                                                                                                                                                       | `.agent/rules/mms-dependencies.md` requires evaluation; the repo already has the tooling and a ratchet culture.                | `dependency-cruiser`/`madge` — rejected                 |
| D9   | Directory moves happen **only** through `scripts/codemod/move-modules.mjs` with a checked-in map under `scripts/migration/maps/`; the tool must gain `--allow-cross-root` and `--target-alias`.                                                                                                  | Reproducible, reviewable, and lets P0 provide a machine gate that no stale path survives.                                      | Ad-hoc IDE refactors — rejected                         |
| D10  | Naming: `@mms/*` libraries, `mms-*` apps (`mms-api`, `mms-tenant-web`, `mms-platform-web`), `@mms/mod-*` modules, `e2e-tests` unchanged.                                                                                                                                                        | Minimises CI filter churn to the phases that rename.                                                                          | Rename `e2e` — rejected                                 |
| D11  | `apps/frontend` and `apps/backend` are deleted in the phase that replaces them; no permanent shim apps. A release branch cut protects rollback.                                                                                                                                                  | Shims double the ratchet surface and let stale code rot.                                                                      | Long-lived shim apps — rejected                        |
| D12  | A frontend app may only import its own audience: `tenant-web` never imports `frontend/platform` or `backend/*`; `platform-web` never imports `frontend/tenant`.                                                                                                                                    | Preserves the zero-cross-console invariant that holds today.                                                                  | Shared app that switches at runtime — rejected (current state) |
| D13  | `packages/modules/*` has **no root export**; consumers choose `shared`, `backend/tenant`, `backend/platform`, `frontend/tenant`, `frontend/platform`.                                                                                                                                            | A root export would let a frontend app pull backend code and defeat the audience ratchet.                                     | Root barrel per module — rejected                       |
| D14  | The Drizzle schema and SQL migrations are **never split across modules**; `packages/db` is the single owner. Module extraction moves code, not tables.                                                                                                                                            | Schema splitting would break the snapshot chain, RLS policy ownership and the 409/23505 contracts.                            | Per-module schema files — rejected                      |

---

## 5. Directory → target mapping

### 5.1 `apps/backend/src` (33 top-level dirs, 2,271 `.ts` + 10 `.sql` files / 294.3k LOC; 1,530 non-test, 143 shims)

| Current                               | Files | Shim | Target                                                                                                    | Phase |
| ------------------------------------- | ----: | ---: | --------------------------------------------------------------------------------------------------------- | ----- |
| `__tests__/`                          |   739 |    0 | module-owned tests travel with their module; cross-cutting → `apps/api/src/__tests__/**`; DB/RLS → `packages/db/tests/**` | P1–P7 |
| `accounting/`                         |    51 |   37 | `packages/modules/accounting/src/backend/**` (delete shims; move 14 adapters/`ledgerPosting`)               | P3    |
| `attendance/`                         |    33 |    0 | `packages/modules/attendance/src/backend/**`                                                              | P6    |
| `audit/`                              |     3 |    0 | `packages/modules/audit/src/backend/**` (hash-chain engine already in `be-core/audit`)                      | P4    |
| `config/`                             |     5 |    1 | `apps/api/src/config/**`; `config/telemetry.ts` shim → `@mms/be-core/telemetry`                            | P7    |
| `contacts/`                           |    42 |    0 | `packages/modules/contacts/src/backend/**`                                                                 | P4    |
| `db/`                                 |   536 |   47 | `packages/db` (21 root files, 77 TS data migrations, migrate/RLS CLIs) + module repositories (438, by family) + `be-core` db-sync (documentStore/`dbPurge`/snapshot producer) | P1, P4–P6 |
| `documents/`                          |     2 |    0 | `packages/modules/documents/src/backend/**`                                                                | P4    |
| `enrollments/`                        |    31 |    0 | `packages/modules/enrollments/src/backend/**`                                                              | P6    |
| `examinations/`                       |    11 |    0 | `packages/modules/examinations/src/backend/**`                                                             | P6    |
| `faculty/`                            |    35 |    0 | `packages/modules/faculty/src/backend/**`                                                                  | P5    |
| `finance/`                            |    17 |    0 | `packages/modules/billing/src/backend/**` (module id stays `finance`)                                       | P5    |
| `hasanat/`                            |    20 |    0 | `packages/modules/hasanat/src/backend/**`                                                                  | P4    |
| `integrations/`                       |     2 |    0 | `packages/modules/integrations/src/backend/**` (self-contained: 0 internal imports)                         | P4    |
| `lib/`                                |   119 |   50 | kernel helpers → `be-core` (`http`, `rbac`, `realtime`, `redis`, `http/routes`, route factories); domain-named (`contact*`, `dashboard*`, `session*`, `taskNotification*`, `moduleRouteActionRules*`) → owning module; `registerModule*` helpers → `be-core` with ports, else `apps/api` | P1, P4–P6 |
| `messaging/`                          |     4 |    0 | `packages/modules/messaging/src/backend/**`                                                                | P5    |
| `middleware/`                         |     4 |    0 | `packages/be-core/src/auth/**` + `apps/api/src/middleware/**` wiring; `FacultyAccountGuard` port removes the faculty import | P1    |
| `modules/`                            |     3 |    0 | `apps/api/src/compose.ts` + `modules/{accounting/configure,iam/adapters,iam/compose}.ts` (port wiring)      | P7    |
| `notifications/`                      |     3 |    0 | `packages/modules/notifications/src/backend/**`                                                            | P4    |
| `obligations/`                        |    12 |    0 | `packages/modules/obligations/src/backend/**` (with accounting's `ObligationVoucherPort`)                   | P4    |
| `platform/`                           |    10 |    0 | `packages/modules/platform/src/backend/**` (contacts/accounting/messaging adapters become ports)            | P4    |
| `plugins/`                            |    10 |    1 | `packages/be-core/src/http/**`; Fastify app assembly stays in `apps/api`                                    | P1    |
| `questionBank/`                       |    11 |    0 | `packages/modules/questionBank/src/backend/**`                                                             | P4    |
| `routes/`                             |   207 |    0 | 160 tenant files → owning module `backend/routes/**`; 23 common → `be-core`/`apps/api`; 23 platform → platform module/`apps/api`; `index.ts` → `apps/api/src/routes/index.ts` | P3–P7 |
| `savedReports/`                       |     3 |    0 | `packages/modules/analytics/src/backend/**`                                                                | P6    |
| `scripts/`                            |    60 |    0 | migrate/RLS/index/partition CLIs + SQL → `packages/db/src/scripts/**`; seeds/resets/purges/audits → `apps/api/src/scripts/**` | P1, P7 |
| `services/`                           |   197 |    5 | 142 domain-owned → owning module `backend/services/**`; ~55 kernel services → `be-core` (`auth`, `platform` settings read-through, jobs, audit, db-sync, workspace, tasks, notifications, storage) | P1, P4–P6 |
| `sessions/`                           |    30 |    0 | `packages/modules/sessions/src/backend/**`                                                                 | P6    |
| `students/`                           |    23 |    0 | `packages/modules/students/src/backend/**`                                                                 | P6    |
| `tasks/`                              |     4 |    0 | `packages/modules/tasks/src/backend/**`                                                                    | P6    |
| `users/`                              |    11 |    0 | `packages/modules/iam/src/backend/**` (module id `users`)                                                  | P6    |
| `worker/`                             |    32 |    1 | `apps/api/src/worker/**` (BullMQ wiring) + `@mms/be-core/src/{jobs,queues}/**`                             | P7    |
| `app.ts`, `index.ts`                  |     2 |    0 | `apps/api/src/{app,index}.ts`                                                                              | P7    |

### 5.2 `apps/backend` outside `src/`

| Current                                                                 | Target                                                                                              | Phase |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `Dockerfile`                                                            | `apps/api/Dockerfile` (copy `packages/{contracts,db,be-core,modules/*}`; build the API only)         | P7    |
| `package.json` (`mms-backend`)                                          | `apps/api/package.json` (`mms-api`); `db:check`/`index:concurrent`/RLS CLIs run from `@mms/db`, `db:migrate` stays (it runs the app boot pipeline) | P1/P7 |
| `vitest.config.ts`, `vitest.db.config.ts`, `vitest.rls.config.ts`        | `apps/api/vitest*.config.ts`; DB/RLS configs move to `packages/db`                                    | P1/P7 |
| `tsconfig.json`, `eslint.config.js`                                     | `apps/api/*`                                                                                        | P7    |
| `scripts/sql/*.sql` (3 concurrent-index files)                          | `packages/db/scripts/sql/**` (out-of-band index builds accompany migrations)                         | P1    |
| `uploads/{branding,keys,tenants}`, `.env`, `.env.example`               | runtime only; `apps/api/uploads/**`; env example path updated in every deploy script                 | P7    |
| `dist/`, `coverage-*/`, `.vitest-reports/`, `.turbo/`, `.tmp-e2e/`      | generated, gitignored                                                                               | —     |

### 5.3 `apps/frontend/src` (10 areas, 4,261 `.ts`/`.tsx`; 329 facades)

| Current                                                         | Files | Target                                                                                                    | Phase |
| --------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------- | ----- |
| `tenant/features/<module>/**` (21 features)                     | 2,351 | `packages/modules/<slice>/src/frontend/tenant/**` (accounting already there: 204 app files)                 | P3–P6 |
| `tenant/{components,pages,routes,hooks}/**`                     |  ~61  | `apps/tenant-web/src/**`; cross-module `tenant/hooks/collections/**` facades → module query factories or `fe-core` | P6–P8 |
| `platform/**` (17 features, 372 files)                          |   372 | `apps/platform-web/src/**` (`auth`+`shell` → `src/core`); shared parts → `fe-core`/`ui`                     | P8    |
| `components/app/**` (306), `components/common/**` (92)          |   398 | curated promotion into `@mms/ui` or `fe-core`; already facades: 68 ui + 80 fe-core (`app`), 15 fe-core (`common`) | P2    |
| `components/{reports,template-editor,messageComposer,contactLink,contact-action,dashboard-widgets,sequence-numbering}/**` | ~260 | owning module `src/frontend/components/**`                                                                 | P4–P6 |
| `components/{ui,branding,routing,entry,llm,dev}/**`             | ~75   | `components/ui` facade → each app (27 shims); branding/`entry` → `fe-core` + per-app; `HostRoutes` deleted in P8 | P2/P8 |
| `lib/**` (450; 92 facades)                                      |   450 | `fe-core` (api/query/auth/forms/i18n/storage/notify/backgroundJobs/reports widgets); domain groups (`contacts` 28, `students`, `faculty`, `examinations`, `messaging`, `data` 10, `templates` 4, `invoice*` 11, `reports` 31) → modules; `host`/`routing`/`config/nav*`/`settingsPreview`/`pwa`/`vendorChunks` → apps | P2, P4–P8 |
| `hooks/**` (83; 16 facades)                                     |    83 | generic hooks → `fe-core/hooks`; module hooks (`standardModuleConfig*`, `useMessageComposerState`, `useDashboardConfig`, `useWorkspaceToday`, `useAcademicCatalog*`, `useCurrency`, `useDirectoryTrashState`, `useModuleTierTabs`, `useLiveCollection`, `useTenantDatabaseUpdates`) → modules | P2, P4–P6 |
| `providers/**`                                                  |     7 | `apps/tenant-web/src/providers/**` (`AppProviders`, `TenantScopedProviders`) and a smaller platform chain   | P8    |
| `__tests__/**` (18 repo-wide ratchet specs)                     |    18 | `packages/fe-core/tests/**`, or converted to `scripts/check-*.mjs` when no DOM is needed                     | P2    |
| `test/**`                                                       |     6 | test setup → each app + `fe-core/testing`                                                                  | P2/P8 |
| `main.tsx`, `App.tsx`, `index.css`, `bootstrapZodCsp.ts`        |     4 | split per app (tenant boots PWA + tenant chrome; platform boots apex theme, EN-only, no SW)                  | P8    |

### 5.4 `apps/frontend` outside `src/`

| Current                                                       | Target                                                                                         | Phase |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `index.html`, `public/`, `postcss.config.js`, `vite.config.ts`, `vitest.config.ts` | per-app copies (tenant keeps PWA/manifest/robots/llms; platform gets apex CSP, no SW)             | P8    |
| `eslint-rules/*.cjs` (6 rules + 2 tests)                      | `tooling/eslint-config/rules/**`                                                               | P2    |
| `eslint-rules/*-baseline.json` (3 allowlists)                 | `tooling/eslint-config/baselines/**` (paths rewritten relative to the new roots)                 | P2    |
| `eslint.config.js`                                            | per-app config (`createReactConfig({ appKind: "tenant" })` / `"platform"`) + package configs      | P2/P8 |
| `scripts/{ui-audit.js,ui-audit-report.json}`                  | `apps/tenant-web/scripts/**` or `scripts/ui-audit.mjs`                                          | P8    |
| `components.json`                                             | kept per app (shadcn alias map)                                                                 | P8    |

### 5.5 `packages/contracts` (1,030 files / 158.6k LOC)

Stays the single contract owner. Only additive changes: `src/routing/apiPrefixes.ts` (`TENANT_ROUTE_PREFIXES`
with canonical + legacy), `src/modules/*ModuleDescriptor` types, and (optional, P9) moving `<domain>/**`
contract folds into `packages/modules/<slice>/src/shared` with `@mms/contracts` re-exporting. Module
manifests stay here (D1). No `/v2`.

### 5.6 `packages/db`

Stays single-owner of schema + migrations (D14). Absorbs `apps/backend/src/db` (P1): 21 root files
(client/prepared/snapshot/transaction guards), 70 of 77 TS data migrations, and the migrate/RLS/index
CLIs; gains `db:migrate`, `test:db`, `test:rls` scripts and the two vitest configs. `documentStore*`,
`dbPurge`, `streamingSnapshotProducer`, `relationalSnapshot`/`relationalReplaceMapping*` and `dbInit`
move to `be-core/db-sync` or `apps/api` (they orchestrate backups/startup, not schema).

### 5.7 `packages/be-core`

Absorbs the kernel subset of `apps/backend/src/{lib,services,middleware,plugins,config,routes/common}`
and the jobs runtime. Layering inside the package: `http → auth → rbac → audit → data → jobs →
realtime/redis → transports`, enforced by a folder ratchet. It never imports an app or a module (D3).

### 5.8 `packages/fe-core`

Absorbs the generic frontend runtime; the host switch becomes an injected resolver so `fe-core` never
imports a console. It may import `@mms/ui` and `@mms/contracts` only.

### 5.9 `packages/ui`

As of the measurement, **most cross-console composites are already promoted** and the app files are 1–2 line
facades: `Modal` (→ `fe-core`), `FormModal`, `SectionCard`, `EmptyState`, `ErrorState`, `StatusBadge`,
`SubTabBar`, `StatCard`, `DetailDrawerShell`, `PageHeader`, `FormSelect`; `form.tsx`/`calendar.tsx` are a
1-line facade and an 18-line adapter over `packages/ui/src/{form,calendar}` (`Form` 154 L already moved).
What is genuinely left for P2:

- **`DataTable` (179 L) is still app-local** — the last big engine, plus the `components/common/work` barrel
  wiring (its `WorkBatchTable` implementation, 286 L, is already in `@mms/fe-core`).
- **`FormPrimitives.tsx` (39 L)** is the remaining app adapter.
- **The `Modal` fork is still open**: `packages/ui/src/modal/Modal.tsx` (222 L) and
  `packages/fe-core/src/components/Modal.tsx` (246 L) both exist; merge before the split (R6).
- `apps/frontend/src/components/ui` is a 31-file facade (mostly 2-LOC re-exports); `PageHeader` has zero
  direct importers and must be reconciled before its facade is deleted.

### 5.10 `packages/modules/iam`

The audience-separated scaffold is delivered: `shared` (types, role/permission constants, policy,
invites, typed `IamError`), `backend/{iam.service,tenant.router,platform.router,ports,respond}`, and
`frontend/{components,tenant,platform}` with the five explicit subpaths and no root export. Backend
routes are wired into the app through `IamPorts`; the platform IAM surface is live in the Platform
Users Work tier, and tenant `RoleBadge` is live in `UserBadges`. `scripts/ci/module-audience-boundaries.test.mjs`
proves tenant-web/platform-web imports stay audience-locked.

Still P6 (after `faculty`, because `users → faculty` 3 statements need `FacultyRolePort`): absorb the
`users` domain (11 files), its routes (7), user services (7) and its FE (110 tenant + 47 platform files),
and delete the legacy `/api/users` + app-side triple-tier UsersPage. The module's tenant
`TeamMembersPage`/`InviteMemberModal` are the canonical views for `apps/tenant-web` until then.

### 5.11 `packages/modules/accounting`

348 files already (routes 23, use-cases, repository, ledgerPosting, ports, services, jobs, FE 109 module tenant
+ 7 platform). Remaining work in P3: delete 37 backend shims + 4 service shims, move
`accounting/{ledgerPosting/*,repository/*}` (14 real files, including `obligationPostingService` 273 L and
`ledgerPostingHelpers` 213 L), and delete `apps/backend/src/accounting`.

### 5.12 `tooling/*`

Stays. P2 moves the app-local ESLint rules + baselines here; P9 documents the config-package exemption
from `build`/`typecheck`/`lint`/`test` in a ratchet (D7).

### 5.13 `e2e/*`

Stays as `e2e-tests`. P7 updates the 11 `../../apps/backend` references to `apps/api`. P8 splits the
single `webServer` into tenant (:5173) + platform (:5174), adds per-project `baseURL` and global setup,
and keeps the `a11y` project.

### 5.14 `scripts/*`

Stays. P0 adds `lib/repo-paths.mjs`, `migration/{move-manifest.json,maps/*}`, `check-move-manifest.mjs`
and extends `codemod/move-modules.mjs`. Every `check:*` root is repointed per phase (§9.4). Deploy scripts
are repointed in P7/P8 only.

### 5.15 Docs, `.github`, `.githooks`, `docker`, `perf`, root files

| Group                     | Action                                                                                                              | Phase |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- |
| `docs/`                   | this plan + ADRs `019-module-descriptors-and-ports`, `020-additive-tenant-api-prefix`, `021-two-web-apps-one-api-host-routing`, `022-module-package-contents`; `docs/README.md` index | P9 |
| `.github/workflows/`      | dual-prefix filters (P0), deploy artifact + path literals (P7), two web builds (P8), lighthouse per app (P8)          | P0/P7/P8 |
| `.github/CODEOWNERS`      | new roots                                                                                                           | P7/P8 |
| `.githooks/pre-commit`    | migration dir + frontend path greps                                                                                 | P1/P8 |
| `docker-compose.yml`      | api service path; optional web-app note                                                                             | P7    |
| `perf/`                   | baselines (lighthouse budgets) unchanged                                                                            | —     |
| root docs/misc            | rewrite `README.md`, `SYSTEM_ARCHITECTURE.md`, `AGENTS.md` layout, `CONTRIBUTING.md` (P9); archive/delete the 11 `CONTACTS_*.md` + `ACTION_COLUMN_REVIEW.md` + `SETTINGS_REVIEW.md`; delete stray `failed_job.log` + `lhci-comment.md` (P0) | P0/P9 |

### 5.16 Module roster (22 packages, frozen ids)

Package names are lowercase-kebab (`@mms/mod-question-bank`); the `moduleId` column is the persisted
camelCase identity and may differ in casing. `check:topology` enforces both the roster and the link between
`packages/modules/<dir>` and `@mms/mod-<dir>`, so a camelCase package name cannot land.

| Package                   | Owns (module ids)                                  | Backend today (files)                    | FE today (files) | Phase |
| ------------------------- | -------------------------------------------------- | ---------------------------------------- | ---------------- | ----- |
| `@mms/mod-iam`            | `users` (+ platform IAM)                           | 28 (module) + `users` 11 + routes 7      | 110 + 47         | P6 (backend P6) |
| `@mms/mod-billing`        | `finance`                                          | 17                                       | 92               | P5    |
| `@mms/mod-analytics`      | `dashboard`, `savedReports`, `reports` surfaces     | 3 + 3                                    | 43 + 57 + 62     | P6    |
| `@mms/mod-accounting`     | `accounting`                                       | 348 (module) + 51 app files (37 shims)   | 204 app + 109 module | P3 |
| `@mms/mod-contacts`       | `contacts`                                         | 42                                       | 324              | P4    |
| `@mms/mod-students`       | `students`                                         | 23                                       | 197              | P6    |
| `@mms/mod-faculty`        | `faculty`                                          | 35                                       | 221              | P5    |
| `@mms/mod-sessions`       | `sessions`                                         | 30                                       | 138              | P6    |
| `@mms/mod-attendance`     | `attendance`                                       | 33                                       | 164              | P6    |
| `@mms/mod-enrollments`    | `enrollment`                                       | 31                                       | 128              | P6    |
| `@mms/mod-examinations`   | `examination`                                      | 11                                       | 121              | P6    |
| `@mms/mod-question-bank`  | `questionBank`                                     | 11                                       | 116              | P4    |
| `@mms/mod-hasanat`        | `hasanat`                                          | 20                                       | 73               | P4    |
| `@mms/mod-workshops`      | `workshops`                                        | 9                                        | 33               | P4    |
| `@mms/mod-obligations`    | `obligations`                                      | 12                                       | 119              | P4    |
| `@mms/mod-messaging`      | `messaging`                                        | 4 + 7 services                           | 81 + 12          | P5    |
| `@mms/mod-tasks`          | `tasks`                                            | 4                                        | 62               | P6    |
| `@mms/mod-notifications`  | (in-app inbox, not a SYSTEM_MODULE)                | 3 + 1 route                              | 3                | P4    |
| `@mms/mod-documents`      | `templates` (settings-gated, not a module grant)    | 2 + 1 route                              | editors in `components/template-editor` | P4    |
| `@mms/mod-audit`          | audit governance (own permissions)                 | 3 + 4 routes                             | audit UI in settings | P4    |
| `@mms/mod-workspace`      | workspace registry/branding (not a module grant)   | 8 repos + 1 route pair                   | settings           | P4    |
| `@mms/mod-platform`       | platform console backend (23 route files)          | 10 + 23 routes                           | 372              | P4    |

### 5.17 Repository family → module (438 files, 42 families)

| Family (files)                                                                                                                                        | Target                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| accounting (47)                                                                                                                                       | already `@mms/mod-accounting/backend/repository` (shims to delete)          |
| contact (44), faculty (41), student (24), attendance (23), enrollment (23), finance (18), session (34), question (27), hasanat (24), workshop (17), examination (14+5 `exam`), obligation (13), tasks (10), messaging (7), tenant/user (7+3), platform (10), workspace (8), dashboard (3) | the owning module's `src/backend/repository/**`                              |
| academic (6), section (3), registration (3), saved (2), fee/fx/document/email/sms/whatsapp/instructional/logs/sequence/task/teacher (1 each), `background` (2) | the module that queries them; shared SQL helpers that outlive one module → `packages/db/src/query-authority/**` |
| `module` (4 `moduleSetupRepo*` factories), `repository` (2 mapper files), `list` (1)                                                                    | `packages/db` (shared persistence primitives), consumed by modules           |

Rules: a repository that imports a domain write guard (12 files: examinations 4, questionBank 3,
workshops 3, faculty 1, users 1) must ship **inside** that module. A repository imported by two modules
(`session → enrollment` 10, `session → academic` 6, `tasks → faculty` 3) is split or reached through the
owning module's port.

---

## 6. Cross-domain coupling and cycles

### 6.1 Backend kernel: one SCC, four cycles

Import statements between `apps/backend/src` top-level dirs (tests excluded; `__tests__` excluded from
per-directory rows). `outside` = imports into domain dirs.

| from \ to   | lib | services |  db | routes | worker | plugins | middleware | config | scripts | platform | outside |
| ----------- | --: | -------: | --: | -----: | -----: | ------: | ---------: | -----: | ------: | -------: | ------: |
| **lib**     |  87 |       20 |   4 |      0 |      0 |       0 |          0 |      2 |       0 |        0 |       3 |
| **services**| 204 |      291 |  86 |      0 |      6 |       0 |          0 |      9 |       0 |        3 |      82 |
| **db**      | 136 |       67 | 670 |      0 |      0 |       0 |          0 |      2 |       0 |        0 |      12 |
| **routes**  | 518 |      280 |   2 |    255 |      0 |       2 |         76 |      4 |       0 |       15 |     141 |
| **worker**  |  46 |       21 |   5 |      0 |     42 |       0 |          0 |      5 |       0 |        0 |      10 |
| **plugins** |  14 |        4 |   1 |      0 |      0 |       9 |          1 |      8 |       0 |        0 |       0 |
| **middleware** | 9 |       12 |   0 |      0 |      0 |       0 |          2 |      0 |       0 |        0 |       1 |
| **scripts** |  15 |       11 |  27 |      0 |      2 |       0 |          0 |     35 |      17 |        0 |       0 |
| **platform**|   3 |        0 |  20 |      0 |      0 |       0 |          0 |      0 |       0 |        6 |       0 |

Four 2-cycles hold the whole backend together:

| cycle               | A→B / B→A | Carriers (examples)                                                                                                                 | Untangle |
| ------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `lib ↔ services`    | 20 / 204  | `lib/collectionAuditInTx → services/auditTrailService`; `lib/csvExportEnqueue → backgroundJobWorkerService`; `lib/currentTenantRole → rbacService`; `services/* → lib/{httpErrors,createModule*,registerModule*}` | both land in `be-core`; enforce the intra-package layer order |
| `db ↔ services`     | 67 / 86   | `db/dbInit` 6, `db/dbPurge` 2, `db/migrations` 5, `db/repositories` 52 → services; `services/* → db/{database,repositories}` | `dbInit`/`dbPurge` become `apps/api`/`be-core` hooks with injected adapters; repositories move with modules |
| `db ↔ lib`          | 136 / 4   | `db/* → lib/{logger,tenantContext,httpErrors,pgErrors,dbDate,softDeleteHelpers,cache,redis,workspaceDay}`; `lib/{dashboardWidgetsService,moduleAvailabilityService,workspaceDay,workspaceTimezone} → db/repositories` | inject a `DbLogger`; ALS tenant context stays in `db`; workspace/timezone reads move into `db` |
| `services ↔ worker` | 6 / 21    | `backgroundJobEnqueue/Deadline → worker/queues`; `worker/* → services/{auditTrail,financePreferences,backgroundJobRunner}` | jobs runtime in `be-core/jobs`; modules register job runners (D3) |

Plus one inverted edge: `middleware/authenticate.ts:52` dynamically imports
`../faculty/repository/facultyRepositoryAdapter.js` (`isDeletedByUserId`). Fix with a
`FacultyAccountGuard` port in `be-core`.

### 6.2 Domain ↔ domain: 20 pairs / 55 statements / 47 importer files

| From → To                   | Stmts | Imported file(s) / symbols (abridged)                                                                |
| --------------------------- | ----: | ---------------------------------------------------------------------------------------------------- |
| accounting → obligations    |     1 | `obligations/repository/obligationsRepositoryAdapter`                                                |
| attendance → hasanat        |     1 | `hasanat/repository/hasanatRepositoryAdapter` (`findStudentsByNames`)                                 |
| attendance → notifications  |     2 | `notifications/use-cases/notificationsUseCases`                                                       |
| attendance → sessions       |     5 | `sessions/use-cases/teacherSectionScope`, `sessions/repository/sessionsAcademicRepositoryAdapter`, `sessionsUseCases` |
| enrollments → attendance    |     1 | `attendance/use-cases/attendanceLeaveUseCases` (`recordApprovedLeave`)                                |
| enrollments → contacts      |     2 | `contacts/use-cases/contactWriteUseCases` (`upsertContact`)                                           |
| enrollments → finance       |     3 | `finance/use-cases/{financeEnrollmentBillingUseCases,financeInvoiceGenerationUseCases}`               |
| enrollments → notifications |     1 | `notifications/use-cases/notificationsUseCases`                                                       |
| enrollments → students      |     1 | `students/use-cases/studentWriteUseCases` (`createStudent`)                                           |
| examinations → sessions     |     2 | `sessions/use-cases/teacherSectionScope` (`assertTeacherAnyClassScope`, `assertTeacherExamScope`)      |
| faculty → contacts          |     6 | `contacts/systemTags/contactSystemTagUseCases` (6 write/lifecycle paths)                              |
| finance → accounting        |     7 | `accounting/ledgerPosting/ledgerPostingService` (7 `tryPost*`), `accountingFxRepository(Adapter)`      |
| finance → contacts          |     1 | `contacts/use-cases/contactConfigService` (`loadContactFieldConfig`)                                  |
| messaging → contacts        |     1 | `contacts/use-cases/contactConfigService`                                                             |
| obligations → accounting    |     2 | `accounting/ledgerPosting/{obligationPostingService,obligationVoucherLookup}`                         |
| sessions → attendance       |     1 | `attendance/use-cases/academicCalendarCopyUseCases`                                                   |
| sessions → enrollments      |     4 | `enrollments/use-cases/{enrollmentEndUseCases,enrollmentRolloverUseCases}`                            |
| students → contacts         |     7 | `contactWriteUseCases`, `contactLoadUseCases`, `contactSystemTagUseCases`                             |
| students → enrollments      |     4 | `enrollmentBulkEnroll`, `enrollmentEndUseCases`, `enrollmentOperationsRepository`                     |
| users → faculty             |     3 | `faculty/use-cases/{facultyUserRoleGuards,facultyManagedRolesPrefs}`                                 |

**SCCs (Tarjan):** `{obligations, accounting}` (size 2) and
`{students, enrollments, sessions, attendance}` (size 4); 14 singleton SCCs. Leaves with no outgoing
domain edge: `contacts`, `hasanat`, `notifications`, `documents`, `audit`, `workshops`, `questionBank`,
`savedReports`, `integrations`, `platform`, `workspace`.

Cycle breakers: accounting already exposes `AccountingFinancePort`; `obligations` needs the reciprocal
`ObligationVoucherPort`; the academic SCC needs `StudentDirectoryPort`, `EnrollmentLifecyclePort`,
`TeacherSectionScopePort`, `AttendanceCalendarPort`, plus `NotificationPort` and `HasanatPort`.

### 6.3 Shared directories

| Coupling                          | Evidence                                                                                                                     | Untangle |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| `db/repositories`                 | 438 files, 42 families, 104 cross-family statements; top: `session → enrollment` 10, `session → academic` 6, `finance → repositoryMappers` 5, `examination → academic` 4, `attendance/contact/faculty/session/student → moduleSetupRepoFactories` 3 each | move each family with its module; shared mappers/factories to `packages/db`; 12 domain-guard imports force those files into their module |
| `db/tenant-context` + `db/database` | 172 and 83 non-test importer files                                                                                          | stay in `packages/db`; imports switch to `@mms/db` once, not per module |
| `services/`                       | 197 files: 142 domain-owned, ~55 kernel, 5 shims                                                                              | kernel → `be-core`; domain facades → owning module |
| `lib/`                            | 119 files: 50 shims, 13 domain-named, remainder kernel                                                                         | kernel → `be-core`; domain-named → owning module |
| `routes/`                         | 160 tenant files; 125 import domain use-cases; 0 import repositories/drizzle                                                    | each route folder moves with its module |

### 6.4 Inverted dependencies that must be fixed, not moved

| Inversion                                                                 | Sites | Fix |
| ------------------------------------------------------------------------- | ----: | --- |
| `db/repositories → <domain>/domain/*WriteGuards`                          | 12 | dissolves when the repository moves into its module (D2) |
| `db/dbInit → services/{auth,platform}`                                    | 6 | `dbInit({ seeds, hooks })` invoked from `apps/api` |
| `db/dbPurge → services/auth`                                              | 2 | purge hook injected by `be-core` |
| `db/migrations/0{84,85,86,88,90} → services`                              | 5 | ports, or keep these 5 in `apps/api/src/db/migrations` as the documented exception |
| `middleware/authenticate.ts → faculty/repository` (dynamic)               | 1 | `FacultyAccountGuard` port |
| `lib/{errorHandler,moduleAvailabilityService} → services/platform`        | 2 | `be-core` read-through settings port |
| `lib/{collectionAuditInTx,csvExportEnqueue,currentTenantRole} → services` | 3+ | move together into `be-core`; enforce layer order |
| `services/{backgroundJob*,taskNotification*,dashboardSummary} → domains`  | ~20 | job-runner + notification + widget contribution registries (D3) |

### 6.5 Frontend coupling

| Coupling                                        | Evidence                                                                                                                                                   | Untangle |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| tenant ↔ platform                               | **0** static or dynamic imports; the only dual-console files are `HostRoutes.tsx` and `routePrefetch.ts` (sanctioned, dynamic)                               | keep the ban; delete both files in P8 |
| tenant feature ↔ feature                        | **0** real edges; one unpoliced test file at `tenant/features/` root reads other features' `lib/` helpers                                                    | exclusion rule + explicit test allowlist |
| feature → shared data facades                   | 166 edges from 102 files into `tenant/hooks/collections/**`; hubs `usePermissions` (73 importers, 19 of 21 features), `sessions` 43, `students` 29, `contacts` 27 | per-module query factories + contribution registries (P6) |
| shared layer → console code                     | 14 `lib/` files → tenant, 1 → platform; 15 `components/` files → tenant, 2 → platform; 5 `hooks/` → tenant, 1 → platform                                         | relocate the tenant-facing ones into modules; the 2 platform ones disappear with `HostRoutes`/`routePrefetch` |
| shared-layer size                               | `components/app` 306 files (1,076 importers, 87 from platform), `lib` 450, `hooks` 83, `components/common` 92                                                  | curated promotion into `@mms/ui`/`fe-core` (P2) |
| duplicated primitives                           | `Modal` is the only genuine two-implementation fork (`packages/ui` 222 L vs `fe-core` 246 L; ui has 1 production consumer); every other "dup" is a 2-LOC shim | merge `Modal` before the split (P2) |
| platform feature ↔ feature                      | **118 edges / 44 pairs / 81 files** (`settings → auth` 13, `workspaces → shell` 9 …) — the platform console is *not* isolated like the tenant one                    | `platform/auth` + `platform/shell` → `apps/platform-web/src/core`; the rest → features; add a ratchet in P8 |
| unused module frontends                         | `@mms/mod-iam/frontend` has **1** import; 18 `@mms/fe-core` export keys are unused barrels                                                                   | wire or drop in P6/P8 |

### 6.6 Gate/CI coupling

Any rename degrades gates silently instead of failing them: a stale `paths-filter` makes a job skip and
`ci-gate` accepts `skipped`; a stale ratchet root reports `0 ≤ baseline` and passes; `check:code-norms`
normal mode passes and only the separate `--ratchet` step fails; `package-dist.sh` keeps exiting 0 while
one sibling `dist` exists. P0/R1–R3 fix this before the first move.

---

## 7. Untangle work items

| ID  | Item                                                                                                   | Phase |
| --- | ------------------------------------------------------------------------------------------------------ | ----- |
| U1  | `scripts/lib/repo-paths.mjs` — single source for every root; every ratchet imports it                    | P0    |
| U2  | Fail-closed scans: every ratchet asserts a non-empty source set (8 vacuous, 2 coverage-loss)            | P0    |
| U3  | `dbInit({ seeds, hooks })` + injected `dbPurge`/snapshot adapters                                       | P1    |
| U4  | Logger + tenant-context inversion (inject pino into `@mms/db`; ALS context owned by `@mms/db`)           | P1    |
| U5  | Move db-sync/document-store/backup orchestration out of `db/` into `be-core`                            | P1    |
| U6  | `FacultyAccountGuard` port replaces the authenticate middleware's dynamic import                        | P1    |
| U7  | `ModuleDescriptor` + job-runner/port registry; `be-core` forbidden from importing modules                | P1    |
| U8  | Promote composites into `@mms/ui` (Modal merge, `FormField` family, `DatePicker`, `DataTable` promotion — `WorkBatchTable` is already there — remaining work engines, scaffold) | P2 |
| U9  | `fe-core` completion + host-resolver inversion (`lib/host`)                                              | P2    |
| U10 | FE route-contribution registry (replaces `moduleRegistry.ts` static map + `TENANT_APP_ROUTE_ACCESS` aggregation); widget/report contribution registries replace the 166 facade edges | P2, P6 |
| U11 | Break `{accounting, obligations}` via `LedgerPostingPort` / `ObligationVoucherPort` / `FxRatePort`        | P3/P4 |
| U12 | Break `{students, enrollments, sessions, attendance}` via the four academic ports                        | P6    |
| U13 | `ContactDirectoryPort` (purpose-built minimal DTO, per `mms-auth-security` §3)                          | P4    |
| U14 | `FacultyRolePort` for `users → faculty`                                                                 | P6    |
| U15 | `TENANT_ROUTE_PREFIXES` in `@mms/contracts`, dual mount, collapse `/api/v1/tenant/faculty`               | P7    |
| U16 | Update `MODULE_ROUTE_ACTION_RULES`, `MODULE_ROUTE_PREFIXES`, `EXPECTED_MODULE_ROUTE_ACTIONS` in the same commit as every prefix change | P3–P7 |
| U17 | `registerWebApps` host-based dual SPA serving replaces `frontendSpa.ts`                                   | P8    |
| U18 | Platform identity: `platform/auth` + `platform/shell` → `apps/platform-web/src/core`; EN-only; no SW    | P8    |
| U19 | Split e2e projects + two-server bootstrap + seed helpers                                                | P8    |
| U20 | Codemod `@shared/ui → @mms/ui` (10 stale comments in `packages/ui`) and remove the phantom alias        | P2    |
| U21 | Move `apps/frontend/eslint-rules` → `tooling/eslint-config/{rules,baselines}` and repoint baselines      | P2    |
| U22 | `packages/db` gains `db:check`/`test:db`/`test:rls` + the RLS/index CLIs; **`db:migrate` deliberately stays on `mms-api`** because it runs the app-owned boot pipeline (DDL + 81 data migrations + seeds, P1b-4) | P1 ✅ |
| U23 | ~~`DocumentStoreRepositoryLoader` port so the legacy doc store can move into `be-core/db-sync`~~ — **closed in P1b-3**; `relationalSnapshot` stays app-side by design (materialized loader) and uses the port | P1 ✅ |

---

## 8. Phased checklist

Every phase: **Enter** = previous exit green · **Work** · **Gates** · **Exit** · **Rollback**. All gates
include `pnpm typecheck`, `pnpm lint`, `pnpm test` for touched packages, `pnpm format:check`,
`node scripts/verify-rules-integrity.mjs`, and `pnpm ci:local:full` unless stated otherwise.

### P0 — Governance and stabilization (no application moves)

**Enter:** the current in-flight migration is either committed (preferred) or explicitly signed off as the
baseline for all later diffs, and the standards mirrors are regenerated and verified.

**Work:**

- [x] `check:pwa` gate closure: reviewed re-baseline of the entry ceiling **50 → 80** (69 entries /
      2.28 MB of the unchanged 3.5 MB payload); the entry-closure transform is intentional. P8 replaces it
      with per-app budgets.
- [ ] Stabilize the in-flight migration: review and commit the ≈6,900 changed/untracked paths (or record a
      signed-off baseline commit) so later PRs diff against a known tree. Regenerate the standards mirrors
      with `bash .agent/scripts/sync-all.sh` and verify.
- [x] `scripts/lib/repo-paths.mjs`: absolute `ROOT`, `PATHS` (transitional + target roots), `moduleDir`,
      `toRel`, `hasAnySourceFile`, `countSourceFiles`, `assertScanDirs`, `assertExistingPaths`,
      `assertAnyScanDir`, and `EmptyScanError`; unit-tested by `scripts/ci/repo-paths.test.mjs`.
- [x] Fail-closed U2 (11 gates): `check-frontend-structure`, `check-work-directory`, `check-faculty-domain`,
      `check-money-safety`, `check-tdd-pairing`, `check-code-norms` (normal mode), `check-shared-structure`,
      `check-migrations-forward-only` (SQL + TS extensions), `ci/check-db-test-hygiene`,
      `ci/check-changed-coverage` (a stale `--root` no longer exits 0) and the `mms-shared-ui` skill script
      now fail when their scan set is empty.
- [x] Close the `check-shared-ui` dynamic-import blind spot: `import(`/`require(` arms on both
      cross-console directions and the shared-layer→platform rule, with the two sanctioned bridge files
      allowlisted as P8 debt (the gate prints them each run). Skill mirrors regenerated with
      `bash .agent/scripts/sync-all.sh`; `verify-rules-integrity` green.
- [x] `scripts/check-topology.mjs` (+ `scripts/ci/topology.test.mjs`, 16 cases, `check:topology`): rejects an
      undeclared app root or package, a half-created module directory, a module package that is not
      `@mms/mod-<lowercase-kebab>`, a module root export (D13), a missing `src/`/audience, and a dropped
      `pnpm-workspace.yaml` glob. This is the complement to the move ledger: the ledger tracks declared
      moves, topology catches undeclared drift.
- [x] `scripts/migration/move-manifest.json` (+ JSON Schema) and `scripts/check-move-manifest.mjs`
      (`todo`/`done` consistency, duplicates, path shape), wired as `check:move-manifest` in the CI
      `ratchets` job; unit-tested by `scripts/ci/move-manifest.test.mjs`.
- [x] `scripts/codemod/move-modules.mjs`: `--allow-cross-root`, repeatable
      `--target-alias <spec>=<dir>`, `--verbose`, and a correctness fix — specifiers whose importer and
      target did not move are now preserved byte-for-byte (previously every `.js` specifier in the scanned
      root was rewritten). Verified with a dry-run on the attendance component.
- [x] CI plus local CI: `.github/workflows/ci.yml` gained `apps/api/**`, `apps/tenant-web/**`,
      `apps/platform-web/**` in `backend_db`, `frontend`, `backend_unit` and `full_tests`, and a
      `Migration move ledger` step; `scripts/ci/local-ci.sh` buckets the same target roots (frontend,
      backend_unit, backend_db) so a PR touching only a future app root cannot skip its bucket locally.
- [x] `ci-gate` skip policy: `scripts/ci/ci-gate-policy.mjs` now also fails a ready PR whose **frontend or
      backend unit matrix** was skipped although its path filter matched (DB/E2E/RLS were already covered);
      env wiring added to the `ci-gate` step and 3 new policy tests.
- [ ] Inventory goldens — **moved to P7, not P0** (decision recorded below). The counts in §13 are the P0
      baseline; pinning the 207 route files as a golden before the P4–P6 module waves would force a
      regeneration at every wave, so the machine-checked `check:routes-inventory` lands in P7 where the route
      set is stable and the composed inventory must equal the §13 counts plus the `/api/tenant/*` aliases.
      Rationale: an inventory that changes every phase is churn, not a ratchet.
- [x] Hygiene: removed the untracked `failed_job.log` and `lhci-comment.md`, plus **10** stray compiled
      `.js` files under `packages/modules/iam/src/{backend,shared}` (they shadowed the `.ts` sources at
      Node ESM resolution). Added a zero-baseline ratchet to `check-code-norms` — "Compiled JS beside
      package sources (must live in `dist/`)" — proven to fail on a synthetic stray file and recover.
      **Remaining:** decide on the 11 root `CONTACTS_*.md` + `ACTION_COLUMN_REVIEW.md` +
      `SETTINGS_REVIEW.md` (archive or delete).
- [ ] U22 is **P1b-dependent, not P0**: the `db:migrate` runner still lives at
      `apps/backend/src/scripts/migrateDb.ts`, so giving `packages/db` the script requires moving that CLI
      (and the deploy scripts that call `pnpm --filter mms-backend db:migrate`) in P1b. Recorded here so the
      P0 exit is not blocked on it.

**Gates:** `pnpm run test:scripts`; `pnpm run check:ratchet-baselines`;
`node scripts/verify-rules-integrity.mjs`; `pnpm run check:docs`; full CI green on unchanged behaviour;
demonstrate fail-closed by temporarily renaming a scanned directory locally and confirming the ratchet
fails.

**Exit:** all gates green; `move-manifest` empty; a ratchet with an empty scan set fails; no path literal
points at a nonexistent root.

**Rollback:** revert the governance commit; no application code changed.

### P1 — Backend kernel completion (depth 0): `packages/db` + `packages/be-core`

**Enter:** P0 exit.

**P1a — de-inversion inside the app (no moves) — LANDED**

- [x] `dbInit` de-inversion (U3): the orchestrator takes a **required**
      `services: PlatformBootServices` bag; `bootstrap/bootServices.ts` is the only module that knows the
      six platform services, and `bootstrap/initializeDatabase.ts` binds them for the 23 script/worker call
      sites. `app.ts` deliberately keeps importing `initDb` through the `db/database.js` facade because 101
      integration suites mock that module (`initDb: vi.fn()`); it passes the bag explicitly. Verified:
      `db → services` is **0** outside `db/migrations/**`. Deviation from the earlier sketch: a
      `configureBootServices()` registry + `setupFiles` was dropped — only `dbInitBootLock.test.ts` calls
      `initDb` for real, so an explicit parameter is simpler and fails closed at the type level.
- [x] `dbPurge` + snapshot adapters (U3): `TenantPurgeHooks.deleteAuthArtifacts` (injected by
      `services/workspaceService` and `services/dbSyncService`) and `SnapshotAssetSource` (injected by
      `routes/common/db/dbSyncRoutes`); the asset streaming helper was extracted to
      `db/snapshotAssetSource.ts` to keep `streamingSnapshotProducer.ts` under the 300-line cap.
- [x] `httpErrors`/`pgErrors` shims are no longer imported **from `db/`**: the codemod gained
      `--retarget file=packageSpec` (66 files, **62 statements**) so `db/` imports
      `@mms/be-core/http/errors` directly. `db → lib` is now **74 statements**: `dbDate` 28, `cache` 13,
      `tenantContext` 10, `logger` 7, `workspaceDay` 6 and 10 single sites, all app-local.
      **`tenantContext`/`logger` were deliberately NOT retargeted:** 70 and 19 test suites respectively
      `vi.mock()` those shims, so retargeting them inside `db/` silently bypassed the mocks (one test caught
      it: `clearFinishedBackgroundJobs` lost its tenant context). The shims stay as the stable test seam and
      are deleted together with their mocks in P1c.
- [x] `AccountDeletionGuard` port (U6): `middleware/accountDeletionGuard.ts` (fail-closed when unconfigured),
      `modules/faculty/adapters.ts` (the only importer of the faculty adapter), wired from
      `routes/index.ts`. `middleware/authenticate.ts` has no domain import; 4 port tests cover
      unconfigured → throw, delegation, rejection propagation and reset.
- [ ] Relocate domain-owned `lib` files (`contactRelationshipMirrorService`,
      `registerContactsVcfExportJobRunner`, `dashboardWidgetsService`) — unchanged, P1c.
- [ ] The 5 data migrations that import services (`084`, `085`, `086`, `088`, `090`) stay as the documented
      `apps/api`/P1b exception: the registry entries are `{ id, load }` and porting all 70 is P1b work.

**P1b — `packages/db`**

> Already in `packages/db/src`: `client`, `dbClient`, `dbConnection`, `dbTransactions`, `commitScope`,
> `dbPoolMetrics`, `tenantScopeGuard`, `tenantTransactionGuards`, `rlsRoleGuard`, `scope`, `context`,
> `request-context`, `migrations`, `testing`, `schema*`, `soft-delete/`, `seed/`.
> **Landed (P1b-1):** `transactionSideEffects` + `genericRelationalConditions` moved into
> `packages/db/src/` with new `@mms/db/*` exports; their 5 app importers rewritten by the codemod
> (`--retarget`), and both moves recorded as `done` in the move ledger.
>
> **Landed (P1b-2):** `packages/be-core/src/db-sync/` now owns `stripCredentials`,
> `snapshotAssetSource`, `snapshotSettingsSource` (new seam) and `streamingSnapshotJson` (+ an
> `index.ts` barrel; `./db-sync` and `./db-sync/*` exports). The app keeps 1-line re-export shims at
> `db/snapshotAssetSource.ts` and `lib/streamingSnapshotJson.ts` so mocks/importers are untouched, and
> `streamingSnapshotProducer` now receives a `SnapshotSettingsSource` (branding/global-settings) instead
> of importing the app services; `dbPurge` takes a `deleteExportBlobs` hook composed by
> `services/workspaceService`. A repository loader is the remaining blocker for the rest (U23).
>
> **Landed (P1b-3) — U23 closed.** `packages/be-core/src/db-sync/` now also owns the legacy document store
> (`documentStore*` ×6), the `relationalReplaceMapping*` data, `dbPurge` and `streamingSnapshotProducer`.
> The document store's relational mirror/replace path resolves repositories through the new
> **`DocumentStoreRepositoryLoader`** port (`configureDocumentStoreRepositoryLoader` /
> `loadDocumentStoreRepository`, fail-closed when unconfigured). The app registers it in
> `apps/backend/src/db/documentStoreRepositoryLoader.ts`; the closure lives in `apps/backend/src/db/`, so the
> mapping's `./repositories/*` specifiers resolve app-relative under Node **and** Vitest. Every app doc-store
> entry point is a 1–3-line shim that imports that module before re-exporting, so the port is configured on
> any import path — which is why the 4 mocking suites (`documentStoreObjects` ×3, `documentStoreKeys` ×1) are
> unaffected. `relationalSnapshot` stays app-side (it is the materialized loader) and uses the same port; the
> producer's second by-path load (relational table streaming) goes through it too, and its package-self import
> was made relative so a clean `rm -rf dist` build succeeds.
> Real-Postgres parity: all three `streamingSnapshotDb` cases pass (`/sync`, `/backup`, paged producer).
> **Ratchet coverage:** `check:db-projections` now also scans `packages/be-core/src`.
>
> **Rejected earlier, recorded for the next engineer:** moving this cluster *without* the port (P1b-2 attempt)
> failed `/backup` parity on `import(mapping.importPath)` — the mapping encodes app paths, so the importer must
> come from the app. `preparedColumns`/`preparedStatements`
> are **blocked**: they import `db/repositories/{studentRepositoryColumns,academicCatalogNameSql}` (D2 keeps
> repositories with their module until P6), so they stay in the app for now.
> **Ratchet coverage extended in the same change:** `check:code-norms` and `check:db-projections` now scan
> `packages/db/src` — moving code into the package must not let it escape a gate.
>
> **Decided (P1b-4) — `database.ts`, `dbInit.ts` and the data migrations stay app-side.** Measured on the live
> tree: the 81 data migrations are **not** portable as the original estimate assumed.
> - `../database.js` ×38 — all 7 symbols are document-store admin/object helpers, which now live in
>   `@mms/be-core/db-sync/documentStore` (P1b-3).
> - `../../services/workspaceService.js` ×4, `../repositories/facultyAssignmentValidation.js` ×2,
>   `../../lib/logger.js` ×3 — app service/repository/lib coupling.
> Moving them into `packages/db` would force a `db → be-core` import for the document store, inverting the
> only current kernel direction (`@mms/db` has **0** `@mms/be-core` imports; `@mms/be-core` has 23 `@mms/db`
> imports). They are one-time historical migrations (frozen; only re-run on a fresh dev/test DB), so — like
> `dbInit` (D-kept in `apps/api`) — they stay app-side. `database.ts` is already the thin app facade tying
> `config → @mms/db` + the doc store + `initDb`; `dbInit.ts` is the boot pipeline. Nothing further to move.
>
> **Landed (P1b-5): the RLS role CLIs moved to `packages/db`.** `checkRlsRole` and `provisionRlsRole` (both
> `pg`-only) moved to `packages/db/src/scripts/` with their unit test (`checkRlsRole.test.ts`, 12 tests); the
> app keeps delegating scripts (`db:check-rls` / `db:provision-rls` → `pnpm --filter @mms/db run …`) so the
> operator runbooks stay valid. **Deploy literals updated in the same change** as the move: the preflight in
> `scripts/deploy-on-server.sh` now looks for `packages/db/{dist,src}/scripts/checkRlsRole.{js,ts}`, and the
> CI provision step runs `pnpm --filter @mms/db exec node src/scripts/provisionRlsRole.ts` (Node 24 type
> stripping — no `tsx` dependency added). Verified end-to-end against local Postgres: `strict` + superuser
> exits 1 with the refusal message, `strict` + `mms_app` exits 0. `packages/db` suite 25/25; ledger 20/20.
>
> **Landed (P1b-6): `db:check` and `index:concurrent` logic moved to `packages/db`.** Both CLIs now live in
> `packages/db/src/scripts/` (`checkMigrations`, `createIndexConcurrently`) and build the connection from the
> process environment only — `packages/db` never parses `.env`. `apps/api` keeps 2-line env-loading wrappers
> (`loadBackendEnv()` → package `main()`), so `pnpm --filter mms-api run db:check` / `index:concurrent` behave
> exactly as before. The 13 out-of-band index `.sql` files (10 from `apps/api/src/scripts/`, 3 from
> `apps/api/scripts/sql/`) now have one home, `packages/db/scripts/sql/`; the 2 doc links, 3 path mentions, the
> `check-migration-indexes` comment and the `enrollmentIntegrityIndexes` error string were repointed in the same
> change. `migrateDb` **stays app-side** (U22 corrected): it runs `initializeDatabase()` = DDL + the 81
> app-owned data migrations + seeds. Tests added where there were none: `findUnappliedMigrations` (journal↔applied
> coercion) and `parseArgs` (the DDL injection boundary) — `packages/db` suite 39/39. The 4 migration ratchets
> needed **no** scan-root change (verified green with their existing roots).
>
> **Coordination fix in the same change:** the concurrent examinations-module extraction left **35** broken
> links in the 6 `docs/examinations-*-audit-2026-11-11*.md` files (`../apps/api/src/examinations/**`,
> `db/repositories/examination*`, `routes/tenant/examinations.ts`, `services/examinationsMarksImportService.ts`).
> Each was repointed to its existing `packages/modules/examinations/src/backend/**` target with an
> existence check per link (0 unresolved), restoring `check:docs`. `verify-rules-integrity` remains red from
> the same extraction (`mms-student-lifecycle` SKILL.md still cites `apps/api/src/examinations/` and
> `apps/api/src/hasanat/`) — that is the extraction owner's fix, not P1b.

- [x] Move `apps/backend/src/db/{tenantTransactionGuards,tenantScopeGuard,rlsRoleGuard,commitScope,dbPoolMetrics,transactionSideEffects,genericRelationalConditions}.ts` into `packages/db/src/**`; move `documentStore*`, `dbPurge`, `streamingSnapshotProducer`, `relationalReplaceMapping*` into `be-core/db-sync`; keep `dbInit` + `database` (facade) + `prepared*` (repo-coupled) + `relationalSnapshot` (materialized loader) in the app. — **done** (P1b-1/2/3)
- [ ] ~~Move the 70 portable TS data migrations into `packages/db/src/migrations/**`~~ — **corrected: stay app-side** (see P1b-4 decision). Add the `db:migrate`, `test:db`, `test:rls` scripts and their vitest configs, still targeting the app-owned migrations.
- [ ] Move migrate/RLS/index/partition CLIs + `scripts/sql` into `packages/db`; leave seeds/resets/purges in
      `apps/api/src/scripts`.
- [ ] Update the 4 migration ratchets (`check:{migration-hygiene,migration-indexes,migrations-forward-only,db-projections}`),
      `.githooks/pre-commit`, `Dockerfile`, `package-dist.sh`, deploy scripts, coverage dirs, and the
      `backend_db` CI filter in one commit.

**P1c — `packages/be-core`**

> **Landed (P1c-1):** `cryptoAtRest` deduplicated — `apps/backend/src/lib/cryptoAtRest.ts` was byte-identical
> to `packages/be-core/src/audit/cryptoAtRest.ts`; the app file is now a shim
> (`export * from "@mms/be-core/audit/cryptoAtRest"`) with a new `./audit/cryptoAtRest` subpath (so the shim
> does not drag in the whole `audit` barrel). Its 3 app importers (`subjectKeyService`, `workspaceLlmSecrets`,
> `cryptoAtRest.test.ts`) are untouched and the 5 app crypto tests pass through the shim.
>
> **Landed (P1c-3…7):** `contentDisposition` (`http/`), `metrics` (`telemetry/`), `concurrencyLimiter` +
> `leaderElection` (`queues/`), `devLogging` (`logger/`) and the `backgroundJobAbort`/`backgroundJobIds`
> pair (`jobs/`, new top-level `./jobs` home), `syncLimits` + `restoreLock` (`db-sync/`), and the calendar
> helpers `zonedTime` + `workspaceDayBounds` + `icalFormat` (new `be-core/datetime/` module) and `cacheManager`
> (`be-core/cache/`, completing the cache surface) moved into `be-core`; app files codemod-retargeted and
> deleted; recorded `done` in the move ledger (18/18).
>
> **Cycle measured (P1c planning gate).** Kernel `lib` extraction is complete: a corrected scan (resolving
> `./` siblings) finds **0** movable kernel `lib` files left — the 5 remaining "pure" files are domain-bound
> (`messageLogClaimId`, `questionMediaPolicy`, `taskNotificationI18n`, `moduleRouteActionRules{Examinations,Sessions}`)
> and belong in their modules (P4/P6), not `be-core`. `lib → services` is **9** edges, all app-layer glue
> (`csvExportEnqueue`, `registerModuleCsv*`, `currentTenantRole`, `errorHandler`, `moduleAvailabilityService`,
> `rateLimitConfig`, `tenantRoleCatalog`) that correctly stays app-side. `services → lib` is 78 files, all
> domain-specific or entangled. **Next P1c step:** break `services ↔ repositories` + `services ↔ db` facade
> edges with injected ports (the `onAudit`/`enqueueJob`/`can` pattern) before the ~55 kernel services can move;
> this is the architectural slice, not a file shuffle.
>
> **Landed (P1c-11, first services-kernel move via injected port):** `sessionClockService` → `be-core/auth/sessionClock`.
> The idle-clock implementation moved into the kernel with a `configureSessionTokenRevoker` port (fail-closed
> when `revokeSession(scope, jti)` needs the revoker but none is registered); the app keeps
> `services/sessionClockService.ts` as a registration shim that injects `revokeToken` and re-exports the
> kernel (plus the two `*SessionScope` helpers, which already lived in `be-core/auth` guards). This is the
> `onAudit`/`enqueueJob`/`can` pattern in miniature — the template for the remaining ~54 kernel services.
>
> **Landed (P1c-12):** `sessionPolicyService` → `be-core/auth/sessionPolicy` with a
> `configurePlatformIdleMinutesProvider` port (the only app dep was `getPlatformSettings().idleSessionMinutes`);
> the app keeps a registration shim. Also repointed two orphaned imports in the concurrent `hasanat`
> use-cases (`backgroundJobIds`/`backgroundJobAbort` → `@mms/be-core/jobs/*`) left by the P1c-7 move.
> Backend `typecheck` is back to **0 errors** after the concurrent module extraction settled.
>
> **Landed (P1c-13):** `dbSyncRestoreAudit` → `be-core/db-sync/restoreAudit` with a
> `configureRestoreDataSynchronizer` port (its only app dep was `dbSyncService.synchronizeData`). Attempted
> `sessionGuardService` → `be-core/auth/sessionGuard` but **reverted**: the concurrent process already moved
> the Fastify-aware session enforcement into `be-core/auth/session.ts`, which exports the same
> `SessionClockOutcome`/`SESSION_EXPIRY_RESPONSE`/`SessionClockCheck` — a duplicate would have collided. The
> low-level clock enforcement still in `services/sessionGuardService.ts` must be *reconciled* with that file,
> not moved beside it.
>
> **Landed (P1c-14):** `authSessionService` → `be-core/auth/sessionRevocation` (pure move — zero app deps, only
> the redis shim; no port needed). Fixed two orphaned `lib/cache/index.js` imports in concurrent files and
> **repaired a mock-sensitivity regression from P1c-11**: the `sessionClock` shim's static `revokeToken`
> import broke any test that `vi.mock`ed `authSessionService` partially, so the shim now registers the
> revoker lazily (dynamic import on first use). Re-created `services/authSessionService.ts` as a shim after
> the concurrent `services/auth/` reorg deleted it.
>
> **Landed (P1c-15):** `backgroundJobDeadline` → `be-core/jobs/backgroundJobDeadline` with a
> `configureJobTimeoutResolver` port (its only app dep was `worker/queues/queueConfig.resolveJobExecutionTimeoutMs`).
> The jobs runtime in `be-core/jobs` now holds `backgroundJobAbort`, `backgroundJobIds`, `backgroundJobDeadline`
> alongside the concurrent `jobEnqueuer`/`jobRunnerRegistry`/`registerModuleCsvImportJobRunner`.
>
> **Landed (P1c-16):** `backupAssetService` → `be-core/db-sync/backupAssetService` with a
> `configureUploadsRootResolver` port (its only app dep was `config/uploadConfig.resolveUploadsRoot`).
> The backup asset seam (`collectAssetUrlsFromValue`, `readAssetBase64`, `exportBackupAssetsForSnapshot`,
> `restoreTenantAssets`) now lives beside the snapshot producer; real-Postgres `/backup` parity still passes.
>
> **Coverage measured (P1c gate, round 18):** the kernel-move phase is **complete**. Of the 111
> `services/*.ts`, 5 are already be-core shims and the remaining 106 real implementations are all coupled:
> **37** repository, **34** service-to-service, **8** app-config (`config/uploadConfig` etc.), **7** module
> (`@mms/mod-*`), and **11** domain (import `../<domain>/use-cases/*`) — i.e. **0** remaining clean kernel
> services. Moving any of them needs the injected ports (`onAudit`/`enqueueJob`/`can` + repository/config
> ports) or the module extraction, not a file shuffle.
> **Rejected this round:** `messagingOutboundProvider` → `be-core/transports` (3 real importers: SMS +
> WhatsApp send paths + its test). It worked at build/typecheck but the suite failed: the test spies
> `fetchSafeExternal` on the app `../lib/outboundUrl.js` shim, which the be-core module does not route
> through. Reverted cleanly — it needs the test's 5 spy sites retargeted to
> `@mms/be-core/transports/outboundUrl` in the same change.
>
> **Pinned (P1c, round 19):** the five port registries now have a consolidated fail-closed suite
> (`packages/be-core/src/portRegistries.test.ts`, 9 tests) covering `sessionClock` revoker,
> `sessionPolicy` idle-minutes, `backupAssetService` uploads-root, `restoreAudit` synchronizer and
> `backgroundJobDeadline` timeout resolver — an unconfigured port throws instead of silently skipping
> revocation / path resolution / restore / a job budget. be-core suite 34/34.
>
> **Landed (P1c-2):** `lib/cache/*` shims retired. `index`, `multiTierCache` and `cacheInvalidation` were
> already 1-line shims over `@mms/be-core/cache/*`; the codemod (`--retarget`, which also rewrites
> `vi.mock` paths) repointed **59** files (40 importers + 15 `vi.mock("../lib/cache/index.js")` sites +
> the `cacheInvalidation`/`multiTierCache` direct importers) to the `@mms/be-core/cache*` subpaths, the 3
> app files were deleted, and the 3 moves are recorded `done` in the ledger. **12** cache-touching suites
> (74 tests) pass. Also fixed the `cacheInvalidationSubscriber` test that the cache extraction left broken:
> its redis mock now targets `@mms/be-core/redis` (what be-core's `cacheInvalidation` actually imports)
> instead of the app `../lib/redis.js` shim. Backend `typecheck` is clean.

- [ ] Move the kernel subset of `lib` (route factories, `httpErrors`, `zodRequest`, `contract*`, `rbac*`,
      `rateLimit*`, `livePush*`, `redis*`, `cache*`, `workspaceDay*`, `occHeaders`, `payloadTrimmer`,
      `validatedReply`, export/import/setup route factories) and `services` (~55 kernel: auth/platform
      settings, background jobs, audit, db-sync, workspace, tasks/notifications, storage, messaging/email
      transports), plus `middleware`, `plugins`, `config`, `routes/common`.
- [ ] Delete the 50 `lib` shims and 5 `services` shims after a `--rewrite-only` codemod pass.
- [ ] Break `lib ↔ services` with injected hooks (`onAudit`, `enqueueJob`, `can`); keep one layer order in
      the package and add a folder ratchet.
- [ ] Jobs runtime (`queues`, `jobs`, `backgroundJob*`) in `be-core`; modules register runners via
      descriptors (U7).

**Gates:** `check:backend-boundaries`, `check:backend-structure` (baselines 46/66/17/51 must not increase),
`check:db-projections`, the 4 migration ratchets, `pnpm --filter @mms/db test:db`, `test:rls`,
`moduleAccessCoverage.test.ts`, backend unit suites, `pnpm build`, tarball assertion.

**Exit:** `packages/db` imports no app or `be-core`; `be-core` imports no app or module; the route inventory
matches the §13 counts (the byte-level golden is pinned in P7, where the route set is stable); 277 journal
entries unchanged.

**Rollback:** each sub-step is a separate PR; the tarball assertion is the deploy tripwire.

### P2 — Frontend kernel completion (depth 0): `@mms/ui` + `@mms/fe-core`

- [ ] Merge the `Modal` fork (U8): fold `fe-core/components/Modal.tsx` capabilities into
      `packages/ui/src/modal/Modal.tsx`, migrate its single production consumer
      (`platform/features/activity-logs/ActivityLogInspectModal.tsx`), delete the duplicate.
- [ ] Promote engines/composites: `common/data-table/DataTable` (179 L — still app-local),
      `descriptors`, `catalog`, `SectionCard`, `EmptyState`, `ErrorState`, `SettingsShell`, `StatCard`,
      `SubTabBar`, `ModuleCommandMetricsGrid`, form selects, `DetailDrawerShell`, the remaining
      `common/work` pieces; `WorkBatchTable` (286 L) is already in `fe-core` (1-line app facade).
      Reconcile the zero-import `PageHeader`.
- [ ] Delete the remaining 94 `@mms/ui` facades and 203 `@mms/fe-core` facades (codemod `--rewrite-only`), then delete
      the unused export keys.
- [ ] Deduplicate the three alias blocks (vite, vitest, tsconfig) into one shared list; keep the single
      React copy guarantee.
- [ ] Complete `fe-core`: generic `lib` (api/query/forms/contexts/i18n/storage/backgroundJobs/reporting),
      generic `hooks`, route helpers; move `lib/host` to an injected host resolver (U9).
- [ ] Move `apps/frontend/eslint-rules/**` (6 rules, 2 rule tests, 3 baselines) into
      `tooling/eslint-config/{rules,baselines}` (U21); update `no-cross-feature-imports.cjs` baselines.
- [ ] Remove the `@shared/ui` phantom (U20).
- [ ] Update `check:shared-ui`, `check:frontend-structure`, `check:work-directory`, `check:forms` +
      `docs/forms-inventory.md`, `check:code-norms` SCAN_DIRS.

**Gates:** all frontend ratchets, `pnpm --filter mms-frontend test`, `pnpm --filter @mms/ui test`,
`pnpm --filter @mms/fe-core test`, `pnpm build`, `check:bundle`, `check:pwa`, e2e smoke + a11y.

**Exit:** `packages/**` contains no `@/` import; no duplicate React copies; tenant and platform behaviour
unchanged.

**Rollback:** revert the phase; UI/fe-core are additive packages.

> **Ledger catch-up (same round):** the JSON move ledger had drifted to **21 P1 entries only** — none of the
> module extractions performed since (contacts, hasanat, examinations, question-bank, faculty, messaging,
> audit, documents, notifications, obligations, accounting, billing, workshops) were recorded, so the
> `check-move-manifest` gate was validating a stale picture. Recorded the verifiable P4 moves
> (feature dir → `src/frontend/tenant`, API domain → `src/backend`, routes → `src/backend/routes`,
> repositories → `src/backend/repository`) as `done`; the gate confirms the ledger now matches the tree
> (**75 entries: P1 21, P4 54** after the sessions/students/enrollments extraction caught up in P12e — the
> ledger itself was retired on 2026-11-27, see P16).
> Future extractions must add their entry in the same change.

### P19 — the prune is complete: residues retired, both suites green (landed)

> The owner finished the P14 objective between rounds: `apps/platform-web/src/tenant/**` is **gone** (the milestones
> doc records 2,312 files removed), the app lints as `appKind: "platform"` with **zero** tenant-audience imports, and
> `check:web-app-isolation` is CI-wired at a zero baseline. `apps/platform-web` fell **2,081 → 483** source files.
>
> **Residues this round retired** (everything that still described the copy as present):
> - `scripts/check-frontend-structure.mjs` — `barrelSkip` for the platform tenant tree → `null`.
> - `scripts/check-module-boundaries.mjs` — dropped the two audience rules for subtrees that no longer exist
>   (`apps/platform-web/src/tenant/`, `apps/tenant-web/src/platform/`).
> - `scripts/check-form-architecture.mjs` and `scripts/check-work-directory.mjs` — comments no longer say the copy is
>   "awaiting the P11a prune".
> - Shard fixtures re-pruned: platform **307 → 122** keys (185 stale), tenant 308 → 306.
>
> **Verified after the prune:**
> - `mms-platform-web` suite: **321 files / 1,248 tests, 0 failed** (was 1,017 / 3,698 with the duplicate's tests).
> - `mms-tenant-web` suite: **576 files / 2,524 tests, 0 failed** (its first run failed only on a stale shard fixture;
>   a second run hit a corrupted Vite dep cache, cleared, then green).
> - Both typechecks **0**; **39 of 40 gates green** — the only red is `check:accounting-coverage`, which needs
>   `pnpm --filter mms-api run test:db:coverage:finance` first (a CI-order prerequisite, not a regression).
> - `verify:rules`, `check:docs`, `test:scripts` (145) green; `check:module-exports` green on the smaller surface
>   (329 imports / 273 files).

### P18 — module-exports gate, IAM export fix, and the prune's test fallout (landed)

> The owner's tenant-tree prune kept deleting while this round ran (`src/tenant/**` 1,861 → 891 files, then a
> second wave removing `lib/` and `providers/` files), so this round stayed on the residue it could prove stale.
>
> **Fixed (all real, all reproducible before the fix):**
> - **`@mms/mod-iam/frontend/tenant/UsersPage` was unreachable.** The package's `./frontend/tenant/*` wildcard lists
>   `*.ts` before `*.tsx`, and Node's exports arrays do not fall through on a missing file, so the app's new
>   `moduleRegistry.ts` import failed to resolve and took **9 platform test files** down with it. Added the explicit
>   entry (same shape as the `lib/usersDescriptor` fix in P16).
> - **`moduleWorkspaceDay.test.ts` (platform)** still listed `tenant/features/attendance/components/AttendanceRegisterExport.tsx`,
>   which the prune deleted; repointed to `packages/modules/attendance/src/frontend/tenant/components/AttendanceRegisterExport.tsx`.
> - **Stale shard fixtures** re-pruned (platform `shard-timings.json` 393 → 307 keys).
>
> **New gate — `check:module-exports`** (`scripts/check-module-exports.mjs`, `scripts/ci/module-exports.test.mjs`,
> 5 tests, wired as `check:module-exports` and as a CI step after *Module audience boundaries*). It models **Node's
> exports semantics statically**: for every `@mms/mod-*` specifier the two apps import (~561 imports across 461
> files), it resolves the package's `exports` key, takes the **first** array target, and fails when that file does
> not exist — the exact shape of both IAM bugs. This class had no gate: typecheck passed while vitest could not
> resolve the specifier, so only a suite run caught it.
> - Two wrong turns on the way, worth recording: a `require.resolve`-based resolver produced **262 false positives**
>   (backend imports resolve through tsc, not the exports map), and a JSDoc comment containing `@mms/mod-*/sub/path`
>   silently terminated the block comment (`*/`) and broke the script. The final gate scans frontend trees only and
>   never calls the Node resolver.
>
> **The prune finished during this round:** `apps/platform-web/src/tenant/**` is now **0 files** and the app's
> source count fell **2,081 → 483** (dead-source report: 92 unrouted, 52 referenced by nothing). P14's objective is
> therefore met by its owner — the remaining reds are the refactor's own (`14` platform typecheck errors and one new
> explicit `any` at `apps/api/src/compose.ts:26` as they rewire the API).
>
> **State at the end of the round:** `check:module-exports`, `check:docs`, `check:frontend-structure`, `check:forms`,
> `check:module-boundaries`, `check:shared-structure`, `check:topology`, `check:work-directory`, `verify:rules` and
> `test:scripts` (145) are green; tenant-web typecheck 0. The platform app was **mid-refactor by its owner** while
> this was written (`@/lib/db`, `@/providers/AppProviders` and `@/lib/contexts/TranslationContext` were being moved),
> so its typecheck and suite were momentarily red for reasons that are theirs to finish — verified by path, not
> assumed: each error is a module the prune/refactor removed in the last minutes.

### P17 — plan-compliance audit: every approved plan checked against the tree (landed)

> Requested: confirm that everything from every plan in this migration arc was actually applied. Audited by
> inspection on 2026-11-27 (HEAD `0ae42bbd7` plus the resumed extraction's working tree). **Fifteen of sixteen
> plans are applied and verified; P14 (the platform-web tenant prune) is not.**
>
> | Plan | Deliverable | Evidence checked | Verdict |
> |---|---|---|---|
> | P1b-6 | db CLIs in `@mms/db` | `packages/db/src/scripts/{checkMigrations,createIndexConcurrently}.ts`, api wrapper, `db:check`+`index:concurrent` scripts | applied |
> | P3a | tooling/deploy off `apps/frontend` | `apps/frontend` gone; `apps/api/src/plugins/registerWebApps.ts` serves both dists | applied |
> | P8a | PWA gate split budgets + lazy floor | `DEFAULT_BUDGETS`: glob 10 / closure 80 / 2.5 MB / lazy floor 450 | applied |
> | P8b | host bridges out of the entry closure | bridges now composed in `providers/TenantModuleHostBridges.tsx`, mounted by `AppLayout`; `AppProviders` has none | applied (evolved) |
> | P9a | split-suite repairs | multi-root resolver in `moduleWorkspaceDay.test.ts`, `withQueryClient` in the contact modals, etc. | applied |
> | P10a | platform-web harness | `apps/platform-web/vitest.config.ts` present; the app-local `eslint-rules` copies were later retired by the extraction and their tests removed in P15 | applied (evolved) |
> | P10b/c | suite + surface green | re-verified in P15/P17 runs | applied |
> | P11a | dead-source report | `scripts/report-dead-sources.mjs` + `scripts/ci/dead-sources.test.mjs` + `report:dead-sources`, with `--duplicates` and `--quiet-window/--require-quiet` | applied |
> | P11b/c | structural ratchets on both consoles | `check-work-directory`, `check-form-architecture`, `check-frontend-structure` all two-root; baselines 0 | applied |
> | P12a/b | unreachable re-export facades deleted | tenant `components/ui` facades **0**; platform **1** (`calendar.tsx`, a real wrapper with logic); 25 tenant + 56 platform pure shims remain **because they are reachable** — the P12 criterion was *unreachable* only | applied |
> | P12c/d/e | prune-safety tooling + ledger catch-up | `--require-quiet` returns 2 on an active tree; the ledger itself was retired on 2026-11-27 (P16) | applied (superseded) |
> | P13a | CI/lint buckets for two apps + modules | `lint-changed.sh` has the `packages/modules/*/` loop and `apps/platform-web`; `local-ci.sh` runs `mms-platform-web` vitest | applied |
> | P13b | per-app changed coverage | `ci.yml` loops `for app in tenant-web platform-web` | applied |
> | P13c | sessions host invalidators | `SessionsHostProvider` binds `invalidate{Sessions,Students,Finance}Queries` + `ENROLLMENT_PLACEMENTS_QUERY_KEY` | applied |
> | P15 | stale-dist diagnosis | package rebuild → both typechecks 0 (re-verified) | applied |
> | P16 | ledger-retirement follow-ups | `ci.yml` free of `check:move-manifest`; `iam` `usersDescriptor` export present; hoist-safe i18n mock in `UsersReport.test.tsx` | applied |
> | **P14** | **prune the duplicate platform-web tenant console** | **in flight by the console's owner at audit time**: `src/tenant/**` went 1,861 → **891** files with ~900 deletions staged and 892 files touched in ten minutes (only 3 were ever in the live graph) | **being applied (owner)** |
>
> **P14 is no longer mine to run** — the owner started it on 2026-11-27 while this audit was being written. The checklist
> below stays as the procedure I would have used and as the bar for verifying their result (it also records why my own
> attempt was aborted; see P14/P15):
> 1. `node scripts/report-dead-sources.mjs --quiet-window 15 --require-quiet` must exit **0** (it exits 2 today).
> 2. Do it in a throwaway `git worktree add ../mms-prune HEAD`, never in the live checkout.
> 3. `path.resolve` every path before putting it in a set — the P14 bug was absolute-vs-relative comparison.
> 4. Abort if `src/main.tsx` or `App.tsx` enters the delete set (a guaranteed walker bug).
> 5. Delete in one batch, then verify with **typecheck + both suites** before merging back; re-measure the
>    unrouted count at the time (it has read 1,661 → 845 → 1,669 across rounds).
>
> **Recorded non-gaps (deliberate, not missed work):** the `appKind: "platform"` flip still waits on the 62
> `@mms/mod-*/frontend/tenant/*` imports in the platform tree; `check:accounting-coverage` requires
> `pnpm --filter mms-api run test:db:coverage:finance` first; `check:bundle`/`check:pwa` require a built
> `apps/tenant-web/dist`; the `UsersReport` activity-log assertion depends on the extraction's `ActivityLogs`
> component surface; and the reachable shims above are by design.
>
> **State at audit time** (2026-11-27, mid-prune): both typechecks 0 when the audit began (the platform typecheck
> flips as the prune's deletions land — it read 1 error minutes later); the tenant-web build succeeds, so the artifact
> gates pass once `dist/` is present; `verify:rules`, `check:docs` and `test:scripts` (140) green; **tenant suite
> 580 files / 2,535 tests, 0 failed** (the `UsersReport` gap closed itself when the extraction aligned `ActivityLogs`
> — it is no longer a non-gap); `check:code-norms` went green minutes after the one offending `any`
> (`apps/api/src/compose.ts:29`) was fixed, leaving only `check:accounting-coverage`, which needs its db-coverage
> artifact. The **platform suite is transiently red** (216 files mis-enumerated: 86 stale shard keys plus test files
> the prune deleted mid-run) — expected while `src/tenant/**` is being removed, and the bar for re-running it is the
> owner's completed prune, not this audit.

### P16 — the move ledger was retired; CI wiring and the record follow (landed)

> Commit `0ae42bbd7` ("chore(ci): retire the empty migration move ledger") removed the ledger entirely — the
> JSON manifest and its schema, `scripts/check-move-manifest.mjs`, its unit test, the `check:move-manifest`
> package script and the `local-ci.sh` step — because the manifest had zero entries and validated nothing. The
> permanent invariants now rest on `check-topology`, `check-module-boundaries` and the CI path-filter ratchet.
>
> Two loose ends were red at the start of this round, plus two real fixes found while verifying:
> - **`.github/workflows/ci.yml` still ran `pnpm run check:move-manifest`** — a package script that no longer
>   exists, so that step failed on every run. Removed (with its comment); the workflow parses as 17 jobs.
> - `check-docs` reported one broken link into the deleted `apps/api/src/lib/livePushConnections.ts`; that
>   reference was already gone from the working tree by the time this round started, so `check:docs` is green
>   without further edits. (The audit table's plain-text mention of the same file remains as historical prose —
>   the live-push connection caps now live in `packages/be-core/src/realtime/caps.ts`.)
>
> **Two fixes the verification surfaced** (both real, both in the extraction's own seam):
> - `packages/modules/iam/package.json` was missing the explicit `./frontend/tenant/lib/usersDescriptor` export that
>   every sibling module declares for its `.tsx` descriptor. The wildcard `./frontend/tenant/lib/*` lists
>   `*.ts` before `*.tsx`, and Node/exports arrays do **not** fall through on a missing file, so the module's
>   `usersDescriptor.tsx` was unreachable — 16 tenant-web test files failed to collect. Added the explicit entry
>   (matching `faculty`'s pattern); those tests pass again.
> - `UsersReport.test.tsx` rendered raw translation keys because it registered no i18n mock; it now mocks
>   `@mms/fe-core/i18n` through a hoist-safe async factory backed by the real English pack. One assertion still
>   fails (`activity logs … "Added student"`): the component now reads its logs through a different hook than the
>   test feeds, so the row never renders — left to the report's owner rather than asserted around.
>
> **Reading the older notes:** where P8a–P15 say "18 gates", that count includes the now-retired move-ledger gate
> (17 in the same enumeration today), and the "75 entries (P1 21, P4 54)" figures in P11a/P12e describe a ledger
> that no longer exists. The authoritative gate list is `package.json`'s `check:*`/`verify:*` scripts — 36 entries,
> of which `check:code-norms` is currently red on 79 explicit `any`s in the new host providers
> (`IamHostProvider.tsx` and friends) and `check:accounting-coverage` needs a prior
> `pnpm --filter mms-api run test:db:coverage:finance` artifact to run at all.

### P15 — stale-dist diagnosis and the platform suite re-greened (landed)

> Closed out the P14 incident:
> - **Rebuilt every package** (`pnpm --filter './packages/**' run build`, all Done) → `mms-platform-web` and
>   `mms-tenant-web` typecheck **0**, confirming the 190 errors were stale `dist`, not lost work (see the P14
>   correction above).
> - **Platform suite back to green:** 1,017 files / 3,698 tests, 0 failed. Four fixes, all test-layer:
>   - dropped four leftovers whose subjects are gone or deduped — the three `eslint-rules/*` unit tests (the rule
>     files now live only in `apps/tenant-web/eslint-rules/`, which is their canonical home; tenant-web keeps the
>     identical tests) and `themeInitPrelanguage` (the platform app ships `public/` icons but no `theme-init.js`;
>     the tenant console keeps that asset and its test);
>   - `useMessageComposerModel.test.tsx` now mocks `@mms/fe-core/auth/AuthContext` and wraps the hook in the shared
>     test `QueryClient` — the chain reads the authenticated user and TanStack Query, which the app mounts but the
>     unit test did not.
> - **Tenant suite:** 700 files / 2,840 tests, 0 failed.
> - Also re-pruned one stale shard-timing key (platform-web 394 → 393).

### P14 — ABORTED: the platform-web tenant prune and its recovery (read this before pruning again)

> **What was attempted.** Delete `apps/platform-web/src/tenant/**`'s duplicate tenant console (1,853 files, only 3
> in the live graph), after a clean pre-flight (`--quiet-window 15 --require-quiet` → 0 files changed).
> **The first stage worked**: 1,850 files deleted, the 3 live hooks kept, and typecheck showed exactly the
> expected fallout — dead shell files importing the removed paths.
>
> **What broke.** The cascade stage compared paths inconsistently: the reachability BFS produced **absolute**
> paths (`path.resolve`), the error list produced **relative** ones, so `seen.has(abs)` was always false and every
> erroring importer looked "unreachable" — including **live files such as `src/main.tsx`**. Four passes deleted 87
> files before the BFS crashed on the now-missing entry.
>
> **Recovery.** `git ls-files -d` listed 2,262 deleted tracked files (1,850 intended + 412 accidental); the 412
> were restored with `git checkout`, but a follow-up loop that tried to re-add missing modules from
> `apps/tenant-web`/`packages`/HEAD cascaded instead (typecheck errors 290 → 615), so it was stopped and the whole
> app reset with `git checkout -- apps/platform-web`. `apps/platform-web` is now **exactly at HEAD `982f2fe1a`**
> — 2,075 files, `report:dead-sources` back to 1,661 unrouted / 55 dead.
>
> **Correction (P15): the "190 errors" were a stale-build artifact, and no source was lost.** Every
> `packages/modules/*/dist` was hundreds of files behind its `src` (sessions 238, students 218, enrollments 177,
> billing 158, faculty 270, contacts 346), and the app resolves newly added exports through `exports` → `dist/*.d.ts`
> — e.g. `useFinanceInvoicesPaginated` exists in `packages/modules/billing/src/**` and was absent from billing's
> `dist`. `turbo.json`'s `typecheck` has `dependsOn: ["^build"]`, so CI always rebuilds first; a bare
> `pnpm --filter <app> typecheck` does not. After `pnpm --filter './packages/**' run build`, **both apps typecheck
> 0 errors**, and `apps/platform-web` sits cleanly at HEAD ⇒ the P14 reset discarded nothing that was not already
> committed. The lesson is procedural, not a data loss: build the packages (or use `pnpm typecheck`) before
> trusting a local typecheck.
>
> **Everything else is intact:** tenant-web typecheck 0; 16/18 gates green (the artifact gates are green with the
> current `dist`); `verify:rules` green; `check:docs` and the move ledger green; the only new red is
> `test:scripts` `apps/api/Dockerfile` missing a `COPY` for the new `analytics` module (the concurrent
> extraction's change).
>
> **Rules this produced, for any future prune:**
> 1. Normalise **every** path through one `path.resolve(root, …)` before putting it in a set or comparing it.
> 2. Abort immediately if the entry file (`src/main.tsx`) or `App.tsx` ever enters the delete set — that is a
>    guaranteed walker bug, not a finding.
> 3. Never `git checkout` a tree that may hold uncommitted work: `git stash create`/`git diff` a snapshot first, or
>    run the prune in a throwaway `git worktree`.
> 4. Delete in one verified batch, then re-measure — do not iterate deletes while a typecheck is the oracle, since
>    each pass invalidates the next oracle.

### P13c — sessions host invalidators wired in the app (landed)

> `providers/SessionsHostProvider.tsx` bound four invalidation seams as `undefined`:
> `invalidateSessionsQueries`, `invalidateStudentsQueries`, `invalidateFinanceQueries` and
> `ENROLLMENT_PLACEMENTS_QUERY_KEY`. That made the module's `invalidateEnrollmentImpacts` fan-out a no-op for
> seat counts, student schedules and finance caches after an enrollment write — a functional gap, not just a
> test failure.
> - Bound them to the real implementations (`@mms/mod-sessions|mod-students|mod-billing/…/hooks/invalidate*Queries`
>   and the app's `ENROLLMENT_PLACEMENTS_QUERY_KEY`). Typecheck passed with 0 errors at the time of the change.
> - Its conformance test (`lib/query/enrollmentImpactInvalidation.test.ts`) exercises the module in isolation, so
>   it needs the host seam configured itself; I tried three variations and **reverted the test to its original
>   state** — the remaining 2 assertions are blocked on the enrollments extraction publishing
>   `@mms/mod-enrollments/frontend/tenant/lib/enrollmentDescriptors` (typecheck currently shows 27 errors, all of
>   that one missing subpath), so touching the test again would only churn.
> - Round-end state: the tree is mid-extraction; the bundle/PWA gates need a green build (their `dist/assets` is
>   currently absent) and the suite shows 52 collection failures from the same extraction. `check:docs`,
>   `check:form-architecture` (inventory regenerated, 120 form-like files), `verify:rules` and `check:scripts`
>   are green.

### P13b — CI changed-file coverage enforced for both consoles (landed)

> P13a flagged it as unsafe to patch blind; the plumbing is now proven, so it is patched:
> - Probing `pnpm --filter mms-tenant-web --filter mms-platform-web exec vitest run <test> --coverage
>   --coverage.reportsDirectory=coverage-changed` showed **each app writes its own**
>   `apps/<app>/coverage-changed/coverage-final.json`, and `check-changed-coverage.mjs` runs cleanly against both
>   paths (both reported "no changed source files — nothing to enforce" against `--base HEAD`).
> - The CI step now loops `for app in tenant-web platform-web` and enforces the same `--min 60` on each, so the
>   platform console's coverage is no longer produced and discarded. Workflow YAML validated (17 jobs parse).
> - Probe directories removed afterwards (they are CI artifacts, not tracked files).

### P13a — local CI buckets match the two-app + modules topology (landed)

> `scripts/ci/lint-changed.sh` only knew about `apps/tenant-web`, `apps/api`, `packages/contracts` and `e2e` —
> so a PR touching the platform console **or any extracted `@mms/mod-*` package** was not linted at all by the
> changed-files path. (The repo now has 15 module packages holding most of the code.)
> - `PACKAGES` now lists `apps/platform-web`, `packages/{db,be-core,fe-core,ui}`, and a loop appends **every**
>   `packages/modules/*` directory that has an `eslint.config.js` (each is its own workspace package with its own
>   config and local `eslint`). Verified by dispatching real paths: `apps/platform-web/…` → the platform bucket,
>   a module file → the module bucket (which immediately reported 12 `no-explicit-any` errors in the new sessions
>   host wrapper), and a clean single file → exit 0.
> - `scripts/ci/local-ci.sh` runs `mms-tenant-web`'s Vitest for the frontend bucket but never the platform app's;
>   it now runs both.
>
> **Recorded gap (not patched — needs the owning CI change):** `.github/workflows/ci.yml` already *runs* both
> apps in the vitest steps, but the changed-file coverage check reads only `apps/tenant-web/coverage-changed`, so
> platform-web's coverage output is produced and then ignored. Making that a per-app pair of invocations is the
> next CI step; I did not edit the workflow blind since it cannot be exercised locally against a PR diff.

### P12e — prune guard hardened + ledger caught up (landed)

> - **`--require-quiet`**: `report:dead-sources --quiet-window N --require-quiet` now exits **2** when the tree
>   moved inside the window, so an automated prune can refuse to run instead of trusting a stale graph.
>   Verified: active tree → 2, no window → 0.
> - **Ledger:** the sessions / students / enrollments extraction added 8 more verified P4 moves
>   (`apps/{api,tenant-web}/…` → `packages/modules/{sessions,students,enrollments}/…`); the ledger is now
>   **75 entries (P1 21, P4 54)** and `check:move-manifest` validated it against the tree. *(Historical: the
>   ledger and its gate were retired in `0ae42bbd7` — see P16.)*
> - The guarded prune itself is still **not** run: the quiescence check reports the tree as active
>   (129 source files changed in 5 min), which is exactly the condition that broke round 29.

### P12d — the prune lesson became tooling (landed)

> Three follow-ups from P12c, none of which touch the tree being actively extracted:
> - **`--quiet-window <minutes>`** on `report:dead-sources`: counts source files changed under `apps/`+`packages/`
>   in that window and prints a verdict before the report (`tree is quiet — a prune can rely on this report`
>   vs `tree is ACTIVE — wait`). Today it correctly reports *ACTIVE*. Covered by a new test in
>   `scripts/ci/dead-sources.test.mjs` (6 cases; `test:scripts` 134).
> - **Move-proof form exemptions:** the form-contract audit matched `DIRTY_EXEMPT` by exact app-relative path, so
>   when the sessions extraction moved `SessionLockOverrideDialog` into `@mms/mod-sessions` the exemption stopped
>   matching and the *module copy* was reported as a new offender. Exemption lookup now falls back to the
>   basename tail (`isExempt`), so one declaration covers the component wherever it lives — the forced-lock
>   prompt is the same surface, not a new violation.
> - **Suite status:** tenant-web is at **740 files / 2,891 tests with a single failing file** —
>   `enrollmentImpactInvalidation`, whose 2 assertions fail because `providers/SessionsHostProvider.tsx` still
>   binds `invalidateSessionsQueries`, `invalidateStudentsQueries`, `invalidateFinanceQueries` and
>   `ENROLLMENT_PLACEMENTS_QUERY_KEY` as `undefined`, so the module's fan-out no-ops. That is the extraction's
>   own wiring, deliberately not "fixed" from the test side.

### P12c — prune attempt vs a live extraction: what happened, and the rule it produced

> I tried to extend the prune to the remaining dead files in `tenant-web` mid-round and it **raced the
> concurrent sessions extraction**: the agent had just repointed that feature's imports to `@mms/mod-sessions`,
> which made the app-local copies genuinely unreachable — so the graph walk said "dead", bytes-identical twins
> existed, and the delete went ahead. Moments later the agent's own rewrite and my delete interleaved: 193
> typecheck errors appeared, some restored files came back at the wrong paths (`tenant/features/components/*`
> where the real home is `components/common/catalog/*`), and a few rule globs/doc links pointed at the
> deleted paths again.
>
> **Recovery, all verified:** every deletion was restored from its byte-identical twin (package module or the
> platform copy), the misplaced tree was removed, and the tree converged: typecheck **0**, all 18 gates green,
> `verify:rules` green, `test:scripts` 133, `report:dead-sources` shows tenant-web at **12 dead (1 %)**, 42
> unrouted, and platform-web at 58 dead (3 %).
>
> **Rule this produced (for the next prune):** a dead-file sweep is only valid against a *quiescent* tree.
> Check `find <app>/src -newer <marker>` first; if packages are being edited, wait. And after any deletion,
> run `typecheck` + the suite *immediately* — the walker cannot see an import that is being rewritten in
> parallel, and a cascade (a deleted parent makes its children look dead) reports as one big lie.
>
> Glue fixed while recovering: 5 rule globs that had drifted onto deleted paths (contact-field helpers now
> live in `packages/contracts/src/contacts/contactField*.ts`, the contact config context in
> `@mms/mod-contacts`, and the retired `components/ui/**` layer now points at `packages/ui/src/**`), the
> `mms-shared-ui` skill prose/script comment (the facade layer is retired), and
> `check-frontend-structure` now treats `components/ui/` as **optional per app** — the primitive layer moved to
> `@mms/ui`, so requiring a local directory would fail closed on a correct tree.

### P12b — platform-web facades pruned too (landed)

> Same analysis, second console: 403 pure re-export shims in `apps/platform-web`, of which **350 were
> unreachable** from its entry *and* every test file — deleted (+4 empty dirs), 53 kept.
> - Effect: `apps/platform-web/src` **2,425 → 2,075 files**; files referenced by nothing fell from 408 (17 %) to
>   **58 (3 %)**. Its unrouted share (1,666) is the tenant-console copy P11a tracks for deletion — the facades
>   were not part of that decision.
> - `buttonSystemContract.test.ts` in the platform app asserted a facade at **tenant-web's** path (a leftover
>   from the split); it now asserts the shared no-fork invariant for both apps.
> - Suite **1,008 files / 3,694 tests — 0 failed**; typecheck 0; 18 gates green apart from `check-code-norms`,
>   which is red on 2 explicit `any` in the concurrent sessions-module extraction
>   (`apps/api/src/modules/sessions/adapters.ts:63-64`), not on this change.

### P12a — 378 dead re-export facades deleted (landed)

> The blueprint's P2 item "delete the remaining `@mms/ui` / `@mms/fe-core` facades" is done for the tenant app.
> 401 files were pure re-exports (`export … from "@mms/ui…"` / `"@mms/fe-core…"`); a graph walk from `main.tsx`
> plus every test file showed **378 of them are unreachable** — nothing imports them because the app already
> imports the packages directly. Deleted all 378 (+3 empty dirs); the 23 still reachable stayed.
>
> Effect: `apps/tenant-web/src` **1,915 → 1,537 files**, and its unrouted share fell from 497 (26 %) to
> **119 (6 %)** per `pnpm run report:dead-sources`.
>
> Consequences handled in the same change:
> - **36 rule globs** in 8 `.cursor/rules/*.mdc` files pointed at the deleted paths; remapped to their real homes
>   (`packages/fe-core/src/components/FormModal.tsx`, `packages/ui/src/app/ModuleTierMotion.tsx`,
>   `packages/fe-core/src/i18n/index.ts`, …) and mirrored with `sync-all.sh` — `verify:rules` clean.
> - **13 imports in two skill examples** (`mms-form-architecture`, `mms-module-page`) now use the package
>   specifiers the app itself uses (`@mms/fe-core/components/FormModal`, `@mms/fe-core/forms/useFormSubmission`,
>   `@mms/ui/app/ModuleTierMotion`, …).
> - **`buttonSystemContract.test.ts`** asserted the facade existed *as a pure re-export*; with the shims gone it
>   now asserts the stronger invariant — no app-local `components/ui/button.tsx` at all, the primitive lives in
>   `@mms/ui` — so a local fork still fails the test.
> - 16 doc links repointed to the package sources; forms inventory regenerated (143 files).
>
> Verification: tenant typecheck 0, 18 gates green, `verify:rules` + `test:scripts` (133) green, suite 2,989
> tests with the one expected contract-test update.

### P11c — structural coverage complete: all three ratchets cover both consoles (landed)

> `check-frontend-structure` was the last gate policing one app. It now evaluates a `ROOTS` table
> (`fe` / `featuresDir` / `uiDir` / `libDir` + a barrel-scan skip per app) and runs its six norms over
> `tenant-web` **and** the platform console's live `platform/features` tree:
> - **Live barrels allowlisted** — the 7 shared barrels the platform console actually imports
>   (`components/common{,/data-table,/descriptors,/work}`, `entry`, `sequence-numbering`, `template-editor`),
>   each verified reachable from its `platform/` tree, mirroring the tenant app's reviewed entries.
> - **`apps/platform-web/src/tenant/**` stays out of the barrel scan** — it is the unrouted copy P11a measured,
>   so no dead path gets encoded as an exception.
> - **The console's structural debt is recorded, not waived:** its first run surfaced 19 feature-shape sites
>   (files at `features/*/` roots, `account/` missing `components/`, `controllers/` dirs) and 10 logic `.ts`
>   files under `features/*/components/`. Both counts are set in `BASELINE` with a written reason, so the
>   ratchet now only lets them fall — the same treatment the tenant app's debt got when this gate landed.
>
> The dead-source report also gained a test suite (`scripts/ci/dead-sources.test.mjs`, 5 cases: reachability,
> side-effect and re-export edges, test-only files, duplicate proof, missing entry); `test:scripts` is 133.

### P11b — ratchets extended to the platform console's live tree (landed)

> Until now the structural ratchets policed only `apps/tenant-web`, so the operator console's 374 live files
> were unchecked. Two of the three now cover it, scoped to `apps/platform-web/src/platform` (the live tree) and
> deliberately skipping `apps/platform-web/src/tenant/**`, which is the unrouted copy P11a measured:
> - **`check-work-directory`** — 2 roots, **3,061 files** scanned (tenant-web 2,687 + platform-web 374), all eight
>   directory/table norms clean on the first run.
> - **`check-form-architecture`** — 2 roots, **157 form-like files / 59 `FormModal` files / 55 write surfaces**
>   across both consoles, clean. The one apparent platform finding (`PlatformWorkspaceResetPasswordDialog`)
>   was a prefix bug, not a defect: the gate only stripped `apps/tenant-web/src/`, so the file's existing
>   `DIRTY_EXEMPT` entry ("credential step-up; closing abandons the action") never matched. The strip now covers
>   both app prefixes, and `docs/forms-inventory.md` was regenerated.
> - **`check-frontend-structure` stays tenant-only for now** — it is the one gate whose allowlist is per-path:
>   extending it would mean encoding the platform copy's dead `tenant/**` barrels as reviewed exceptions. It
>   joins after the P11a prune.

### P11a — dead-source report (landed, report-only)

> The migration leaves superseded trees behind; nothing told us how much. Added
> `scripts/report-dead-sources.mjs` (`pnpm run report:dead-sources`, `--app <name>`, `--json`) — it walks the real
> import graph from `src/main.tsx` (`import … from`, bare `import "…"`, `import()`, `export … from`, `@/` and
> relative specifiers) and reports what the graph never reaches. Deliberately **not** a gate: the numbers are
> large while a tree is mid-deprecation, so it stays a report until a prune brings them to zero.
>
> Measured today:
>
> | App | Source files | Not routed by the app | Referenced by nothing (app nor tests) |
> |---|---|---|---|
> | `platform-web` | 2,425 | **2,016 (83 %)** — 1,256 of them `src/tenant/**` | 408 (17 %) |
> | `tenant-web` | 1,915 | 497 (26 %) | 466 (24 %) |
>
> So `apps/platform-web` still carries a full tenant-console copy that its app never routes (only 3 tenant files
> are in its graph) but its 1,008-file test suite exercises — tests of code the product does not ship. That is the
> blocker behind the structural-ratchet gap recorded in P3a/P10a: those gates are scoped to `tenant-web` because
> policing a tree slated for deletion would be noise. The order of work is therefore: prune the unrooted tree
> (and its tests) with this report as the checklist, then extend `check-frontend-structure` (P11b already extended
> `check-work-directory` and `check-form-architecture`).
>
> **Prune checklist (`--duplicates`).** The report can also prove redundancy by content, so a deletion does not have
> to be guessed: `pnpm run report:dead-sources --app platform-web --duplicates` hashes every unrouted file and looks
> for a byte-identical twin anywhere else in the repo. Today: **1,818 of platform-web's 2,016 unrouted files are
> exact copies** (safe to delete with their tests); **198 have no twin** — mostly `components/messageComposer/**`,
> i.e. copies that drifted from their tenant-web original — and need a reviewer's eye. `tenant-web` for comparison:
> 497 unrouted, 458 of them exact copies, 39 without a twin. The files are untouched by this round: the platform
> app was last edited ~2 h ago (its tree is idle) but a 2,000-file deletion is the owning migration's call, now
> backed by a verifiable list rather than a judgement.

### P10c — whole test surface green (landed)

> With the students extraction settled, the task is green end to end:
> - **tenant-web 772 files / 2,989 tests**, **platform-web 1,008 files / 3,694 tests** — 0 failed, 2 skipped each.
> - **All 15 module packages pass** (accounting 327+83, contacts 308+497, faculty 245+276, hasanat 107+80, iam 36+10,
>   messaging 69+125, students 262+257, billing 145+68, documents 6, notifications 1, workshops 10; audit,
>   examinations, obligations and question-bank backend-only) — the extracted suites moved with their code and run
>   through each package's `test` script (`vitest.backend.config.ts` + `vitest.frontend.config.ts`).
> - 18 gates, `verify:rules`, `test:scripts` (128) and both typechecks are green.
>
> Last seam fix: `queryInvalidationConformance.test.ts` binds `configureStudentsHost({ contactsCollection })` — the
> students invalidator delegates to the module host seam, so "a student write also refreshes the contact-derived
> caches" is now asserted through the real collection rather than a stub.

### P10b — suite stabilised against the extraction seams (landed)

> After the finance→`@mms/mod-billing` extraction settled, the tenant suite's remaining failures were the
> same *seam* class — tests mocking an app wrapper that the moved code no longer imports:
> - `useMessageComposerState.test.tsx` now mocks `@mms/mod-messaging/frontend/tenant/host/usePermissions`
>   (the hook lives in the module and reads the module host, so mocking `@/tenant/hooks/usePermissions` never
>   reached the gate).
> - `queryInvalidationConformance.test.ts` also binds `configureFinanceAccountingKeys(...)` (the app binds it
>   in `providers/BillingHostProvider.tsx`), so a finance write's ledger-cache invalidation is actually asserted.
> - `useMessaging.test.tsx`: its `@tanstack/react-query` mock now exposes `useMutation`.
> - `crossFeatureImports.test.ts`: the cross-feature case targets a *feature-internal* path again (module
>   packages are out of that rule's scope), and the baseline cases assert with containment so a changing
>   baseline cannot flip them; copied to platform-web.
> - Fixtures re-pruned (tenant-web 513 → 500).
>
> Two collection errors in one run (`ENOENT … node_modules/.vite`) were Vite dep-optimizer cache races from
> running Vitest concurrently with another process, not test failures — they pass on re-run.

### P10a — platform-web unit suite green (landed)

> The platform console's suite went from **36 real failures / 23 files** to **1,008 files / 3,694 tests, 0 failed**.
> Almost everything was one dead mock path:
> - **i18n mocks (69 files, ~15 tests):** components import `useTranslation` from `@mms/fe-core/i18n`, but tests
>   still mocked `@/hooks/useTranslation` — a shim **no app file imports**, so the mock never applied and
>   assertions saw raw keys (`platform.signIn`). Repointed to `@mms/fe-core/i18n` (the convention 413 platform
>   tests already used).
> - **`@/hooks/useIdleTimer` → `@mms/fe-core/hooks/useIdleTimer`** (session-timeout hook, 6 tests).
> - **`@/components/app/ModuleCommandMetricsGrid` → `@mms/fe-core/components/ModuleCommandMetricsGrid`**
>   (dashboard section-order test).
> - **Portal renders (4 tests):** two suites used `renderToStaticMarkup` on components that mount Radix
>   portals; converted to DOM rendering (`createRoot` + `act`), asserting on the document like
>   `calendarLocalization.test.tsx` does.
> - **Missing app infrastructure:** copied `eslint-rules/{no-cross-feature-imports,no-direct-api-client,no-physical-directional-classes}.cjs`
>   + their baseline JSONs into `apps/platform-web/eslint-rules/` (its config only loaded `@mms/eslint-config`,
>   so the app-local rules and their unit tests had nothing to run). Removed the duplicated
>   `themeInitPrelanguage.test.ts` — the platform `index.html` never references `public/theme-init.js` and the app
>   ships no `public/` assets; the counterpart test stays in tenant-web. **Follow-up for the platform owner:**
>   decide whether the apex console needs `public/` assets and pre-language theme init, and whether the
>   app-local ESLint rules should be hoisted into `@mms/eslint-config` instead of copied per app.
> - **Self-maintaining fixture:** the cross-feature baseline cases now *derive* their file and sanctioned
>   targets from `eslint-rules/feature-internal-imports-baseline.json` instead of hardcoding
>   `MessagingReportsVolumeChart.ts` — the concurrent pruning of that baseline had broken them twice in a row
>   (one entry, five targets today).
> - Fixtures re-pruned (tenant-web 525 → 513); both suites green.

### P9a — frontend unit-suite cleanup after the split (landed)

> The 8 files / 13 tests that the first full post-split run left red were all migration drift. Fixed at the
> test/fixture layer, keeping every assertion's intent:
> - **Stale paths:** `moduleWorkspaceDay.test.ts` now resolves surfaces app-relative *or* repo-relative
>   (the hasanat modals moved into `packages/modules/hasanat`); `formContractArchitecture.test.ts` scans
>   `apps/tenant-web/src/{tenant,components}` + `apps/platform-web/src/platform` (its `platform/` root had
>   moved apps).
> - **Fixtures:** `src/test/shard-timings.json` pruned in both apps (801 → 525 keys; the split and the faculty
>   extraction deleted the rest). Re-prune whenever files move — the sequencer only needs live keys.
> - **Test setup:** merged a duplicated `vi.mock("@mms/fe-core/backgroundJobs")` (the second call dropped
>   `patchLocalBackgroundJobOnly`); wrapped `ContactCreateModal` renders in `withQueryClient` and aligned two
>   assertions with current behaviour (sr-only refusal region, eagerly rendered form); bound the contacts
>   cross-module query keys in `queryInvalidationConformance.test.ts`; mounted `UiConfigProvider` in
>   `calendarLocalization.test.tsx` (the calendar reads `useUiConfig()`, not `useTranslation()`).
> - **Baselines:** `crossFeatureImports.test.ts` now exercises live baseline entries
>   (`MessagingReportsVolumeChart.ts`); the contacts bridge case is an out-of-scope module import now that
>   contacts left the app tree.
> - **Missing infrastructure (platform-web):** the app had **no `vitest.config.ts`**, so it ran with Vitest
>   defaults (node environment, no `@` alias, no setup) and failed every DOM test. Added one mirroring
>   tenant-web's (aliases, happy-dom, setup file, shard sequencer, optimizer) — coverage floors deliberately
>   deferred until the platform tree's baseline is measured.
>
> The residual suite red during this phase was the **in-flight faculty extraction** (`@mms/mod-faculty`
> frontend exports landed mid-run; 39 files failed to resolve until then) — not this cleanup.

### P8b — module host bridges out of the entry closure (landed)

> Fixes the regression P8a's lazy floor and FORBIDDEN rule exposed.
> `providers/AppProviders.tsx` (entry closure) statically imported `ContactsHostBridge` +
> `HasanatHostBridge`, which import `@/tenant/components/moduleReports`; that chunk (309K, 142 static
> imports) made **240 chunks / 3.36 MB** of the precache reachable only through it, including the
> forbidden `vendor-motion` (92K) and `vendor-charts` (524K).
> - **Move:** both bridges now mount in `providers/TenantScopedProviders.tsx` — inside the
>   tenant branch, wrapping `{children}` in the same order as before. That module is reached only through
>   the lazy `TenantRoutes` chunk, so nothing in the shell's static graph touches module report code.
>   Same reasoning `providers/MotionPreferences.tsx` already documented.
> - **Measured effect (fresh build):** precache entries **277 → 79**, entry closure **270 → 72**,
>   payload **3.93 MB → 2.25 MB** (-43 %), lazy chunks **324 → 529**; `vendor-motion`, `vendor-charts`
>   and `moduleReports` are absent from `sw.js`.
> - **Ratchets tightened, not relaxed:** closure ceiling 300 → **80**, payload 4.25 → **2.5 MB**, lazy
>   floor 300 → **450** (a re-eager-mount would drop lazy toward ~330 and fail). `check:pwa` and
>   `check:bundle` are green.
> - **Tests:** `TenantScopedProviders.test.tsx` mocks the two bridges as markers and now asserts they
>   mount on the tenant branch and stay absent on the apex render (3/3); providers + layout suites 27/27;
>   `pwa-precache-budget.test.mjs` 9/9; `test:scripts` 128/128.
> - **One intentional delta:** the tenant-web apex path no longer mounts them. The apex console lives in
>   `apps/platform-web`, which has no host bridges, and tenant-web renders no module pages outside the
>   tenant tree.

### P8a — PWA precache gate: split budgets + lazy floor (landed)

> The single "80 entries / 3.5 MB" cap conflated two populations and had gone stale after the split
> (measured 282 / 3.93 MB). It is now split, with the missing regression guard added:
> - **shell glob** ≤ 10 (measured 7) · **entry closure** ≤ 300 (measured ~270) · **payload** ≤ 4.25 MB
>   (measured 3.93) · **lazy-chunk floor** ≥ 300 (measured ~325 of ~590 chunks).
> - The floor is new and is the point: the old cap could only catch growth, never a *lazy-loading
>   regression*. It reads `dist/.vite/manifest.json` and BFSes the entry's static imports (same rule as
>   `entryClosurePrecache.ts`), failing closed when the manifest is missing.
> - Pure helpers (`classifyPrecacheEntries`, `countLazyChunks`, `evaluateBudgets`, `budgetsFromEnv`,
>   `parsePrecacheEntries`) are exported and covered by `scripts/ci/pwa-precache-budget.test.mjs`
>   (9 tests); `test:scripts` is 128/128.
>
> **What the new guard immediately caught (real, not a threshold slip):** the entry closure pulls
> `_moduleReports` (309K, 142 static imports) because `providers/AppProviders.tsx` statically imports
> `ContactsHostBridge` + `HasanatHostBridge`, and both import `@/tenant/components/moduleReports`. That
> chain drags `vendor-charts` (524K) and `vendor-motion` (92K) into the precache, so the `FORBIDDEN` rule
> fails on `vendor-motion`. The gate is therefore **red on an architecture finding**, not on its budgets:
> fix direction is to mount the host bridges below the entry closure (mirroring the documented
> `providers/MotionPreferences.tsx` pattern) or to resolve the reports tier through the module registry.
> Deliberately **not** re-baselined — weakening `FORBIDDEN` would hide exactly the regression class the
> gate exists to prevent.

### P3a — tooling/deploy migration off `apps/frontend` (landed)

> The app split landed (`apps/tenant-web` = live hybrid console still holding `tenant/` + `platform/`;
> `apps/platform-web` = 2-file placeholder). Tooling followed in one change:
> - **Runtime:** the SPA grew from one dist to two. P3a first pointed the old
>   `plugins/frontendSpa.ts` at `apps/tenant-web/dist` (it had built `…/frontend/dist` and **silently
>   skipped hosting**, so production would have 404'd). The concurrent platform migration then replaced it
>   with `plugins/registerWebApps.ts`, which serves `apps/platform-web/dist` on the apex and
>   `apps/tenant-web/dist` on tenant hosts — a superset of that fix.
> - **Deploy/packaging:** `package-dist.sh`, `deploy-on-server.sh`, `deploy-rollback.sh`, `deploy-verify.sh`
>   now use `apps/tenant-web/dist`.
> - **Gates:** scan roots and allowlists moved off `apps/frontend` in 15 scripts — including the two
>   **escaped-regex** forms my first pass missed (`/^apps\/frontend\/src\//` in `check-form-architecture`,
>   the `paymentFormHelpers` allow in `check-money-safety`), which is what had re-surfaced 3 money findings and
>   7 modal findings. `check-module-boundaries` now classifies `apps/tenant-web` as **hybrid** (it still hosts
>   `platform/` source) and `apps/platform-web` as platform.
> - **SSOT/codemod:** `PATHS.frontend` removed (no consumers), `codemod/move-modules` default srcRoot →
>   `apps/tenant-web/src`; CI glue (`lint-changed.sh`, `check-changed-coverage`) and the probe/fixture tests
>   updated. `verify-rules-integrity` already resolved `@/` against tenant-web.
> - **Docs:** 95 links repointed with per-link existence checks (64 `apps/frontend` → tenant-web, plus 31 the
>   concurrent examinations/obligations extractions left dangling) → `check:docs` green; the forms inventory was
>   regenerated (193 files) restoring `check:form-architecture`.
>
> **Layout moved again while P8a landed (recorded here so the notes above stay true):**
> `apps/platform-web` is no longer a placeholder — it carries ~1,354 files, including a `src/tenant/**`
> copy plus its own `src/platform/**`, and `apps/tenant-web` has dropped `src/platform`. Consequences:
> `check-module-boundaries` classifies **both** apps as hybrid (with per-app `tenant/`/`platform/` subtree
> locks) until the duplicated tenant tree is pruned from platform-web; and three structural ratchets
> (`check-frontend-structure`, `check-work-directory`, `check-form-architecture`) still scan only
> `tenant-web`, so those ~1,354 platform-web files are **not** covered by them (`check-code-norms` and
> `check-shared-structure` do cover both). Extending the structural ratchets to a second root is the
> explicit next item — it needs the platform app's intended tree shape settled first.
>
> **Still red, and not from this migration:** (a) `check:code-norms` — 54 explicit `any` sites in the
> concurrent `packages/modules/contacts/src/backend/**`; (b) `check:pwa-precache` — the tenant-web entry
> closure now measures **282 entries / 3.93 MB** against the reviewed 80 / 3.5 MB budget (vite config is
> byte-identical to the old frontend one, so this is real app growth, not a split regression — needs either
> chunk-splitting work or a reviewed re-baseline); (c) `check-topology` — `packages/modules/messaging` has no
> `package.json` yet (half-created by the concurrent extraction).

### P3 — Finish `@mms/mod-accounting` (depth 0)

- [ ] Delete the 37 backend shims and 4 service shims; move `accounting/ledgerPosting/*` (7 files incl.
      `obligationPostingService` 273 L, `ledgerPostingHelpers` 213 L, `ledgerReversalPostingService` 201 L)
      and `accounting/repository/*` (7 adapters) into the module behind `LedgerPostingPort` /
      `ObligationVoucherPort` / `FxRatePort`.
- [ ] Delete `apps/backend/src/accounting`; register accounting through its descriptor.
- [ ] Keep `moduleId: "accounting"`; `/api/accounting` stays until P7.

**Gates:** `check:accounting-coverage`, `check:accounting-route-injection`,
`check:accounting-route-security`, `moduleAccessCoverage.test.ts`, finance/accounting DB suites,
`check:contracts`, `check:money-safety`.

**Exit:** no file under `apps/backend/src/accounting` remains; module tests green; accounting route
inventory identical.

### P4 — Depth-0 leaves (10 modules)

**Order matters: `contacts` first** (it is the fan-in hub and must expose `ContactDirectoryPort` before any
dependent module moves), then `notifications`, `hasanat`, `audit`, `documents`, `workshops`,
`questionBank`, `integrations`, `platform`, `workspace`.

**Per-module recipe** (repeat for every module, in every wave):

1. `git mv apps/backend/src/<domain>/** → packages/modules/<slice>/src/backend/**`; its
   `db/repositories/<family>*.ts` → `src/backend/repository/**`; its `routes/tenant/<module>*` (+folder) →
   `src/backend/routes/**`; its domain services → `src/backend/services/**`; its job runners/imports →
   `src/backend/jobs/**`.
2. `git mv apps/frontend/src/tenant/features/<module>/** → src/frontend/tenant/**`; platform parts →
   `src/frontend/platform/**`; audience-neutral widgets → `src/frontend/components/**`; move its FE `lib/`
   and `hooks` groups.
3. Add `src/descriptor.ts` (`{ moduleId, beRoutes, feRoutes, access, jobRunners, moduleActionRules,
manifests }`) and the explicit `exports` map (`./shared`, `./backend/tenant`, `./backend/platform`,
   `./frontend/tenant`, `./frontend/platform`; **no root export**).
4. Replace every cross-module import with a **port** declared next to the consumer and implemented in
   `apps/api` (BE) or the app shell (FE).
5. Move the module's tests with it; update `check:tdd-pairing` `DOMAIN_RE`.
6. Update `scripts/check-module-boundaries.mjs` only for newly declared port edges.
7. Leave contract files in `packages/contracts` (D1).

**Module specifics:**

- `contacts` 42 backend files, 44 repositories, 9 route files, 324 FE files, plus `lib/contacts` (28),
  `components/contactLink` (8), `components/contact-action` (4); exports `ContactDirectoryPort`.
- `platform` 10 files + 23 platform routes + 5 repository adapters (contacts/messaging/accounting) →
  purpose-built ports.
- `workspace` 8 repositories + `workspace` route pair + `workspaceService`.
- `audit` 3 files + 4 route files; hash chain stays in `be-core/audit`.
- `documents` 2 files + the `templates` route (stays settings-gated, not a module grant).
- `notifications` 3 files + `notificationsRoutes` (own-permission inbox).

**Per-wave gates:** `check:module-boundaries`, `check:backend-boundaries`, `check:backend-structure`,
`check:form-architecture` (+ inventory), `check:shared-ui`, `check:work-directory`, `check:code-norms`,
module-access coverage, the wave's e2e specs.

**Exit:** `packages/be-core` contains no `@mms/mod-` import; apps import only declared audiences; the
module graph contains only the ports in §8; `pnpm build` green.

### P5 — Depth 1: `faculty`, `messaging`, `billing`

- `faculty` (35 files, 41 repositories, 221 FE files; `faculty → contacts` 6 → `ContactDirectoryPort`).
- `messaging` (4 files + 7 services, 7 repositories, 81 FE + 12 platform; `messaging → contacts` 1;
  keep the purpose-built recipient DTO of `mms-auth-security` §3).
- `billing`/`finance` (17 files, 18 repositories, 92 FE + 11 invoice-template lib files + `lib/templates`;
  `finance → accounting` 7 via `LedgerPostingPort`, `finance → contacts` 1 via the directory port).
- `tasks` (4 files, 10 repositories, 62 FE) moves here once `faculty` has landed, because
  `tasks → faculty` uses `lockFacultyHierarchy` (FacultyAssignmentPort) — it may also slip to P6.

**Gates:** wave gates + `check:faculty-domain`, `check:contracts`, `check:money-safety`,
`check:finance-contract-parity`, finance/messaging/faculty DB suites.

### P6 — Depth 2–3: academic SCC, then the rest

- [ ] **One wave, one PR train:** `students` (23/24/197), `enrollments` (31/23/128), `sessions`
      (30/34/138), `attendance` (33/23/164). Ports: `StudentDirectoryPort`, `EnrollmentLifecyclePort`,
      `TeacherSectionScopePort`, `AttendanceCalendarPort`, plus `NotificationPort` and `HasanatPort`.
      Keep bulk-enroll, rollover, leave and calendar-copy semantics identical (DB suites prove it).
- [ ] `examinations` (11/14+5/121) via `TeacherSectionScopePort`.
- [ ] `tasks` if not already moved (`FacultyAssignmentPort`).
- [ ] `iam`/`users` (11 + 7 routes + 7 services; 110 FE + 47 platform) via `FacultyRolePort`; wire or drop
      `@mms/mod-iam/frontend`.
- [ ] `analytics`: `dashboard` (3 repos, 10 services, 43 FE), `savedReports` (3/3), `reports` (57 FE +
      `lib/reports` 31 + `components/reports` 125 + `dashboard-widgets` 29); introduce the widget and report
      contribution registries (U10) to replace the 166 facade edges.

**Gates:** wave gates + `check:{session,enrollment,attendance,examinations,finance}-coverage`,
`check:examinations-*`, `check:obligations-*`, the full DB matrix, e2e for each module.

**Exit:** all 22 module packages exist; `packages/be-core/src` contains no module import; backend `src/`
holds only `apps/api` concerns (app/index/worker/config/compose).

### P7 — `apps/api` (depth 4)

- [ ] `git mv apps/backend apps/api`; rename `mms-backend → mms-api`; entries
      `src/{app,index,worker}.ts`.
- [ ] `apps/api/src/compose.ts` builds descriptors from `packages/modules/*`; `registerRoutes` mounts each
      module under `TENANT_ROUTE_PREFIXES[id]`.
- [ ] **Dual mount (D5/U15):** `packages/contracts/src/routing/apiPrefixes.ts` with
      `{ canonical: "/api/tenant/<m>", legacy: "/api/<m>" }`; mount both; strip `/api/v1/tenant/faculty`;
      emit `Deprecation` + `Sunset` on legacy paths.
- [ ] Update `MODULE_ROUTE_ACTION_RULES` (regEx), `MODULE_ROUTE_PREFIXES` and
      `EXPECTED_MODULE_ROUTE_ACTIONS` in the same commit; add both prefixes to the coverage test.
- [ ] Worker: `apps/api/src/worker/index.ts` imports `be-core/jobs` + module job runners.
- [ ] Update every literal from §2.6 (`package-dist.sh`, `deploy-*.sh`, `merge-backend-env.sh`,
      `admin-migrate-and-reload.sh`, `apply-production-host-isolation.sh`, `ecosystem.config.cjs`,
      `Dockerfile`, `docker-compose.yml`, `restart_servers.sh`, `verify-env.sh`, `guard-shell.sh`,
      `.githooks/pre-push`, `CODEOWNERS`, `local-ci.sh`, `lint-changed.sh`, e2e helpers, CI filters and
      report dirs, skill scripts that cite the old paths).
- [ ] `registerFrontendSpa` → `registerWebApps({ tenantDist, platformDist })`, with a temporary
      single-app fallback until P8.

**Gates:** openapi inventory = the §13 baseline + the tenant aliases exactly (new `check:routes-inventory`, promoted here from P0 because the route set only stabilises after the module waves);
`check:backend-*`; `test:db`/`test:rls`; full e2e local; `tar tzf` exact-content assertion; staging deploy
+ rollback rehearsal (first phase that changes every ops literal).

**Exit:** `apps/backend` is gone; the API boots from `apps/api`, serves both prefix families, and the
production tarball contains the expected paths.

### P8 — `apps/tenant-web` + `apps/platform-web` (depth 4)

**Create `apps/tenant-web`:** `index.html`, `main.tsx` (tenant boot, PWA registration, lazy locale packs),
`App.tsx`, tenant provider chain (Auth, Query, Branding, Tenant, Translation, UiConfig, Direction),
`tenant/{pages,components,hooks,routes}`, `index.css` (`@source` lines), `public/`, `postcss.config.js`,
`vite.config.ts` (same chunking/PWA/compression), `vitest.config.ts`, `components/ui` facade.

**Create `apps/platform-web`:** `index.html` (apex CSP, no SW), `main.tsx` (apex theme, EN-only),
`ApexRoutes`, `src/core` (`platform/auth` + `platform/shell`), `platform/{features,hooks,lib,routes}`, own
vite config; **no** `TranslationProvider`/`TenantProvider`.

- [ ] Delete `components/routing/HostRoutes.tsx` and `lib/routing/routePrefetch.ts`; each app mounts its
      own tree (U17).
- [ ] `lib/host` duplicated per app or inverted into an injected resolver (U9).
- [ ] `packages/be-core/src/web-apps.ts` serves the tenant dist on tenant hosts and the platform dist on the
      apex; deny-list `/api`, `/uploads`, `/health`; JSON 404 preserved; PWA only in the tenant dist; apex
      must not register a service worker (U18).
- [ ] e2e (U19): two `webServer` entries (tenant :5173, platform :5174), per-project `baseURL`, projects
      `tenant`/`platform`/`a11y`, seed helpers point at `apps/api`.
- [ ] CI: two build/test/lighthouse jobs + shard matrices; tarball adds both app dists; `check:bundle` and
      `check:pwa` per app; `check:{form-architecture,work-directory,shared-ui,frontend-structure}` rewritten
      for two src roots; `check-package-boundaries`/`check-web-app-isolation` added.
- [ ] Delete `apps/frontend` in the final PR of the phase (D11).

**Exit:** both apps build; one Fastify process serves them by host; tenant/platform/a11y e2e green; no file
in either app imports the other (ratchet retained); tarball contents verified; staging deploy + rollback
rehearsed.

### P9 — Final state and cleanup (depth 5)

- [x] Rewrite topology docs: `AGENTS.md` layout, `README.md`, `SYSTEM_ARCHITECTURE.md`,
      `docs/architecture.md`, `.cursor/rules/mms-structure-naming.mdc` §1 (then
      `bash .agent/scripts/sync-all.sh`), `mms-shared-ui.md` §1, `mms-migration-status.md` (closed
      milestone pointer), `docs/migration-milestones.md`, `CONTRIBUTING.md`,
      `.agent/skills/mms-dev-setup` + `verify-env.sh`.
      **Done 2026-11-27:** layout sections now describe `packages/modules/*` as the backend domain home
      and `apps/api` as kernel/composition; `README.md` and `docs/architecture.md` lost their
      pre-split `apps/frontend`/`apps/backend` names; rule mirrors synced and integrity green.
- [x] ADRs `019`–`022` (module descriptors/ports, additive tenant prefix, two web apps one API host, module
      package contents) and update `docs/README.md`.
      **Done 2026-11-27:** `docs/adr/019`–`022` landed with the index updated (commit `b338a7d2a`).
- [x] Permanent ratchets: `check:package-boundaries`, extended `check:module-boundaries`,
      `check:fe-core-boundaries`, `check:web-app-isolation`, `check:routes-inventory`.
      **`check-move-manifest` retired 2026-11-27** — the ledger was empty (0 entries), so the script, its
      test, the JSON manifest/schema, the `check:move-manifest` script and the `local-ci.sh` step were
      deleted; `check-topology` + `check-module-boundaries` + `scripts/ci/ci-path-filters.test.mjs` are the
      permanent ratchets that remain.
      **Coverage mapping (2026-11-27):** `check-package-boundaries` is implemented as
      `check:package-boundaries` (`scripts/check-package-boundaries.mjs`, wired into CI + `local-ci.sh`);
      `check-fe-core-boundaries` remains enforced by `check:core-packages` (per-package workspace import
      sets); `check-web-app-isolation` as `check:web-app-isolation` (baseline-frozen backlog, CI-wired);
      `check-routes-inventory` as `check:routes-inventory` (CI + `local-ci.sh`), with the module-access coverage test still asserting both mount prefixes; `check:module-exports` covers the audience-export contract.
- [x] Close the deprecation window: remove the legacy `/api/<module>` mounts and the `Deprecation`/`Sunset`
      headers; delete `apps/frontend`/`apps/backend` leftovers and obsolete `restart_servers.sh` branches.
      **Implemented 2026-11-27:** ADR-020 landed — `apps/api/src/compose.ts` mounts every module-owned
      tenant surface at both `/api/tenant/<module>` (canonical) and `/api/<module>` (legacy, carrying
      `Deprecation` + `Sunset: Wed, 31 Dec 2026 23:59:59 GMT`); the coverage test enumerates both mounts.
      Kernel/app-level tenant routes (auth, workspace, uploads, audit, notifications, documents,
      saved-reports, dashboard, module-access, background-jobs, ai, ws) keep their existing prefixes and
      are classified as non-module routes. No `apps/frontend`/`apps/backend` path remains outside `docs/`.
- [x] Archive the root audit reports (`CONTACTS_*.md`, `ACTION_COLUMN_REVIEW.md`, `SETTINGS_REVIEW.md`) into
      `docs/archive/` so the repo root holds only product and agent-standard docs.
      **Done 2026-11-27:** 13 files moved; `docs/archive/` is skipped by the docs index ratchet.
- [x] Regenerate `docs/forms-inventory.md`; update `CODEOWNERS`; cut the release
      (`mms-release-versioning`).
      **Done 2026-11-27:** inventory regenerated (96 form-like files), `CODEOWNERS` refreshed for the
      module/web-split topology, and the release recorded in `docs/migration-milestones.md` as a
      deployable `main` commit (no package version bump — the repo publishes nothing).

**Accepted legacy references (upgrade/rollback compatibility):** `scripts/deploy-rollback.sh` (legacy
tarball branch), `scripts/ci/remote/deploy.sh` (legacy env fallback), `scripts/deploy-on-server.sh`
(legacy `apps/backend` env/uploads migration), `scripts/lib/changed-files.mjs` (legacy path alias) and
`scripts/ci/topology.test.mjs` (transitional fixture) intentionally name the pre-split paths so an older
release can still be restored or upgraded. Product/source trees carry no `apps/frontend`/`apps/backend`
references outside historical comments.

**Exit:** final tree equals §4.2; `pnpm ci:local:full` green; every ratchet reports a non-zero scanned file
count; `rg "apps/(frontend|backend)" -g '!docs/**' -g '!*.md'` finds only the accepted legacy references above.

---

## 9. Cross-cutting mechanics

### 9.1 Move mechanics

- One checked-in map per phase: `scripts/migration/maps/p0.json` … `p9.json`, merged into
  `move-manifest.json`; each entry is `{ from, to, phase, status }`.
- `node scripts/codemod/move-modules.mjs <map.json> --src-root <root> [--ext-suffix none|js]
[--allow-cross-root] [--target-alias <@mms/x>] [--rewrite-only] [--dry-run]`.
- Never mix a move with a rename of the same file. Every phase PR body records the map, the gates run and
  the before/after inventory diff.

### 9.2 Alias policy after the split

| Alias                                  | Where                                    | Rule                                                              |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `@/…`                                  | `apps/tenant-web/src`, `apps/platform-web/src` | app-internal; banned inside `packages/**` (ratchet)         |
| `@mms/contracts`                       | everywhere                               | single contract import                                            |
| `@mms/db`                              | `apps/api`, module `backend`             | schema/client/context/migrations                                  |
| `@mms/be-core`                         | `apps/api`, module `backend`             | Fastify kernel, auth, audit, jobs, realtime                       |
| `@mms/fe-core`                         | web apps, module `frontend`              | runtime (non-UI)                                                  |
| `@mms/ui`                              | all React code                           | components; `@shared/ui` is **not** a specifier and must not exist |
| `@mms/mod-<slice>/{shared,backend/*,frontend/*}` | `apps/api`, web apps            | explicit audiences; never a root import                           |

### 9.3 Build graph and turbo

- BE packages: `build: tsc -p tsconfig.build.json` → `dist/`; `typecheck: tsc --noEmit`.
- FE packages: exports point at `src/`, `build` typechecks only (D7).
- Every package carries `build`/`typecheck`/`lint`/`test`; the three config packages are documented
  exempt and asserted once (so a missing script cannot silently skip a package).
- Read `docs/README.md` inside the resolved `turbo` package before editing `turbo.json` (repo rule).
- `db:migrate` belongs to `@mms/db`; the root script fans out through turbo.

### 9.4 Ratchet change matrix (who changes in which phase)

| Gate script                                                                                                                                          | Phases            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `check-backend-boundaries`, `check-backend-structure`, `check-db-projections`, `check-tdd-pairing`                                                     | P1, P4–P7         |
| `check-migration-hygiene`, `check-migration-indexes`, `check-migrations-forward-only`, `check:db-projections`                                          | P1                |
| `check-frontend-structure`, `check-shared-ui`, `check-work-directory`, `check-form-architecture`, `check-code-norms`                                    | P2, P4–P6, P8     |
| `check-shared-structure`, `check-money-safety`, `check-finance-contract-parity`, `check-faculty-domain`, `check:contracts`, `check:{module}-test-matrix`, `check:{module}-coverage` | P1, P3–P6 |
| `check-module-boundaries`, `ci/module-audience-boundaries.test.mjs`                                                                                     | P3–P6             |
| `check-bundle-budget`, `check-pwa-precache`, `lighthouserc*`                                                                                            | P8                |
| `check-docs`, `verify-rules-integrity`, `check-ratchet-baselines`, `check-standards-staged`                                                             | P9                |
| new: `check-move-manifest`, `check-topology` (landed in P0); `check-package-boundaries`, `check-fe-core-boundaries`, `check-web-app-isolation` (P1/P8); `check-routes-inventory` (P7, promoted from P0) | P0, P1, P7, P8 |

### 9.5 API prefix deprecation

One source: `packages/contracts/src/routing/apiPrefixes.ts`. Both mounts are registered from it, the
coverage test enumerates both, and legacy responses carry `Deprecation: true` + `Sunset: <date>`. The
window closes in P9 (or earlier if no external client depends on the legacy prefix — verify with access
logs first). **No `/v2`** (`mms-api-interface` §8).

### 9.6 Test placement after migration

| Test kind                                                   | Home                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Module unit/integration                                     | colocated in `packages/modules/<slice>/src/**`                        |
| DB integration / RLS / migration parity                     | `packages/db/tests/**` (`vitest.db.config.ts`, `vitest.rls.config.ts`) |
| API cross-cutting (module-access coverage, openapi, health)  | `apps/api/src/__tests__/**`                                           |
| FE repo-wide ratchets                                       | `packages/fe-core/tests/**` or `scripts/check-*.mjs`                  |
| Per-console behaviour                                       | colocated in `apps/*-web/src/**`                                      |
| E2E / axe                                                   | `e2e/tests/{tenant,platform,a11y,responsive,features}`                |

---

## 10. Risk register

| ID  | Risk                                                                                                   | Impact                              | Mitigation                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| R1  | A ratchet scans an empty/renamed dir and passes (`0 ≤ baseline`) while enforcing nothing                 | silent erosion of every invariant   | P0 fail-closed `assertNonEmpty` + CI assertion that each ratchet reported a non-zero file count |
| R2  | The deploy tarball keeps the previous `dist` because `tar` exited 0                                     | stale production build              | `check-tarball-contents.mjs` + deploy guard list + staging deploy per phase                    |
| R3  | A stale `paths-filter` makes a job skip and `ci-gate` accepts `skipped`                                 | false green                         | P0 dual-prefix filters; `ci-gate-policy` requires the new buckets                             |
| R4  | The three alias blocks drift after the split → two React copies                                        | bundle/runtime breakage             | one shared alias list; per-app `check:bundle`; Playwright smoke                                |
| R5  | Tailwind `@source` from a workspace package does not resolve                                           | missing utility classes             | per-app `@source` lines kept in app CSS (documented fallback)                                 |
| R6  | The `Modal` fork survives the split                                                                     | two component implementations forever | merge in P2, before the split (U8)                                                          |
| R7  | The apex registers the tenant service worker                                                           | stale apex shell                    | platform-web has no SW; `check:pwa-precache` scoped to the tenant dist                        |
| R8  | A module extraction smuggles `@mms/mod-* → @mms/mod-*`                                                  | recreates cycles                    | `check-module-boundaries` + ESLint boundaries, declared-port allowlist only                    |
| R9  | Dual-mounted prefixes drift (one updated, one forgotten)                                                | silent authz mismatch               | one `apiPrefixes` SSOT + coverage test enumerating both + deprecation headers                  |
| R10 | Merge conflicts during long phases                                                                      | schedule slip                        | phases sized to ≤2 days/PR; `move-manifest` detects partial moves; no long-lived branches       |
| R11 | Moving the migrations dir breaks the snapshot chain/journal                                             | `drizzle-kit generate` re-emits applied DDL | move SQL + `meta/` together; assert 277/277/99 before and after                        |
| R12 | `check:form-architecture` derives module keys from a path segment                                       | corrupted inventory                  | rewrite `moduleOf` to use package/module id in P2/P8                                          |
| R13 | i18n: platform ships all locale packs, or the tenant loses lazy packs                                    | bundle + UX regression               | per-app `fetchLanguagePack` wiring in P8; `check:i18n` unchanged                              |
| R14 | 739 backend test files split arbitrarily                                                                | lost coverage ownership              | §9.6 placement table applied per module                                                       |
| R15 | Cookie path / WS / Apache coupling                                                                      | auth or live-push outage             | `/api/auth`, `/ws`, `/api/ws` never move; Apache vhost untouched (D5/D6)                      |
| R16 | The in-flight migration is never reviewed and later work builds on unreviewed code                      | hidden regressions                   | P0 stabilization is the entry gate for every phase                                            |

---

## 11. Acceptance criteria (final state)

1. **Topology:** the tree matches §4.2; 22 module packages; a `check-topology` ratchet asserts exact
   top-level dirs and package names.
2. **Behaviour:** `/api/openapi.json` equals the P0 golden plus the `/api/tenant/*` aliases (legacy aliases
   only while the window is open); every existing module route answers identically on both prefixes.
3. **Data:** fresh-DB migrate from zero and migrate-on-existing both succeed; journal 277 entries; snapshot
   highest index unchanged; RLS suite green against `mms_app`; `drizzle-kit push` still banned.
4. **Gates:** `pnpm ci:local:full`, every `check:*`, `verify-rules-integrity`, `test:scripts`,
   `check:ratchet-baselines` green; **no ratchet reports zero scanned files**.
5. **Apps:** both SPAs build; one Fastify process serves the tenant dist on subdomains and the platform dist
   on the apex; tenant PWA precache within budget; platform ships EN only and registers no SW.
6. **E2E:** tenant, platform and a11y projects green; nightly suite green.
7. **Deploy:** `mms-dist.tar.gz` contains `apps/api/dist`, `apps/tenant-web/dist`, `apps/platform-web/dist`
   and every package `dist`; staging deploy, verify and rollback rehearsed.
8. **Independence:** `be-core` imports no module/app; `db` imports nothing above it; `fe-core`/`ui` import
   no app/module; no module imports another; neither web app imports the other.
9. **Docs:** `AGENTS.md`, `README.md`, `SYSTEM_ARCHITECTURE.md`, `docs/architecture.md`, the topology rule,
   ADRs 019–022 and `mms-migration-status` are updated; `docs/README.md` indexes this document.
10. **Zero new dependencies** and no `apps/(frontend|backend)` reference outside historical docs.

---

## 12. Assumptions and out of scope

- Two engineers can work the phases for their duration; waves are parallelisable across owners as long as
  one owner lands the descriptor and the port before a consumer moves.
- Production stays PM2 + Apache on `:5002`; no container migration.
- `apps/frontend`/`apps/backend` are not consumed by any external repository; only `@mms/*` names matter to
  in-repo consumers.
- Historical docs keep their old paths (they are records); only `docs/architecture.md`,
  `SYSTEM_ARCHITECTURE.md`, `README.md`, `CONTRIBUTING.md` and the rule text are rewritten.
- The `mms-migration-status` §1 debt (copy/a11y, live-push coverage, contacts full loads, finance
  `numeric(12,2)`) is **out of scope** and must not be opportunistically fixed during a move.
- If the two-app split proves risky at P8, the documented fallback is two PM2 apps behind the same vhost;
  the module/package structure is unaffected (D6).

---

## 13. Appendix — measured baseline and reproduction

**Snapshot discipline.** These numbers are a snapshot, not a contract. The working tree was being edited
concurrently while this document was measured, so counts drift between runs (during this audit `fe-core`
grew 257 → 274 files, `ci.yml` 1,269 → 1,274 lines, and the frontend facade count 323 → 329 within
minutes). Quote them with the measurement date, re-run the one-liners below before relying on a value, and
update this table in the same PR that changes a count. Structure and decisions (§4–§8) are the durable part.

| Fact                                                    | Value                                                                 | How measured                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Workspace projects                                      | 13 + root                                                            | resolve `apps/* packages/* packages/modules/* tooling/* e2e`        |
| `apps/backend/src`                                      | 2,271 `.ts` files (+10 `.sql`) / 294,295 LOC; 1,530 non-test; 143 shims (9.3 %) | `find … -name '*.ts' \| wc -l`, shim classifier (`export * from "@mms/…"`) |
| `apps/frontend/src`                                     | 4,261 `.ts`/`.tsx` (2,969 non-test); 329 pure facades (203 fe-core / 94 ui / 28 accounting / 4 contracts) | `find … \| wc -l`, facade classifier                            |
| `packages/*` sizes                                      | contracts 1,030 files; db 125; be-core 91; fe-core 274; ui 210; accounting 348; iam 28 | per-dir file/LOC counts                        |
| Backend tests                                           | 732 test files under `__tests__`; frontend 1,292 colocated tests       | `find … -name '*.test.ts(x)'`                                       |
| Route files / registrations                             | 207 (tenant 160, platform 23, common 23) + 23 accounting module files; 62 registrations | route-folder inventory + `app.register` count     |
| Module ids                                              | 17 `SYSTEM_MODULES`, aliases `enrollments→enrollment`, `examinations→examination`; 20 module route prefixes | `globalSettingsModuleRegistry.ts`, `moduleAccessPolicy.ts`, `moduleAccessCoverage.test.ts` |
| DB                                                      | 91 schema files, 12 relation files, 277 SQL, 277 journal entries, 99 snapshots, 97 RLS files, 77 TS data migrations (5 import services) | `find`, `_journal.json`, `grep -c 'ROW LEVEL SECURITY'` |
| Repositories                                            | 438 files, 42 families, 104 cross-family statements, 12 domain-guard imports | `ls \| wc -l`, prefix-family classifier, relative-import graph |
| Kernel coupling                                         | `lib↔services` 20/204, `lib↔db` 4/136, `services↔db` 86/67, `services↔worker` 6/21 | import-statement graph over `apps/backend/src` (`__tests__` excluded) |
| Domain coupling                                         | 20 pairs / 55 statements / 47 importer files; SCCs `{accounting, obligations}`, `{students, enrollments, sessions, attendance}` | same graph + Tarjan |
| Frontend coupling                                       | 0 tenant↔platform edges; 1 dual-console file; 166 feature→collections edges; 14/15/5 shared files → tenant; 118 platform feature edges | `@/` + relative import graph over `apps/frontend/src` |
| CI                                                      | 8 workflows / 25 jobs / 2,220 lines; `ci.yml` 1,274 lines / 17 jobs / 69 filter patterns / 27 `pnpm --filter` lines / 12 report dirs | `wc -l`, job awk, filter counter          |
| Deploy/ops literals                                     | 54 `apps/backend\|apps/frontend` lines in 15 files (+ package paths: 76) | `grep -nE 'apps/(backend\|frontend)'`                            |
| Gate scripts                                            | 41 `check-*` (6,177 lines) + 2 unit-test files + `verify-rules-integrity`; 8 vacuous, 2 coverage-loss | `ls scripts/check-*.mjs scripts/ci/check-*.mjs`, per-script scan-root audit |
| Forms / e2e / docs                                      | 223 form-like files / 78 FormModal files / 74 write surfaces; 28 e2e specs; 308 docs files | `docs/forms-inventory.md`, `find e2e/tests`, `find docs` |
| Working tree                                            | ≈6,900 changed/untracked paths against `edd92a58a` (6,897 at this audit) | `git status --porcelain \| wc -l`                                   |

Re-run the numbers with: `node scripts/check-docs.mjs`, the gate scripts named in §8, and the file/LOC
shell one-liners recorded in this table. Any phase that changes a number must update this table in the
same PR.
