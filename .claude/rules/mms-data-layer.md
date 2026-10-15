---
description: PostgreSQL database, Drizzle schema, migrations, transactions, and TanStack Query state authority
paths:
  - "apps/backend/src/db/**"
  - "apps/backend/drizzle.config.ts"
  - "apps/backend/src/db/migrations/**"
  - "apps/backend/src/db/migrations_drizzle/**"
  - "apps/backend/src/worker/**"
  - "apps/backend/src/lib/redis.ts"
  - "apps/backend/src/routes/common/db.ts"
  - "apps/backend/src/services/dbSyncService.ts"
  - "apps/backend/src/lib/tenantContext.ts"
  - "apps/frontend/src/lib/db.ts"
  - "apps/frontend/src/lib/queryClient.ts"
  - "packages/shared/src/**/apiSchemas.ts"
---

# MMS Data Layer & Caching System

**Workflow skills:** REST Query factories → `mms-query-factories` · Drizzle DDL/RLS/Schema → `mms-schema-migrate` · backend API → `mms-backend-api` · shared package → `mms-shared-package` · legacy `/api/db` → `mms-data-sync` · backup wipe → `mms-backup-restore` · audit trail → `mms-audit-trail` · soft-delete → `mms-soft-delete`.

## 1. Normalization, Multi-Tenancy & Drizzle Schema Standards
1. **Normalization:** Strict 3NF/BCNF. Dedicated typed columns only; zero semi-structured storage (`json`/`array`) for domain fields. Zero EAV tables.
2. **Tenant Isolation:** Mandatory `tenantId: uuid("tenant_id")` or `workspaceSubdomain`. Composite uniqueness must include tenant scope (`UNIQUE(tenant_id, ...)`). New tenant tables require `FORCE ROW LEVEL SECURITY`.
3. **Data Typing:** Sequential **UUIDv7** (`crypto.randomUUIDv7()`) for primary keys; `timestamptz` defaulting to `now()`; `varchar({ length: N })` for bounded fields; PostgreSQL `pgEnum` for state machines.
4. **Indexing Invariants:** Every FK requires an explicit B-Tree index. Compound indexes match query pattern left-to-right (`tenant_id, status, created_at DESC`).
5. **Drizzle Guidelines:** Every `pgTable` exports `$inferSelect`, `$inferInsert`, and bidirectional `relations(...)`.
6. **Shared Zod Contracts:** Strict Zod schemas (`.strict()`) in `packages/shared/src/schemas/*` matching Drizzle tables 1:1.
7. **Deliverable Trinity:** Entity changes require (1) Drizzle table + relations, (2) Shared Zod DTOs, (3) Forward-only SQL migration.
8. **Faculty Domain:** `faculty` links personal identity through `contacts`; `faculty_departments`, `faculty_designations`, and `faculty_assignments` own organization and dated roles. Preserve existing text/composite tenant keys through the teacher migration chain. Serialize assignment and department hierarchy mutations per workspace; validate primary date overlap in the same transaction as the write (no unique-primary index). Reporting CTEs emit a cycle marker and stop at a validated depth limit. Enforced by `facultyAssignmentValidation.test.ts`, `facultyAppointmentsDb.integration.test.ts`, and `facultyContactSqlSsot.test.ts`.

## 2. Database & ORM Architecture (PostgreSQL + Drizzle)
1. **Connection Pools:** Persistent pool (`PG_POOL_MAX=20`). Partitioned pools: workers (`max: 10`), API (`max: 20–30`). Node 24 `using`/`await using` for cleanup.
2. **Transaction RLS:** Execute tenant queries inside `withTenant` executing `SET LOCAL app.current_tenant = :tenant_id` within explicit transaction blocks.
3. **Tenant Boundary API (`tenantContext.ts`):** `withTenant` (read-write RLS), `withTenantRead` (replica; ban for read-your-writes), `withGlobalTenant` (migrations/workers/seeding).
4. **Query Performance:** Zero N+1 loops (batch via relational `with:` or `inArray` <= 500). Zero wildcard projections (`SELECT *` ban; specify columns). Prepared statements on hot point lookups.
5. **SQL Safety:** Parameterized `sql` tagged templates only; ban `sql.raw` and string concatenation.
6. **Clean Architecture:** Route → Use Case (DI) → Repository Interface → Drizzle Adapter. Route files must never import `db/repositories` or `drizzle-orm` directly.
7. **Backup & Wipe-Restore:** `GET /backup` takes encrypted AES-GCM snapshot. `POST /sync` executes atomic wipe-restore under `withSyncTimeout`. Validate backup envelope before wipe.

## 3. Client Persistence (`db.ts` [DEPRECATED])
1. **Legacy Settings Only:** `db.ts` is restricted to non-migrated settings singletons (`branding`, `global_settings`). Event: `local-database-update`.
2. **REST Entities Ban:** Primary entities (Contacts, Students, Faculty, Finance) must use Query/REST, never `getCollection` or `saveCollection`.

## 4. TanStack Query v5 (Server-Authoritative REST)
1. **Client Defaults:** Tiered stale-times, 24h gcTime, focus refetch off, reconnect on, retries bounded (exclude 401/403/404) in `apps/frontend/src/lib/queryClient.ts`.
2. **Query Factories:** Stable tuple keys via colocated `queryOptions` / `mutationOptions` factories or `tsr` client.
3. **Auth Gate & Signal:** `enabled: isAuthenticated`. Pass Query `signal` to `apiFetch` (mandatory).
4. **Mutations & Cache:** Call-site `notify.*` + `t()` after `mutateAsync`. Await mutation before dialog close. Invalidate specific list/count tuple keys.
5. **Optimistic Policy:** Only for idempotent actions with undo. Ban for money, bulk ops, messaging. Single-record soft-delete uses 5–10s Undo toast.
6. **Live WebSockets:** `/api/ws` with `broadcastTenantUpdate` invalidates Query tuple keys on server events.

## 5. Modern Database Audit Trail & Cryptographic Integrity
1. **Five-Dimension Capture:** Who (`real_user_id`), What (`table_name`, `record_id`, `old_state`, `new_state`), When (UTC microsecond), Why (`correlation_id` / traceparent, `action_type`), Integrity (`hash_previous`, `hash_current`).
2. **RFC 8785 Canonical JSON (JCS):** Payloads and state hashing MUST use RFC 8785 for deterministic representation.
3. **Capture Minimization:** Capture point-in-time state reconstruction only; never log raw PII or secrets.
4. **Outbox Pattern:** Audit events write atomically inside `withTenant` transaction alongside entity mutation.
5. **Cryptographic Chaining:** SHA-256 via native `node:crypto`. Shard hash chains per tenant/domain; roll heads into periodic Merkle roots.
6. **Revoked Privileges:** DB user has `INSERT`-only on audit tables (`UPDATE`/`DELETE` revoked).
7. **Right-to-Erasure:** Crypto-shredding (destroy subject key) or redact-and-append (`[REDACTED_PER_REQUEST]`). Never rewrite historical rows.
8. **Partition Archival:** Monthly date partitions (`PARTITION BY RANGE`). Archive via partition detachment (`ALTER TABLE ... DETACH PARTITION`).

## 6. Authoritative Soft-Delete Architecture & Index Strategy
1. **Deletion Taxonomy:** Bucket 1: Soft-delete (primary entities, self-service restore); Bucket 2: Ephemeral hard-delete (drafts, join edges); Bucket 3: TTL sweeper purge (logs, sessions); Bucket 4: Append-only immutable (audit, accounting).
2. **Column Sextuple:** Standard `softDeleteColumns`: `deletedAt`, `deletedBy`, `deletionReason`, `restoredAt`, `restoredBy`, `deletedWithCascade`. Always assign `new Date()`.
3. **Three-Tier Indexing:** Category A `(workspaceSubdomain, deletedAt)`; Category B `(workspaceSubdomain) WHERE deleted_at IS NULL`; Category C `(workspaceSubdomain, deletedAt) WHERE deleted_at IS NOT NULL`. DDL autovacuum: `autovacuum_vacuum_scale_factor = 0.05`.
4. **Partial Unique Indexes:** Recyclable unique identifiers (`email`, `phone`, `student_id`, slug) MUST use partial unique indexes scoped `WHERE deleted_at IS NULL`.
5. **Hard-Delete Guard:** Schema `BEFORE DELETE` triggers invoke `forbid_hard_delete()`. Bypass requires `SET LOCAL app.allow_hard_purge = 'true'`.
6. **Dynamic AST:** Ban `WHERE ($2 IS TRUE OR deleted_at IS NULL)`. Append `isNull(table.deletedAt)` in Drizzle AST for active reads.
7. **Relational Child Filtering:** Drizzle `with: { ... }` must explicitly declare `where: (c, { isNull }) => isNull(c.deletedAt)`.
8. **Referential Integrity & Cascades:** Restrict soft-delete if active dependent children exist (`409 Conflict`). Cascade marks children `deletedWithCascade = true` under `FOR UPDATE`.
9. **Single-Statement Bulk Updates:** `bulkDeleteFn` and `bulkRestoreFn` execute a single batched SQL `UPDATE ... WHERE id IN (...) AND deleted_at IS NULL`. N+1 loops are banned.
10. **Uniqueness on Restore & Viewer Sanitization:** Pre-validate active uniqueness conflicts in domain use cases and translate to HTTP 400 (`type: 'validation_error'`) with structured field errors via `mapRestoreError`; trap concurrent race-condition DB error `23505` (`unique_violation`) and map to `409 Conflict`. Sanitize restored entity payload for the caller via `buildRestoreResponse` (`sanitizeOneForUser`).
11. **Lock-Free Chunked Purge:** Purge worker deletes in chunks of 500 rows using `LIMIT 500 FOR UPDATE SKIP LOCKED` with 50ms pauses and `SET LOCAL app.allow_hard_purge = 'true'`.

## 7. Migration Safety & Zero-Downtime DDL
1. **No Write-Blocking Index Builds:** Plain `CREATE INDEX` on live tables is banned. Build out-of-band via `index:concurrent`, or use `CREATE INDEX IF NOT EXISTS` for small/new tables (enforced by `check:migration-indexes`).
2. **No CONCURRENTLY in Transaction:** Drizzle migrations run inside transactions; execute concurrent index builds via standalone scripts.
3. **Lock Timeout Guard:** Populated `ALTER TABLE` must set `SET LOCAL lock_timeout = '2s'`.
4. **Expand / Contract:** Add column, backfill in batches, switch reads, then drop old shape in subsequent migration.
5. **Additive Defaults:** `NOT NULL` requires default value or two-phase backfill.
6. **Forward-Only:** Schema migrations are forward-only; data backfills must be idempotent and resumable.
7. **Ban `drizzle-kit push`:** Push is strictly banned against shared/staging/production databases.

## 8. Business Dates & Timezone Semantics
1. **Instants:** Always `timestamptz`. Never store naive local times for instants.
2. **Calendar Days:** Store as `date` or `varchar(10)` `YYYY-MM-DD` in tenant timezone. Never truncate UTC `timestamptz`.
3. **Authority:** Tenant workspace timezone is the authority for business dates; server resolves write dates.
4. **Formatting:** Render via `@mms/shared` (`formatDate`, `formatMoney`).
5. **DST Safety:** Derive day boundaries from calendar date in tenant timezone, not `+ 24h`.
6. **Filter Alignment:** Range filters must match storage representation (date vs instant).
7. **Calendar Policy:** Stored data is Gregorian; Hijri/lunar display is a derived presentation layer.

