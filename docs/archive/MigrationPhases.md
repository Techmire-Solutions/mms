```

> **Status note:** this is the historical phase plan. Per-phase completion
> status is NOT tracked here — the live Open Gaps Register lives in
> [`.agent/rules/mms-migration-status.md`](../.agent/rules/mms-migration-status.md)
> (synced to `.cursor/` and `.claude/`). Agents: trust the rule, not this file.
```
                                    MMS 10-PHASE MIGRATION TIMELINE
                                    
  [Phase 1] ──► [Phase 2] ──► [Phase 3] ──► [Phase 4] ──► [Phase 5]
  DB RLS        Shared        Fastify       Session       BullMQ Queue
  Isolation     Contracts     Handlers      Revocation    Infra
                                                               │
  [Phase 10] ◄── [Phase 9] ◄── [Phase 8] ◄── [Phase 7] ◄──────┘
  E2E / Ops      Scaffold      Logical CSS   Client Hooks  Typst BiDi
  Rollout        Rollout       & OKLCH       Migration     PDF Engine

```

---

### Phase 1: Database RLS Hardening & Scoped Tenant Context

**Objective**: Eliminate RLS leakage across pooled connections, enforce non-bypassable row-level policies at the PostgreSQL engine level, and isolate read-replica traffic.

#### 1. Execution Steps

* Create `apps/backend/src/db/tenant-context.ts` to encapsulate all tenant operations inside dedicated transactions executing `SELECT set_config('app.current_tenant', $1, true)`.
* Configure dual connection pools in `apps/backend/src/db/index.ts` (Primary Read/Write + Read Replica).
* Generate forward-only Drizzle DDL migration enforcing `FORCE ROW LEVEL SECURITY` and explicit RLS policies across all 18+ module tables.
* Refactor base repository methods to require `TenantTransaction` instead of the root database client.

#### 2. Code Artifact

```typescript
// apps/backend/src/db/tenant-context.ts
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db, readReplicaDb } from './index';
import * as schema from './schema';

export type TenantTransaction = NodePgDatabase<typeof schema>;

export async function withTenant<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: { readOnly?: boolean } = {}
): Promise<T> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('AUTH_TENANT_CONTEXT_MISSING: Invalid tenant scope');
  }
  const pool = options.readOnly ? readReplicaDb : db;

  return pool.transaction(async (tx) => {
    // Parameter 3 (is_local = true) ensures setting reverts when transaction completes
    await tx.execute(
      sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`
    );
    return callback(tx as unknown as TenantTransaction);
  });
}

```

#### 3. Verification Gate

* **Automated Test**: Run concurrent Vitest queries with alternating tenant IDs over a single pooled connection; confirm zero cross-tenant row contamination.
* **Database Assertion**: Execute `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace;` and verify all tenant tables return `true` for both columns.

---

### Phase 2: Zero-Trust DTOs, Trojan Unicode Sanitization & `@ts-rest` Contracts

**Objective**: Establish a typed schema repository in `@mms/shared` that cleans bidirectional text spoofing and defines end-to-end API contracts.

#### 1. Execution Steps

* Install `@ts-rest/core` into `packages/shared`.
* Implement a centralized Unicode sanitizer in `packages/shared/src/schemas/sanitize.ts` to strip non-printable directional override runes (`U+202A` through `U+202E`, `U+2066` through `U+2069`).
* Convert all write DTO schemas (`packages/shared/src/schemas/*.dto.ts`) to use `.strict()` mode with the sanitizer.
* Define contract routers for all modules in `packages/shared/src/contracts/` exporting a unified root contract router.

#### 2. Code Artifact

```typescript
// packages/shared/src/contracts/index.ts
import { initContract } from '@ts-rest/core';
import { studentContract } from './students.contract';
import { financeContract } from './finance.contract';
import { attendanceContract } from './attendance.contract';
import { contactsContract } from './contacts.contract';

const c = initContract();

export const rootContract = c.router({
  students: studentContract,
  finance: financeContract,
  attendance: attendanceContract,
  contacts: contactsContract,
  // Additional module routers
});

export type RootContract = typeof rootContract;

```

#### 3. Verification Gate

* **Typecheck**: Run `pnpm --filter @mms/shared typecheck` to verify zero compiler errors.
* **Sanitizer Unit Test**: Pass strings containing RTLO characters (`\u202E`); confirm they are cleanly stripped before validation schemas pass.

---

### Phase 3: Fastify Gateway Contract Integration & Route Migration

**Objective**: Replace ad-hoc Fastify route definitions with type-safe contract routers bound to `@ts-rest/fastify` and `fastify-type-provider-zod`.

#### 1. Execution Steps

* Install `@ts-rest/fastify` and `fastify-type-provider-zod` into `apps/backend`.
* Register the type provider and OpenAPI generator plugin in `apps/backend/src/app.ts`.
* Migrate feature routes in `apps/backend/src/routes/` from standard Fastify handlers to `initServer().router()` implementations.
* Wrap all route domain logic inside `withTenant(request.tenant.id, ...)` transactions.

#### 2. Route Migration Mapping

| Legacy Fastify Endpoint | New Contract Route | RLS Context Wrapper |
| --- | --- | --- |
| `fastify.get('/api/students', handler)` | `studentRouter.list` | `withTenant(tenantId, ..., { readOnly: true })` |
| `fastify.post('/api/students', handler)` | `studentRouter.create` | `withTenant(tenantId, ..., { readOnly: false })` |
| `fastify.post('/api/finance/invoices', handler)` | `financeRouter.createInvoice` | `withTenant(tenantId, ..., { readOnly: false })` |
| `fastify.get('/api/finance/reports', handler)` | `financeRouter.getLedgerSummary` | `withTenant(tenantId, ..., { readOnly: true })` |

#### 3. Verification Gate

* **Integration Tests**: Execute `app.inject()` suites across all routes to confirm that response payloads match contract status codes and schemas exactly.

---

### Phase 4: Enterprise Session Lifecycle, Redis Token Blocklist & CSRF

**Objective**: Upgrade authentication from un-revocable stateless JWTs to hybrid short-lived tokens backed by a Redis session registry and double-submit CSRF headers.

#### 1. Execution Steps

* Update Fastify authentication middleware to issue a 15-minute `access_token` and a 7-day high-entropy `refresh_token` in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
* Implement Redis-backed token revocation registry in `apps/backend/src/services/session.service.ts` keyed by `jti` (JWT ID).
* Add a global Fastify pre-handler enforcing double-submit CSRF validation (`X-CSRF-Token` header matching signed CSRF cookie) on all mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`).
* Add immediate tenant suspension hook: revoking tenant access in the platform console sets a Redis wildcard flag `tenant:blocked:<tenantId>` that halts all in-flight requests.

#### 2. Code Artifact

```typescript
// apps/backend/src/middleware/csrf-guard.ts
import { FastifyReply, FastifyRequest } from 'fastify';

export async function csrfGuard(request: FastifyRequest, reply: FastifyReply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

  const headerToken = request.headers['x-csrf-token'];
  const cookieToken = request.cookies['csrf_token'];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    reply.status(403).send({
      code: 'CSRF_VALIDATION_FAILED',
      message: 'Invalid or missing CSRF token',
    });
  }
}

```

#### 3. Verification Gate

* **Security Test**: Mutating request sent without `X-CSRF-Token` fails with HTTP 403.
* **Revocation Test**: Invalidate a user's session in Redis; subsequent API requests with existing JWT fail with HTTP 401 within $\le$ 100ms.

---

### Phase 5: Distributed Async Queue Infrastructure (BullMQ + Redis 7+)

**Objective**: Decouple intensive processes (document rendering, file exports, mass messaging) from the HTTP event loop into dedicated worker queues.

#### 1. Execution Steps

* Deploy Redis 7+ cluster/standalone via Docker Compose and production environments.
* Create queue definitions in `apps/backend/src/worker/queues/`:
* `pdf-rendering` (Concurrency: 4, Priority: 1)
* `bulk-export` (Concurrency: 2, Priority: 2)
* `messaging-broadcast` (Concurrency: 10, Priority: 3)


* Implement the background worker daemon in `apps/backend/src/worker/index.ts` with exponential backoff and dead-letter queue (DLQ) handlers.
* Bind the Fastify WebSocket gateway (`/api/ws`) to Redis Pub/Sub to push real-time job completion and progress updates to clients.

#### 2. Queue Lifecycle & Routing Diagram

```
[Client POST /api/v1/exports] ──► Fastify Gateway ──► BullMQ Enqueue (Job #402)
                                                             │
[Client UI] ◄── WebSocket Hub ◄── Redis Pub/Sub ◄── Progress & Status (0-100%)
                                                             │
                                                    Worker Execution
                                                             │
                                                    S3 Object Upload
                                                             │
[Signed Download URL] ◄── WebSocket Final Event ◄──── Completed

```

#### 3. Verification Gate

* **Queue Health**: Dispatch 50 concurrent mock jobs; confirm worker processes jobs without blocking Fastify HTTP request throughput (`/api/health` response stays $< 5\text{ms}$).

---

### Phase 6: Headless BiDi Document Engine & Streaming Exports

**Objective**: Eliminate client-side canvas PDF generation and replace memory-heavy spreadsheet exports with server-side streaming pipelines.

#### 1. Execution Steps

* Install **Typst** binary inside backend and worker container environments (`/usr/local/bin/typst`).
* Mount verified Nastaliq, Arabic, and Sans font assets (`Noto Nastaliq Urdu`, `Readex Pro`, `Geist`) into the font repository.
* Create parameterized Typst templates in `apps/backend/src/worker/templates/` (`report-card.typ`, `fee-receipt.typ`, `financial-ledger.typ`).
* Build `excel-export.ts` using `ExcelJS` streaming writers (`WorkbookWriter`) to pipe directly to S3 without loading large datasets into worker memory.

#### 2. Code Artifact

```typescript
// apps/backend/src/worker/processors/excel-export.ts
import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import { s3Client } from '../../config/storage';

export async function streamLedgerToS3(
  tenantId: string,
  filename: string,
  rowGenerator: AsyncGenerator<Record<string, unknown>>
): Promise<string> {
  const passThrough = new PassThrough();
  const s3Key = `tenants/${tenantId}/exports/${Date.now()}-${filename}.xlsx`;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: s3Key,
      Body: passThrough,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: passThrough });
  const worksheet = workbook.addWorksheet('Ledger');

  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Account', key: 'account', width: 25 },
    { header: 'Debit', key: 'debit', width: 15 },
    { header: 'Credit', key: 'credit', width: 15 },
  ];

  for await (const row of rowGenerator) {
    worksheet.addRow(row).commit();
  }

  worksheet.commit();
  await workbook.commit();
  await upload.done();

  return s3Key;
}

```

#### 3. Verification Gate

* **Visual Typographic Audit**: Generate an Urdu report card with composite ligatures; confirm that characters join without rendering boxes or baseline shifts.
* **Memory Test**: Stream an export containing 50,000 ledger rows; verify Node.js worker heap allocation remains $< 120\text{MB}$.

---

### Phase 7: Frontend Data Layer & Contract Client Migration

**Objective**: Deprecate manual `apiClient` requests and migrate all frontend components to `@ts-rest/react-query`.

#### 1. Execution Steps

* Initialize `@ts-rest/react-query` in `apps/frontend/src/lib/api.ts` utilizing the shared `rootContract`.
* Replace standard React Query hook definitions with contract-driven queries and mutations across all feature modules.
* Wire the centralized WebSocket client (`apps/frontend/src/lib/ws.ts`) to automatically update TanStack Query cache invalidations when background export jobs complete.

#### 2. Code Artifact

```tsx
// apps/frontend/src/tenant/students/hooks/useStudents.ts
import { tsrClient } from '@/lib/api';

export function useStudents(filters: { page: number; limit: number; search?: string }) {
  return tsrClient.students.list.useQuery({
    queryKey: ['students', filters],
    queryData: {
      query: {
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
      },
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateStudent() {
  const queryClient = tsrClient.useQueryClient();
  return tsrClient.students.create.useMutation({
    onSuccess: () => {
      queryClient.students.list.invalidateQueries();
    },
  });
}

```

#### 3. Verification Gate

* **Type Verification**: Attempt passing an invalid query property to `tsrClient.students.list.useQuery`; verify that TypeScript blocks the build during `pnpm typecheck`.

---

### Phase 8: Design System Logical CSS (Tailwind v4), OKLCH Tokens & BiDi Typography

**Objective**: Migrate UI primitives to Tailwind CSS v4 logical properties and configure multi-script typography stacks and OKLCH color palettes.

#### 1. Execution Steps

* Update `apps/frontend/src/index.css` with `@theme` configurations for OKLCH color tokens and font families (`Geist`, `Readex Pro`, `Noto Nastaliq Urdu`, `Vazirmatn`).
* Audit `apps/frontend/src/components/ui/` primitives and refactor all directional utility classes:
* `pl-*`, `pr-*` $\rightarrow$ `ps-*`, `pe-*`
* `ml-*`, `mr-*` $\rightarrow$ `ms-*`, `me-*`
* `left-*`, `right-*` $\rightarrow$ `inset-inline-start-*`, `inset-inline-end-*`
* `text-left`, `text-right` $\rightarrow$ `text-start`, `text-end`


* Implement the BiDi direction provider in `apps/frontend/src/providers/DirectionProvider.tsx` to automatically set `dir="rtl"` and `lang="ar|ur|fa"` on document roots.
* Deploy localized date formatters supporting synchronized Gregorian, Hijri (Umm al-Qura), and Solar Hijri calendars.

#### 2. Logical Migration Matrix

```
Physical Layout (LTR Hardcoded)            Logical BiDi Layout (RTL/LTR Dynamic)
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│ [Icon] pl-3         text-left   │  ───►  │ [Icon] ps-3        text-start   │
│ margin-right: 16px (mr-4)       │        │ margin-inline-end: 16px (me-4)  │
└─────────────────────────────────┘        └─────────────────────────────────┘

```

#### 3. Verification Gate

* **Linting Rule**: Configure custom ESLint / Stylelint rules banning `pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right` across `apps/frontend/src/`.

---

### Phase 9: Universal 3-Tier Module Scaffold (`Work` / `Reports` / `Setup`) Rollout

**Objective**: Standardize all 18+ tenant modules under the unified `<ModuleScaffold/>` layout contract, FilterToolbar, and keyboard shortcut engine.

#### 1. Execution Steps

* Build the reusable layout primitives in `apps/frontend/src/components/common/`:
* `<ModuleScaffold/>` (Header, Breadcrumb, Tier Tabs, Metrics Grid)
* `<FilterToolbar/>` (Debounced search, filter facets, view switcher)
* `<DetailSheet/>` (Radix UI slide-over drawer from inline-end)
* `<BulkActionDock/>` (Fixed selection dock with hotkey listeners)


* Refactor all 18+ modules sequentially to follow the Work, Reports, and Setup tab separation:

```
apps/frontend/src/tenant/
├── students/    ──► [Work: StudentDirectory]   [Reports: StudentKPIs]   [Setup: CustomFields]
├── finance/     ──► [Work: InvoicesLedger]    [Reports: BalanceSheet]  [Setup: FeeStructures]
├── attendance/  ──► [Work: DailyAttendance]   [Reports: MonthlyTrends] [Setup: ShiftSchedules]
└── ... remaining modules

```

* Integrate the global keyboard shortcut hook `useModuleShortcuts` across all modules.

#### 2. Verification Gate

* **UI Consistency Audit**: Check every module in mobile (375px), tablet (768px), and desktop (1440px) viewports to verify that the tier tabs, filter toolbar, and drawers render without layout shifts.

---

### Phase 10: End-to-End Testing, OpenTelemetry Tracing & Zero-Downtime Deployment

**Objective**: Validate platform stability via Playwright BiDi suites, deploy distributed tracing, and execute zero-downtime deployment.

#### 1. Execution Steps

* Write Playwright E2E suites (`e2e/specs/`) covering critical paths across both LTR and RTL directions:
* Admissions $\rightarrow$ Enrollment lifecycle
* Fee invoice creation $\rightarrow$ Payment settlement $\rightarrow$ Double-entry ledger verification
* Report card generation $\rightarrow$ Typst background job $\rightarrow$ PDF download


* Instrument OpenTelemetry in `apps/backend/src/config/telemetry.ts` to trace HTTP requests down through Drizzle SQL transactions and BullMQ worker jobs.
* Execute blue/green deployment strategy on production infrastructure (e.g., Hetzner VPS / Kubernetes).

#### 2. Migration Execution Checklist

| Phase | Milestone Name | Primary Risk | Mitigation | Status |
| --- | --- | --- | --- | --- |
| **Phase 1** | Database RLS Hardening | Connection pool RLS leak | Enforce `withTenant` transaction wrapper | Completed |
| **Phase 2** | Shared `@ts-rest` Contracts | Schema type mismatch | Run strict monorepo typecheck | Completed |
| **Phase 3** | Fastify Route Migration | Route signature regressions | Contract-backed Fastify inject tests | Completed |
| **Phase 4** | Redis Session & CSRF | User session dropouts | Graceful JWT fallback during cutover | Completed |
| **Phase 5** | BullMQ Task Subsystem | Redis connection failures | Exponential backoff and DLQ alerting | Completed |
| **Phase 6** | Typst BiDi Engine | Missing font ligatures | Mount pre-compiled font bundles | Completed |
| **Phase 7** | Frontend Contract Hooks | Stale client cache | Targeted React Query invalidations | Completed |
| **Phase 8** | Logical CSS & OKLCH | Visual layout breakage | Automated Playwright visual diffs | Completed |
| **Phase 9** | Universal Scaffold | Inconsistent module state | Enforce `<ModuleScaffold/>` prop contract | Completed |
| **Phase 10** | E2E & Production Deploy | Downtime during migration | Blue/Green cutover with DB forward DDL | Completed |

#### 3. Verification Gate

* **CI Suite**: All Vitest unit tests, Playwright BiDi tests, and TypeScript compiler checks pass with zero warnings across all workspaces.
* **Production Validation**: Execute `./scripts/verify-tenant-hosts.sh` and ensure sub-second response times on health checks across all provisioned institutions.