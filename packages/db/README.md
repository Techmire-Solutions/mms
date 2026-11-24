# `@mms/db`

The MMS data layer: one package for the Drizzle schema, forward-only DDL
migrations, seed fixtures, soft-delete helpers, and the tenant-scoped database
client.

## Entry points

| Import                | Contents                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| `@mms/db`             | Client + context + scope + runtime registrations + migration runner                   |
| `@mms/db/schema`      | Drizzle tables/relations barrel (`@mms/db/schema/<file>` for a single domain)         |
| `@mms/db/client`      | Pool, root/tenant handles, transactions, prepared statements, RLS role guard          |
| `@mms/db/context`     | Request tenant/user storage, `withTenant` / `withTenantRead` / `withGlobalTenant`     |
| `@mms/db/soft-delete` | Soft-delete query helpers (mms-data-layer §6)                                         |
| `@mms/db/migrations`  | `applyDrizzleMigrations()`, `resolveMigrationsFolder()`, concurrent index maintenance |
| `@mms/db/seed`        | Minimal in-code seed + optional `seeds/seeds.json` fixtures                           |
| `@mms/db/testing`     | Test-only resets, audit-sink registration, scope assertions                           |

## Tenant isolation contract

**Default: fail closed.** Every tenant-scoped transaction resolves its tenant
through `resolveTenantScope()`, which throws when the tenant is missing, empty, or
the literal `"undefined"`/`"null"`. The transaction then sets the PostgreSQL RLS
GUCs (`SET LOCAL app.current_tenant`, `app.current_user_id`) so `FORCE ROW LEVEL
SECURITY` policies apply.

```ts
import { withTenant } from "@mms/db/context";

await withTenant(tenant, async (tx) => tx.select()...); // RLS-scoped
```

### Platform bypass (audited)

Only platform-level services may leave the tenant scope, and only through the
explicit wrapper. It audits **every invocation** (a `started` event before the
callback and a `completed` event with outcome/duration after):

```ts
import { bypassTenantScope } from "@mms/db";

await bypassTenantScope(
  { reason: "workspace provisioning", actorId: platformUserId, auditMeta: { workspaceId } },
  () => provisionWorkspace(),
);
```

Contract:

- `reason` and `actorId` are required and non-empty; a blank value throws before
  anything runs (an unauditable bypass is not allowed).
- Nesting throws — a second bypass must not mask the first audit record.
- The always-on sink writes a structured `warn` through the data-layer logger
  containing the full `tenant_scope.bypassed` event (actor, reason, metadata,
  timings). Platform services may register an additional sink (for example an
  audit-trail writer) with `registerTenantScopeBypassSink()`; **a failing sink
  aborts the bypass** (fail closed).
- `runWithGlobalTenantScope()` remains for already-applied forward-only data
  migrations only; new code uses `bypassTenantScope()`.

## Runtime seams

The package never imports the app. The app hands over its runtime at boot:

```ts
import {
  configureDbConfig,
  setDbLogger,
  setDbTracer,
  setServiceUnavailableErrorFactory,
} from "@mms/db";
```

Without these registrations the package still works (env-based config, its own
redacted pino logger, no-op tracer, local 503 error). `apps/backend/src/db/database.ts`
registers the validated server config, and `@mms/be-core/logger` /
`@mms/be-core/telemetry` / `@mms/be-core/http/errors` register the pino logger, the
tracer and the `HttpDomainError` 503 class.

## Migrations

- DDL lives in [`migrations_drizzle/`](./migrations_drizzle) (277 forward-only SQL
  migrations + `meta/` journal/snapshots).
- `drizzle.config.ts` in this package is the single drizzle-kit config
  (`schema: ./src/schema.ts`, `out: ./migrations_drizzle`).
- The legacy TypeScript **data backfills** intentionally stay in
  `apps/backend/src/db/migrations/`: they drive repositories and platform services
  that have not moved yet. The DDL runner and the CONCURRENTLY-only index
  maintenance live here (`@mms/db/migrations`).
- Never `drizzle-kit push` (mms-data-layer §7).

## Tests

`pnpm test` covers the package-owned guarantees: the fail-closed tenant-scope
guard, the audited `bypassTenantScope` lifecycle, and the migration runner.
Real-Postgres DB and RLS suites live in `apps/backend/src/__tests__/{db-integration,rls}`
and import the package entry points directly (`@mms/db/client`, `@mms/db/context`,
`@mms/db/schema`, `@mms/db/migrations`) — never the app-local `db/dbInit` facade.
They run in CI (`test-backend-db`, `test-backend-rls`) and locally via
`pnpm --filter mms-backend test:db` / `test:rls` against a provisioned database.

## Fixtures

`seeds/seeds.json` (+ `.gz`) are optional demo data and are **gitignored**. The
minimal seed (`@mms/db/seed`) is always available so a fresh database can boot.
