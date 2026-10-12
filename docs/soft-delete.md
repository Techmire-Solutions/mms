# MMS Soft-Delete System

**SSOT documentation for the soft-delete architecture across the entire MMS monorepo.**

> Related skill: `mms-module-work` · Related rules: `mms-module-architecture.md §6-§7`, `mms-data-layer.md`, `mms-migration-status.md`

---

## Table of Contents

1. [Philosophy & Core Invariants](#1-philosophy--core-invariants)
2. [Database Schema Layer](#2-database-schema-layer)
   - 2.1 [Column Quintuple (Metadata Standard)](#21-column-quintuple-metadata-standard)
   - 2.2 [Referential Integrity: Cascades vs Restrict](#22-referential-integrity-cascades-vs-restrict)
   - 2.3 [Index Strategy](#23-index-strategy)
   - 2.4 [Partial Unique Indexes — Soft-Delete Aware Uniqueness](#24-partial-unique-indexes--soft-delete-aware-uniqueness)
   - 2.5 [Schema-Level Safety Guard: PostgreSQL BEFORE DELETE Trigger](#25-schema-level-safety-guard-postgresql-before-delete-trigger)
   - 2.6 [Row-Level Security (RLS) Policy Specification](#26-row-level-security-rls-policy-specification)
   - 2.7 [Query Planner Optimization: Static vs Dynamic Predicates & Relational Guardrails](#27-query-planner-optimization-static-vs-dynamic-predicates--relational-guardrails)
   - 2.8 [PostgreSQL 15+ NULLS NOT DISTINCT vs Partial Unique Indexes](#28-postgresql-15-nulls-not-distinct-vs-partial-unique-indexes)
   - 2.9 [Covered Entity Tables](#29-covered-entity-tables)
   - 2.10 [PostgreSQL HOT Updates, Partial Index Eviction & Autovacuum Tuning](#210-postgresql-hot-updates-partial-index-eviction--autovacuum-tuning)
3. [`@mms/shared` — Types, DTOs, and Helpers](#3-mmsshared--types-dtos-and-helpers)
4. [Backend Route Factories](#4-backend-route-factories)
   - 4.1 [`registerResourceRoutes` — Per-Entity CRUD + Soft-Delete](#41-registerresourceroutes--per-entity-crud--soft-delete)
   - 4.2 [`registerSoftDeletableBulkTrashRoutes` — Bulk Delete + Bulk Restore](#42-registersoftdeletablebulktrashroutes--bulk-delete--bulk-restore)
   - 4.3 [`handleBulkListGet` — Unified includeDeleted List Handler](#43-handlebulklistget--unified-includedeleted-list-handler)
   - 4.4 [Dedicated Soft-Delete Route Files (Gold-Standard Modules)](#44-dedicated-soft-delete-route-files-gold-standard-modules)
   - 4.5 [Uniqueness-on-Restore Contract & Error 23505 Trap](#45-uniqueness-on-restore-contract--error-23505-trap)
   - 4.6 [Parent Deletion vs Child Insertion Race (Orphan Guard)](#46-parent-deletion-vs-child-insertion-race-orphan-guard)
   - 4.7 [Single-Record Read Semantics (GET /:id on Archived Records)](#47-single-record-read-semantics-get-id-on-archived-records)
5. [Module Manifest — `softDelete` Block](#5-module-manifest--softdelete-block)
6. [RBAC Gating](#6-rbac-gating)
7. [Frontend UX Layer](#7-frontend-ux-layer)
   - 7.1 [`viewingDeleted` State & URL Search Param Synchronization](#71-viewingdeleted-state--url-search-param-synchronization)
   - 7.2 [`ModuleTrashToggle` — Shared UI Primitive](#72-moduletrashtoggle--shared-ui-primitive)
   - 7.3 [Bulk Actions — `BulkSelectionDeleteAction` / `BulkSelectionRestoreAction`](#73-bulk-actions--bulkselectiondeleteaction--bulkselectionrestoreaction)
   - 7.4 [Detail Drawer — `ArchivedBanner` + `WarningCallout`](#74-detail-drawer--archivedbanner--warningcallout)
   - 7.5 [Work Toolbar — Hiding Add/Create in Trash Mode](#75-work-toolbar--hiding-addcreate-in-trash-mode)
   - 7.6 [Export Actions in Trash Mode](#76-export-actions-in-trash-mode)
   - 7.7 [Keyboard Shortcut Guard](#77-keyboard-shortcut-guard)
   - 7.8 [Optimistic Soft-Delete with Undo Toast (5–10s Grace Window)](#78-optimistic-soft-delete-with-undo-toast-510s-grace-window)
   - 7.9 [Retention Expiry Countdown Badge](#79-retention-expiry-countdown-badge)
   - 7.10 [Search & Filter State Preservation Across Trash Toggle](#710-search--filter-state-preservation-across-trash-toggle)
8. [Audit Trail & Outbox Integration](#8-audit-trail--outbox-integration)
9. [Anti-Patterns](#9-anti-patterns)
10. [Architectural Deletion Taxonomy (4-Bucket Model)](#10-architectural-deletion-taxonomy-4-bucket-model)
11. [Known Gaps (Open Work)](#11-known-gaps-open-work)
12. [Checklist: Adding Soft-Delete to a New Module](#12-checklist-adding-soft-delete-to-a-new-module)
13. [Retention, Hard-Purge & GDPR Erasure](#13-retention-hard-purge--gdpr-erasure)

---

## 1. Philosophy & Core Invariants

MMS prefers **soft-delete** (marking rows as archived in-place) over hard `DELETE` for all business entities.

### Core Rationale
- **Audit continuity** — deleted records still participate in historical reports, financial ledgers, and foreign key references without orphaning rows.
- **Accidental-deletion recovery** — users restore records from the Work trash without database admin intervention.
- **Data authority** — the server is the single source of truth; the client never decides whether a record is purged.

### Mandatory System Invariants
1. **Pervasive Query Guarding**: A soft-delete that any read path ignores is a critical data leak. `deleted_at IS NULL` must be enforced across all reads, joins, sub-selects, metrics, and background jobs.
2. **Session Invalidation ("Not deleted until sessions die")**: When a user or staff account (`tenant_users`, `faculty`) is soft-deleted, all active sessions and refresh tokens must be revoked immediately in Redis/auth stores. Authentication resolvers (`authenticateTenant`, `/me`, OAuth) must explicitly verify `deleted_at IS NULL` to prevent zombie sessions and silent resurrection.
3. **Database RLS Defense-in-Depth**: In addition to application query predicates, PostgreSQL Row-Level Security policies provide a defense-in-depth barrier, automatically hiding soft-deleted rows from standard tenant queries unless `app.include_deleted = 'true'` is explicitly configured.
4. **Schema-Level Hard-Delete Guard (`BEFORE DELETE` Trigger)**: Application-only discipline fails under operator pressure or errant scripts. PostgreSQL `BEFORE DELETE` triggers forbid physical row deletion on soft-deletable tables unless an explicit session bypass (`app.allow_hard_purge = 'true'`) is initialized by retention workers or workspace teardown.
5. **GDPR / Right-to-Erasure Boundary**: Soft-delete is for operational recovery, **not** GDPR Article 17 compliance. When Right to Erasure applies, personal data must undergo **crypto-shredding** (key destruction) paired with **in-place pseudonymization/scrubbing**; soft-delete alone does not satisfy erasure.
6. **Referential Integrity Contract**: Standard SQL foreign keys do not cascade on soft-deletes. Modules must define either:
   - **Restrict Guard (Default)**: Block soft-delete if active dependent children exist.
   - **Programmatic Atomic Cascade**: Soft-delete parent and children within one transaction, tagging children with `deleted_with_cascade: true`.
7. **Change Data Capture (CDC) & Outbox Tombstones**: Because soft-delete operates via SQL `UPDATE`, downstream search indexes (Meilisearch) and distributed caches do not detect SQL `DELETE` signals. Every soft-delete and restore must emit transactional outbox events (`entity.soft_deleted`, `entity.restored`) with monotonic versioning to drive immediate cache and search index eviction.
8. **Active Foreign Key Guarding (Dangling Reference Prevention)**: Standard SQL foreign keys validate physical row presence, not logical lifecycle state. A soft-deleted teacher or account still exists in SQL, which allows newly created child records to reference an archived entity without triggering an SQL FK error. Application write services and Zod validation must actively verify that referenced foreign keys point to active entities (`deleted_at IS NULL`), preventing the creation of ghost relationships.

**Soft-delete is mandatory for all entity tables in tenant modules.** Hard `DELETE` is strictly restricted to:
- Platform workspace teardown (`purgeTenantDataBySubdomain`)
- Background-job temporary artifact cleanup
- Scheduled retention hard-purge workers (§13)

---

## 2. Database Schema Layer

### 2.1 Column Quintuple (Metadata Standard)

Every soft-deletable entity table carries standard audit columns:

```ts
deletedAt:      timestamp('deleted_at',      { withTimezone: true, mode: 'date' }),
deletedBy:      text('deleted_by'),
deletionReason: varchar('deletion_reason', { length: 500 }),  // capped at DB + Zod layer
restoredAt:     timestamp('restored_at',     { withTimezone: true, mode: 'date' }),  // optional — person modules
restoredBy:     text('restored_by'),                                                  // optional — person modules
deletedWithCascade: boolean('deleted_with_cascade').default(false),                   // optional — cascade modules
```

| Column | Type | Set By | Cleared On Restore |
|---|---|---|---|
| `deleted_at` | `timestamp with time zone` | soft-delete handler | `SET NULL` |
| `deleted_by` | `text` | soft-delete handler (userId) | `SET NULL` |
| `deletion_reason` | `varchar(500)` | optional caller-supplied reason | `SET NULL` |
| `restored_at` | `timestamp with time zone` | restore handler | set to restore timestamp |
| `restored_by` | `text` | restore handler (userId) | set to restoring userId |
| `deleted_with_cascade` | `boolean` | cascade soft-delete handler | `false` |

> **Shared Drizzle Mixin:** Reusable across all schema files in `@mms/shared`:
> ```ts
> export const softDeleteColumns = {
>   deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
>   deletedBy: text('deleted_by'),
>   deletionReason: varchar('deletion_reason', { length: 500 }),
>   restoredAt: timestamp('restored_at', { withTimezone: true, mode: 'date' }),
>   restoredBy: text('restored_by'),
>   deletedWithCascade: boolean('deleted_with_cascade').default(false),
> };
> ```

> **Type contract:** `deletedAt` and `restoredAt` must always be passed as JavaScript `Date` objects (`new Date()`) — never ISO strings. Drizzle `mode: 'date'` expects `Date | null`.

### 2.2 Referential Integrity: Cascades vs Restrict

Because PostgreSQL foreign keys do not trigger `ON DELETE` during soft-delete `UPDATE` statements, entity relationships must enforce one of two explicit policies:

#### Policy A: Restrict Guard (Default for Financial & Academic Records)
If active dependent records exist, the soft-delete is blocked with a `400 Bad Request` or `409 Conflict`:
```ts
// Example: Cannot soft-delete an account if active ledger entries exist
const activeEntriesCount = await db.$count(accountingEntries, and(
  eq(accountingEntries.accountId, accountId),
  isNull(accountingEntries.deletedAt),
));
if (activeEntriesCount > 0) {
  throw new ValidationError('Cannot archive account with active ledger entries');
}
```

#### Policy B: Programmatic Atomic Cascade (`deleted_with_cascade`)
For modules where parent archival must cascade to children (e.g., archiving a session archives its enrollments), add:

```ts
deletedWithCascade: boolean('deleted_with_cascade').default(false),
```

| Value | Meaning | Restore Behaviour |
|---|---|---|
| `false` (default) | Explicitly archived by user | Restore independently |
| `true` | Archived as side-effect of parent | Restored ONLY when parent is restored |

```ts
// Atomic Cascade Soft-Delete
await db.transaction(async (tx) => {
  await tx.update(sessions)
    .set({ deletedAt: new Date(), deletedBy: userId, deletionReason: reason ?? null })
    .where(and(eq(sessions.id, sessionId), eq(sessions.workspaceSubdomain, tenant), isNull(sessions.deletedAt)));

  await tx.update(enrollments)
    .set({ deletedAt: new Date(), deletedBy: userId, deletedWithCascade: true })
    .where(and(eq(enrollments.sessionId, sessionId), eq(enrollments.workspaceSubdomain, tenant), isNull(enrollments.deletedAt)));
});

// Parent Restore — only restores enrollments that were cascade-deleted
await db.transaction(async (tx) => {
  await tx.update(sessions)
    .set({ deletedAt: null, deletedBy: null, restoredAt: new Date(), restoredBy: userId })
    .where(and(eq(sessions.id, sessionId), eq(sessions.workspaceSubdomain, tenant), isNotNull(sessions.deletedAt)));

  await tx.update(enrollments)
    .set({ deletedAt: null, deletedBy: null, deletedWithCascade: false, restoredAt: new Date(), restoredBy: userId })
    .where(and(eq(enrollments.sessionId, sessionId), eq(enrollments.workspaceSubdomain, tenant), eq(enrollments.deletedWithCascade, true)));
});
```

### 2.3 Index Strategy

Each table has **three categories** of indexes covering soft-delete queries.

#### Category A — Trash-mode index (non-partial)

Covers `includeDeleted = true` queries (trash browser):

```ts
index('students_workspace_deleted_idx').on(table.workspaceSubdomain, table.deletedAt)
```

#### Category B — Active-record partial indexes (`WHERE deleted_at IS NULL`)

Covers `includeDeleted = false` (default Work list) queries with maximum planner efficiency. The gold-standard tables (contacts, students) carry a full set:

```ts
// Minimal required — every soft-deletable table
index('students_workspace_active_idx')
  .on(table.workspaceSubdomain)
  .where(sql`${table.deletedAt} is null`),

// Compound variants for sorted / filtered hot paths (contacts / students gold standard)
index('students_workspace_status_updated_at_active_idx')
  .on(table.workspaceSubdomain, table.status, table.updatedAt)
  .where(sql`${table.deletedAt} is null`),
```

#### Category C — Archived-record partial indexes (`WHERE deleted_at IS NOT NULL`)

Covers trash-browser queries that **filter by tenant + pagination** with full planner assistance. Without this, the trash list falls back to a full table scan filtered in memory.

```ts
// Required for modules with a trash browser UI
index('students_workspace_deleted_records_idx')
  .on(table.workspaceSubdomain, table.deletedAt)
  .where(sql`${table.deletedAt} is not null`),
```

> **Production evidence (Lightdash):** Tables with both `WHERE deleted_at IS NULL` and `WHERE deleted_at IS NOT NULL` partial indexes outperform single-predicate indexes by up to 276× on skewed-status tables (17M active vs 3M archived rows).

> **Gap (open):** Non-gold-standard tables (faculty, sessions, enrollments, finance, accounting, obligations, hasanat, examinations) currently have only Category A indexes. Category B and C partial indexes are pending migration `085`.

### 2.4 Partial Unique Indexes — Soft-Delete Aware Uniqueness

**This is one of the most common soft-delete mistakes.** A standard `UNIQUE` constraint on `email` or `phone` means a soft-deleted row permanently occupies the unique slot — a new contact with the same email cannot be created until the archived row is hard-purged.

**Solution:** Replace standard unique constraints with **partial unique indexes** scoped to `WHERE deleted_at IS NULL`:

```sql
-- PostgreSQL partial unique index (generated by Drizzle migration)
-- Allows the same email on a soft-deleted row AND a new active row simultaneously
CREATE UNIQUE INDEX contacts_email_active_unique
  ON contacts(workspace_subdomain, email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX contacts_phone_active_unique
  ON contacts(workspace_subdomain, phone)
  WHERE deleted_at IS NULL;
```

In Drizzle schema definition:

```ts
// packages/shared/src/schema/contacts.ts
(table) => [
  // ✅ Partial unique — soft-deleted rows do NOT block re-use of the same email
  uniqueIndex('contacts_email_active_unique')
    .on(table.workspaceSubdomain, table.email)
    .where(sql`${table.deletedAt} is null`),

  uniqueIndex('contacts_phone_active_unique')
    .on(table.workspaceSubdomain, table.phone)
    .where(sql`${table.deletedAt} is null`),

  // ❌ DO NOT USE — blocks creating a new contact with the same email as an archived one
  // unique('contacts_email_unique').on(table.workspaceSubdomain, table.email),
]
```

**Modules that MUST use partial unique indexes:**

| Module | Unique Fields Needing Partial Index |
|---|---|
| `contacts` | `email`, `phone` |
| `students` | `student_id` (if unique), `email` |
| `faculty` | `employee_id`, `email` |
| `tenant_users` | `email` |

> **Slug uniqueness note:** When natural keys can be reused after archival (e.g., a session code), apply the same partial unique index pattern. If reuse is **not** intended (e.g., audit trail entries), keep the standard `UNIQUE` constraint.

### 2.5 Schema-Level Safety Guard: PostgreSQL `BEFORE DELETE` Trigger

Application-only soft-delete discipline is vulnerable to manual operator mistakes, raw Drizzle queries, and rogue scripts. To provide absolute defense-in-depth, PostgreSQL `BEFORE DELETE` triggers forbid physical row deletion across soft-deletable entity tables.

```sql
-- DDL Migration: Add hard-delete guard function
CREATE OR REPLACE FUNCTION forbid_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitted only if caller explicitly escalates session privilege (e.g. background purge worker)
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard delete forbidden on table "%", use soft-delete (UPDATE ... SET deleted_at = NOW())', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

-- Attached to core tenant tables
CREATE TRIGGER trg_students_forbid_hard_delete
  BEFORE DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();

CREATE TRIGGER trg_contacts_forbid_hard_delete
  BEFORE DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
```

> **Purge Execution Bypass:** Authorized retention workers (§13) or tenant teardown routines execute `SET LOCAL app.allow_hard_purge = 'true'` inside their transaction to perform genuine physical purges.

### 2.6 Row-Level Security (RLS) Policy Specification

PostgreSQL Row-Level Security ensures that queries automatically filter out soft-deleted records even if application code accidentally omits `isNull(table.deletedAt)`:

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

-- Tenant Isolation + Soft-Delete Default Policy
CREATE POLICY tenant_soft_delete_isolation ON students
  FOR ALL
  USING (
    workspace_subdomain = current_setting('app.current_tenant', true)
    AND (
      deleted_at IS NULL
      OR current_setting('app.include_deleted', true) = 'true'
    )
  );
```

When a user browses the trash, backend route handlers execute `SET LOCAL app.include_deleted = 'true'` within the request transaction boundary, unlocking archived rows for authorized roles.

### 2.7 Query Planner Optimization: Static vs Dynamic Predicates & Relational Guardrails

A critical PostgreSQL query planner pitfall occurs when attempting to handle `includeDeleted` dynamically via SQL parameters:

```sql
-- ❌ BANNED PARAMETERIZED OR PREDICATE:
SELECT * FROM students
WHERE workspace_subdomain = $1
  AND ($2::boolean IS TRUE OR deleted_at IS NULL);
```

**Why this breaks:** PostgreSQL cannot evaluate `$2` at plan compilation time. It will **not** use the Category B partial index (`WHERE deleted_at IS NULL`) and will fall back to a full table scan or expensive sequential filter.

**Mandatory Rule:** In Drizzle ORM, always construct the query AST dynamically so the static predicate is emitted:

```ts
// ✅ Correct Drizzle query construction:
const conditions = [eq(table.workspaceSubdomain, tenant)];
if (!includeDeleted) {
  // Directly emits "deleted_at IS NULL", matching Category B partial index
  conditions.push(isNull(table.deletedAt));
} else {
  // Directly emits "deleted_at IS NOT NULL", matching Category C partial index
  conditions.push(isNotNull(table.deletedAt));
}

const rows = await db.select().from(table).where(and(...conditions));
```

#### Drizzle Relational Query Guardrails (`db.query.*`)
When using Drizzle ORM relational queries (`db.query.table.findMany`), Drizzle does **not** automatically apply soft-delete filters to nested relations declared in `with: { ... }`. Without explicit relational scoping, soft-deleted child rows silently leak into the parent payload:

```ts
// ❌ LEAK HAZARD: soft-deleted enrollments are loaded with active session
const sessionWithLeakedChildren = await db.query.sessions.findFirst({
  where: and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)),
  with: { enrollments: true },
});

// ✅ MANDATORY PATTERN: Explicit relational where filter on all child relations
const session = await db.query.sessions.findFirst({
  where: and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)),
  with: {
    enrollments: {
      where: (enrollments, { isNull }) => isNull(enrollments.deletedAt),
    },
  },
});
```

### 2.8 PostgreSQL 15+ `NULLS NOT DISTINCT` vs Partial Unique Indexes

PostgreSQL 15 introduced `UNIQUE NULLS NOT DISTINCT`, which treats `NULL` values as equal in unique constraints.

> **Evaluation:** `UNIQUE NULLS NOT DISTINCT` does **NOT** work for soft-deletable records. If defined on `(workspace_subdomain, email, deleted_at)`, it would allow only **one** active record (`deleted_at = NULL`), but would forbid any subsequent soft-deleted records from having `NULL` timestamps.
> 
> **Standard:** PostgreSQL partial unique indexes (`CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`) are the sole correct and performant mechanism for allowing reuse of unique identifiers (emails, employee IDs, phone numbers) after soft-delete.

### 2.9 Covered Entity Tables

| Schema File | Entities |
|---|---|
| `contacts.ts` | `contacts`, `tenant_users` |
| `contactTables.ts` | contact-linked lookup tables |
| `students.ts` | `students` |
| `faculty.ts` (+ `faculty*` satellites) | `faculty` |
| `sessions.ts` | `sessions` |
| `enrollments.ts` | `enrollments` |
| `attendance.ts` | `attendance_records` |
| `finance.ts` | `finance_invoices`, `finance_payments` |
| `accounting.ts` | `accounting_accounts`, `accounting_fiscal_years`, `accounting_entries` |
| `obligations.ts` | `obligation_collections` |
| `hasanat.ts` | `hasanat_distributions` |
| `examinations.ts` | `exams`, `questions`, `tests`, `assessment_results` |
| `examinationQuestionBankTables.ts` | question bank entity tables |
| `messaging.ts` | `message_logs` |

### 2.10 PostgreSQL HOT Updates, Partial Index Eviction & Autovacuum Tuning

In PostgreSQL, an `UPDATE` that sets `deleted_at = NOW()` writes a new row version (tuple) to the heap and marks the previous tuple dead. Understanding the storage engine mechanics is critical for sustaining high-throughput databases:

1. **Heap-Only Tuple (HOT) Update Ineligibility**:
   Because `deleted_at` is indexed across Category A and Category C indexes, PostgreSQL **cannot execute a HOT update** when soft-deleting a row. The engine must register new index pointers in all non-partial indexes pointing to the table.
2. **Category B Partial Index Eviction**:
   Because Category B partial indexes are scoped to `WHERE deleted_at IS NULL`, the instant a row is soft-deleted, PostgreSQL **removes its pointer from the Category B index entirely**. This keeps hot active-record indexes compact, cache-resident, and free from dead tuple clutter.
3. **Autovacuum Tuning on High-Churn Tables**:
   Tables with frequent soft-delete or TTL sweeper operations (`message_logs`, `attendance_records`) risk table and index bloat if dead tuples accumulate faster than standard autovacuum runs. High-churn tables should be tuned in DDL:
   ```sql
   ALTER TABLE message_logs SET (
     autovacuum_vacuum_scale_factor = 0.05,
     autovacuum_vacuum_cost_limit = 1000
   );
   ```

---

## 3. `@mms/shared` — Types, DTOs, and Helpers

### 3.1 Request Body Schemas

Defined in [`packages/shared/src/schemas/api.dto.ts`](../packages/shared/src/schemas/api.dto.ts):

```ts
// Single soft-delete — optional audit reason
export const softDeleteBodySchema = z.preprocess(deepSanitizeStrings, z.object({
  deletionReason: z.string().max(500).optional(),
}).strict());

// Bulk soft-delete / restore — capped id list (max 500) + optional reason
export const bulkIdsBodySchema = z.preprocess(deepSanitizeStrings, z.object({
  ids: z.array(z.union([z.string(), z.number()])).min(1).max(500),
  deletionReason: z.string().max(500).optional(),
}).strict());

// String-only variant for modules that never use numeric ids
export const bulkStringIdsBodySchema = z.preprocess(deepSanitizeStrings, z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  deletionReason: z.string().max(500).optional(),
}).strict());
```

All three schemas use `.strict()` — extra fields are rejected. `deepSanitizeStrings` XSS-sanitizes all string values before Zod parsing.

### 3.2 Write Schema Guard — Reject Client-Supplied Delete Fields

Every module write schema (Create / Update) must reject client-supplied soft-delete fields. Enforced via Zod `.omit()` or a strip transform:

```ts
// Example verified by unit test:
// packages/shared/src/__tests__/contactWriteSchema.test.ts
expect(contactWriteSchema.parse({ ...payload, deletionReason: 'x' }))
  .not.toHaveProperty('deletionReason');
```

Shared strip helper (contacts — each module has its own equivalent):

```ts
// packages/shared/src/contactSoftDelete.ts
export const CONTACT_CLIENT_SOFT_DELETE_KEYS =
  ['deletedAt', 'deletedBy', 'deletionReason'] as const;

export function stripContactClientSoftDeleteFields<T extends Record<string, unknown>>(
  record: T,
): T {
  const next = { ...record };
  for (const key of CONTACT_CLIENT_SOFT_DELETE_KEYS) delete next[key];
  return next;
}
```

Tests in `packages/shared/src/__tests__/` verify the schema correctly rejects all three fields for every person-module.

### 3.3 `isQueryFlagTrue` — Canonical `includeDeleted` Parsing

```ts
// packages/shared/src/paginationUtils.ts
export function isQueryFlagTrue(value: unknown): boolean
```

Accepts `true`, `1`, `'true'`, `'True'`, `'TRUE'`, `'yes'`, `' 1 '`; all other values → `false`.

**Use this everywhere** a query-string boolean flag needs parsing. Never write inline ternaries to coerce `includeDeleted`.

### 3.4 Soft-Delete Predicate Helpers

```ts
// packages/shared/src/contactSoftDelete.ts
export function isContactDeleted(contact: Contact): boolean {
  return Boolean(contact.deletedAt);
}

export function filterActiveContacts(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => !isContactDeleted(c));
}
```

Each person-module (`students`, `faculty`) has equivalent helpers in its own shared types file.

### 3.5 `SoftDeleteListFilter` — Three-Way Scope

```ts
// apps/backend/src/services/genericRelationalService.ts
export type SoftDeleteListFilter = 'active' | 'deleted' | 'all';
```

| Value | Rows returned | Use case |
|---|---|---|
| `'active'` (default) | `deleted_at IS NULL` | Normal Work list |
| `'deleted'` | `deleted_at IS NOT NULL` | Archive / trash browser |
| `'all'` | No filter | Platform admin views, dedup scans, migration scripts |

The `'all'` variant is available in `genericRelationalService.loadAll` but must **never** be exposed to tenant-scoped list endpoints without explicit platform-level RBAC gating.

> **Security note:** The `'all'` scope bypasses RLS filtering for soft-deleted rows. Any query using `SoftDeleteListFilter = 'all'` on a tenant-scoped endpoint is a **data leak vector** — archived records can appear in analytical views if the tenant predicate is missing. Always pair `'all'` with an explicit `eq(table.workspaceSubdomain, tenant)` predicate.

---

## 4. Backend Route Factories

All soft-delete route logic flows through three shared factory files. **Never hand-roll a `DELETE /:id` or `POST /:id/restore` outside these factories.**

### 4.1 `registerResourceRoutes` — Per-Entity CRUD + Soft-Delete

[`apps/backend/src/lib/crudResourceRoutes.ts`](../apps/backend/src/lib/crudResourceRoutes.ts)

Registers when the corresponding `Fn` is provided:

| Endpoint | Option | Description |
|---|---|---|
| `DELETE /:id` | `deleteFn` | Soft-delete a single record |
| `POST /:id/restore` | `restoreFn` | Restore a single soft-deleted record |

```ts
interface ResourceRoutesOptions<T> {
  deleteFn?:  (id: string, userId: string, reason?: string) => Promise<unknown | null>;
  restoreFn?: (id: string, userId: string)                  => Promise<unknown | null>;
  canDelete?:  (user: User) => boolean;           // defaults to canDeleteCollection
  onAfterDelete?:  (user, id, reason?) => Promise<void>; // audit hook
  onAfterRestore?: (user, id)           => Promise<void>; // audit hook
  buildRestoreResponse?: (restored, user) => Promise<Record<string, unknown>>;
  mapRestoreError?: (error: unknown) => { statusCode: number; body: ... } | null;
}
```

**`DELETE` handler flow:**
1. Validates `canDelete(user)` → 403 if denied
2. Parses `softDeleteBodySchema` from request body
3. Calls `deleteFn(id, userId, body.deletionReason)`
4. Fires `onAfterDelete?.(user, id, deletionReason)` — see §8 for blocking vs fire-and-forget
5. Returns `{ success: true }`

**`POST /:id/restore` handler flow:**
1. Validates `canDelete(user)` → 403 if denied
2. Calls `restoreFn(id, userId)`
3. Fires `onAfterRestore?.(user, id)` — see §8 for blocking vs fire-and-forget
4. Returns `buildRestoreResponse(restored, user)` or `{ success: true }`

**Idempotency contract:**
- `DELETE /:id` on an already-archived record → `404`. Callers must read current state before acting.
- `POST /:id/restore` on an already-active record → `404`.
- Bulk operations silently skip already-processed rows (counted in `failed`, not an error).

This is **intentional** — HTTP `DELETE` idempotency is achieved by reading state first, not by silently swallowing re-delete. Document this behaviour in module-level API changelogs so client callers know to handle 404 gracefully.

**Concurrency & Atomic Status Latching:**
Under concurrent load, two simultaneous `DELETE /:id` requests can race. Both may pass an in-memory check. Gold-standard modules use an atomic conditional `UPDATE … WHERE deleted_at IS NULL RETURNING id` pattern:

```ts
// Atomic conditional latch
const [deleted] = await db
  .update(table)
  .set({ deletedAt: new Date(), deletedBy: userId, deletionReason: reason ?? null })
  .where(and(
    eq(table.id, id),
    eq(table.workspaceSubdomain, tenant),
    isNull(table.deletedAt), // Atomic latch: matches only if currently active
  ))
  .returning({ id: table.id });

if (!deleted) {
  // Query state to disambiguate 404 error message
  const existing = await db.query.table.findFirst({
    where: and(eq(table.id, id), eq(table.workspaceSubdomain, tenant)),
    columns: { id: true, deletedAt: true },
  });
  if (existing?.deletedAt) throw new NotFoundError('Record is already archived');
  throw new NotFoundError('Record not found');
}
```

### 4.2 `registerSoftDeletableBulkTrashRoutes` — Bulk Delete + Bulk Restore

[`apps/backend/src/lib/crudBulkRouteFactories.ts`](../apps/backend/src/lib/crudBulkRouteFactories.ts)

Registers:

| Endpoint | Description |
|---|---|
| `POST /bulk-delete` | Bulk soft-delete up to 500 records |
| `POST /bulk-restore` | Bulk restore up to 500 records |

```ts
interface SoftDeletableBulkTrashRoutesOptions {
  bulkDeleteFn:  (ids: string[], userId: string, reason?: string) => Promise<{ succeeded: number; failed: number }>;
  bulkRestoreFn: (ids: string[], userId: string)                  => Promise<{ succeeded: number; failed: number }>;
  onAfterBulkDelete?:  (user, result, deletionReason?) => Promise<void>;
  onAfterBulkRestore?: (user, result)                  => Promise<void>;
  canDelete?: (user: User) => boolean;
  bulkBodySchema?: ZodType<...>; // defaults to bulkIdsBodySchema
}
```

> **Resolved gap:** `registerSoftDeletableBulkRoutes` (the combined bulk+CRUD composite) passes `userId` when adapting `bulkRestoreFn` in `crudBulkRouteFactories.ts` and `crudBulkRouteHelpers.ts`.

> **Performance contract:** `bulkDeleteFn` and `bulkRestoreFn` implementations **must** use a single batched SQL statement — never a per-row loop. The `genericRelationalService.bulkDeleteByIds` iterates sequentially (N+1 pattern) and is a legacy implementation for collection-store backed modules only. SQL-backed modules must use:
> ```ts
> // ✅ Required for Drizzle / SQL-backed modules
> await db
>   .update(table)
>   .set({ deletedAt: new Date(), deletedBy: userId, deletionReason: reason ?? null })
>   .where(and(
>     inArray(table.id, ids),
>     eq(table.workspaceSubdomain, tenant),
>     isNull(table.deletedAt),   // skip already-archived rows
>   ));
> ```
> Cross-reference: `mms-performance.md §1` — Zero Queries in Loops.

### 4.3 `handleBulkListGet` — Unified `includeDeleted` List Handler

[`apps/backend/src/lib/crudBulkRouteHelpers.ts`](../apps/backend/src/lib/crudBulkRouteHelpers.ts)

Use `supportsIncludeDeleted: true` to enable trash-aware list loading with RBAC gating in a single consistent call:

```ts
await handleBulkListGet(request, reply, user, collection, {
  loadPageFn,
  listQuerySchema,
  supportsIncludeDeleted: true,  // parses includeDeleted via isQueryFlagTrue; gates on canDeleteCollection
  responseKey: 'sessions',
  errorMessagePrefix: 'sessions',
});
```

> **Legacy warning:** `scopeDeleted()` from `tenantBulkService.ts` filters rows **in Node.js memory** after a full table load. It is a **legacy helper** for collection-store backed modules only. New SQL-backed modules must filter at the database layer (`WHERE deleted_at IS NULL` / `WHERE deleted_at IS NOT NULL`) — never in application memory. Using `scopeDeleted()` in new modules violates `mms-performance.md §1`.


### 4.4 Dedicated Soft-Delete Route Files (Gold-Standard Modules)

Contacts, Students, and Faculty use dedicated route files for richer logic (uniqueness validation on restore, sanitized entity response, richer audit messages):

| Module | File |
|---|---|
| Contacts | [`contactSoftDeleteRoutes.ts`](../apps/backend/src/routes/tenant/contacts/contactSoftDeleteRoutes.ts) |
| Students | [`studentSoftDeleteRoutes.ts`](../apps/backend/src/routes/tenant/students/studentSoftDeleteRoutes.ts) |
| Faculty | [`facultySoftDeleteRoutes.ts`](../apps/backend/src/routes/tenant/faculty/facultySoftDeleteRoutes.ts) |

### 4.5 Uniqueness-on-Restore Contract & Error 23505 Trap

When restoring a record that holds a unique constraint (`email`, `phone`, `employee_id`), the `restoreFn` must check **before** the `UPDATE` whether a non-deleted record already owns that value.

In addition, under concurrent restore operations, two admins restoring duplicate emails simultaneously can pass the pre-check. The handler must trap PostgreSQL error `23505` (`unique_violation`) and map it cleanly to `409 Conflict`:

```ts
// Gold-standard pattern (contacts, students, faculty)
async function restoreContactById(id: string, userId: string) {
  const existing = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  if (!existing?.deletedAt) return null;  // not archived

  // 1. Pre-check uniqueness before restoring
  const conflict = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.email, existing.email),
      isNull(contacts.deletedAt),
      ne(contacts.id, id),
    ),
  });
  if (conflict) throw new ConflictError(`Email already in use by contact ${conflict.id}`);

  // 2. Execute update with 23505 race condition protection
  try {
    return await db.update(contacts)
      .set({ deletedAt: null, deletedBy: null, deletionReason: null,
             restoredAt: new Date(), restoredBy: userId })
      .where(and(eq(contacts.id, id), isNotNull(contacts.deletedAt)))
      .returning();
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
      throw new ConflictError('Cannot restore record: conflicting active record was restored concurrently');
    }
    throw err;
  }
}
```

| Approach | When to use |
|---|---|
| **Block restore** — `409 Conflict` with conflicting record's ID | MMS default for all person modules |
| **Merge** — archive the duplicate, restore the original | Advanced; requires explicit user consent flow |
| **Rename-then-restore** | ❌ Not recommended — data corruption risk |

> **With partial unique indexes (§2.4):** Even if the DB allows both an archived and an active row to share the same email, the restore handler must still run the 409 check and catch `23505`. This prevents two active rows from colliding once restored.

### 4.6 Parent Deletion vs Child Insertion Race (Orphan Guard)

When soft-deleting a parent record that cascades or restricts children (e.g. archiving a Session with Enrollments):
1. **The Race:** If an enrollment is inserted in Transaction B while Transaction A is executing an atomic cascade on the Session, Transaction B might commit after Transaction A completes, leaving an orphaned active enrollment linked to an archived session.
2. **The Defense:**
   - **Row-level lock:** In Transaction A, lock the parent row prior to cascading:
     ```ts
     await tx.select({ id: sessions.id })
       .from(sessions)
       .where(and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)))
       .for('update');
     ```
   - **Child insert validation:** When inserting child records, verify the parent's `deleted_at IS NULL` inside the insertion query or via a `BEFORE INSERT` trigger.

### 4.7 Single-Record Read Semantics (`GET /:id` on Archived Records)

Handling single-record detail reads on soft-deleted entities requires explicit semantic separation between active workspace browsing and trash inspection:

1. **Default Read Path (`GET /:id` without flags)**:
   - Must append `isNull(table.deletedAt)` to the fetch query.
   - If the row exists but has `deleted_at IS NOT NULL`, the endpoint **must return `404 Not Found`**.
   - Returning the archived entity on standard detail endpoints leaks archived data into active forms and edit workflows.
2. **Trash Inspection Path (`GET /:id?includeDeleted=true`)**:
   - Used exclusively by detail drawers opened from trash views or forensic audit views.
   - Parses `isQueryFlagTrue(request.query.includeDeleted)`.
   - **Mandatory RBAC Gate**: Validates `canDeleteCollection(user, collection)` prior to executing the read. If the caller lacks delete privileges, returns `403 Forbidden` immediately.
   - Queries with RLS session variable `SET LOCAL app.include_deleted = 'true'` to bypass engine masking.

---

## 5. Module Manifest — `softDelete` Block

Every module manifest in `@mms/shared` must declare a `softDelete` block:

```ts
softDelete: {
  workExcludesDeleted:      boolean;    // true = Work list hides archived (standard)
  reportsIncludeDeleted:    boolean;    // false = Reports show only active rows
  exportsIncludeDeleted:    boolean;    // false = CSV exports exclude archived
  duplicatesIncludeDeleted?: boolean;   // false = dedup scans skip archived
  captureDeletionReason:    boolean;    // true = UI prompts for reason on archive
  retentionDays?:           number;     // null/undefined = keep forever; set to auto-purge after N days
}
```

### `captureDeletionReason` by Module

| Module | `captureDeletionReason` | Reason |
|---|---|---|
| contacts | `true` | Person records — reason is audit-critical |
| faculty | `true` | Person records |
| students | `true` (implied) | Person records |
| sessions | `true` | Session closure reason is operationally useful |
| enrollments | `true` | Dropout/withdrawal reason drives reports |
| examinations | `false` | Exam deletion is admin-only, no workflow reason |
| questionBank | `false` | Content management, no reason required |
| obligations | `false` | Financial admin operation |
| accounting | `false` | Financial admin operation |
| hasanat | `false` | Distribution management |

When `captureDeletionReason: false`, the FE **must not** render a deletion reason input. The body schema still accepts it as optional, but no UI prompt is shown.

---

## 6. RBAC Gating

Soft-delete access is controlled by the **delete permission** — there is no separate trash permission.

| Action | Required Permission |
|---|---|
| `DELETE /:id` (single soft-delete) | `canDelete(user)` — defaults to `canDeleteCollection(user, collection)` |
| `POST /:id/restore` (single restore) | Same `canDelete(user)` |
| `POST /bulk-delete` | `canDeleteCollection(user, collection)` |
| `POST /bulk-restore` | `canDeleteCollection(user, collection)` |
| `GET /?includeDeleted=true` (trash list) | `canDeleteCollection(user, collection)` → 403 if insufficient |
| `GET /:id?includeDeleted=true` (trash detail) | `canDeleteCollection(user, collection)` → 403 if insufficient |

The RBAC gate on `includeDeleted` prevents non-delete-privileged users from reading soft-deleted rows at all. Implemented via `isQueryFlagTrue(query.includeDeleted)` + `canDeleteCollection` in every list route and `handleBulkListGet`.

---

## 7. Frontend UX Layer

### 7.1 `viewingDeleted` State & URL Search Param Synchronization

The `viewingDeleted` boolean indicates whether the user is browsing active records or the trash directory. Modern web best practices require synchronizing this state with **URL Search Parameters** (`useSearchParams`), ensuring deep-linkability, browser history navigation, and persistence across page reloads:

```tsx
// Pattern: URL-synchronized trash toggle state
const [searchParams, setSearchParams] = useSearchParams();
const viewingDeleted = searchParams.get('view') === 'trash' || searchParams.get('archived') === 'true';

const setViewingDeleted = (showDeleted: boolean) => {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (showDeleted) {
      next.set('view', 'trash');
    } else {
      next.delete('view');
      next.delete('archived');
    }
    return next;
  }, { replace: true });
};
```

The TanStack Query hook maps `viewingDeleted` to `includeDeleted`:

```ts
// useStudentsPageWorkQuery.ts
queryKey: [...STUDENTS_QUERY_KEY, { ..., includeDeleted: viewingDeleted }],
queryFn: () => apiClient.get(buildStudentsListUrl({ ..., includeDeleted: viewingDeleted })),
```

The URL builder serializes `includeDeleted: true` → `?includeDeleted=true` and omits the param when `false`.

### 7.2 `ModuleTrashToggle` — Shared UI Primitive

[`apps/frontend/src/components/ui/ModuleTrashToggle.tsx`](../apps/frontend/src/components/ui/ModuleTrashToggle.tsx)

```tsx
<ModuleTrashToggle
  showDeleted={viewingDeleted}
  onToggle={() => setViewingDeleted(!viewingDeleted)}
  showActiveLabel={t('common.showArchived')}
  showDeletedLabel={t('common.showActive')}
/>
```

| Prop | Type | Description |
|---|---|---|
| `showDeleted` | `boolean` | Current trash mode state |
| `onToggle` | `() => void` | Toggle handler |
| `showActiveLabel` | `string` | Label when **in** trash mode (click to return to active) |
| `showDeletedLabel` | `string` | Label when **not** in trash mode (click to view trash) |
| `disabled?` | `boolean` | Disables button during loading |
| `title?` | `string` | Tooltip / aria hint |

Renders with `aria-pressed={showDeleted}` for screen-reader support. Mount inside `ModuleWorkToolbar` — not in the Filters menu dropdown.

### 7.3 Bulk Actions — `BulkSelectionDeleteAction` / `BulkSelectionRestoreAction`

[`apps/frontend/src/components/ui/BulkSelectionActions.tsx`](../apps/frontend/src/components/ui/BulkSelectionActions.tsx)

When `viewingDeleted = true` → show `BulkSelectionRestoreAction`, hide `BulkSelectionDeleteAction`.  
When `viewingDeleted = false` → show `BulkSelectionDeleteAction`, hide `BulkSelectionRestoreAction`.

`ModuleWorkBulkActionBar` wires this automatically:
```tsx
<ModuleWorkBulkActionBar
  viewingDeleted={viewingDeleted}
  onRequestBulkDelete={handleBulkDelete}
  onRequestBulkRestore={handleBulkRestore}
/>
```

Mount the bulk action bar on the list/parent container — **not** beside Filters/Add in the Work toolbar.

**Drawer + bulk-select interaction:** When a user has bulk items selected and simultaneously opens a detail drawer, the **drawer takes precedence** — bulk action bar remains mounted but is visually de-emphasized. The drawer's `ArchivedBanner` restore action operates on the **single drawer record only**, independent of any bulk selection. Bulk selection is not cleared on drawer open.

### 7.4 Detail Drawer — `ArchivedBanner` + `WarningCallout`

Every detail drawer must detect `deletedAt != null` and render an archive banner **above** the tab content:

```tsx
/** Soft-delete archive banner for [Module] drawer. */
export function [Module]ArchivedBanner({ entity, onRestore, canDelete }) {
  if (!entity.deletedAt) return null;
  return (
    <WarningCallout tone="warning" density="compact">
      {/* Archived at date + optional deletion reason + Restore button */}
    </WarningCallout>
  );
}
```

**When the archive banner is shown:**
- ❌ Hide Edit button and all create-style CTAs
- ❌ Hide Call / WhatsApp / SMS / Email action buttons
- ✅ Show Restore button (gated on `canDelete`)

Reference implementations: `ContactArchivedBanner`, `StudentArchivedBanner`, `TeacherArchivedBanner`, `SessionArchivedBanner`, `EnrollmentArchivedBanner`, `UserArchivedBanner`.

### 7.5 Work Toolbar — Hiding Add/Create in Trash Mode

When `viewingDeleted = true`, the Add/Create CTA **must be hidden** (not disabled):

```tsx
{!viewingDeleted && canWrite && (
  <Button onClick={onRequestCreate}>{t('module.addRecord')}</Button>
)}
```

### 7.6 Export Actions in Trash Mode

Per manifest `exportsIncludeDeleted: false`, export CTAs must be hidden in trash mode:

```ts
// useStudentsExportActions.ts — reference pattern
const isExportable = !viewingDeleted && !isLoading;
```

### 7.7 Keyboard Shortcut Guard

`Cmd/Ctrl+N` (open create) must check both `canWrite` **and** `!viewingDeleted` before firing:

```ts
if (!viewingDeleted && canWrite) openCreateModal();
```

Map `showDeleted` only at the keyboard hook's control boundary — not inside form components.

### 7.8 Optimistic Soft-Delete with Undo Toast (5–10s Grace Window)

Modal confirmation dialogues for routine, reversible soft-deletes create friction and confirmation fatigue. For single-record deletions, gold-standard UX employs **optimistic hiding with an instant Undo toast**:

1. **Optimistic Cache Update:** The TanStack Query cache hides the record immediately.
2. **Toast Presentation:** Display a toast: `"Record archived."` with a primary action button `[Undo]` lasting 5–10 seconds.
3. **Undo Action:** If clicked, triggers `POST /:id/restore` and immediately restores the record in cache without requiring the user to navigate to the trash view.

```tsx
// Example hook pattern in directory row actions
const { mutate: softDelete } = useMutation({
  mutationFn: (id: string) => apiClient.delete(`/api/students/${id}`),
  onSuccess: (_, id) => {
    queryClient.setQueryData(STUDENTS_KEY, (prev) => filterOut(prev, id));
    toast({
      title: t('common.recordArchived'),
      action: (
        <ToastAction altText="Undo" onClick={() => restoreRecord(id)}>
          {t('common.undo')}
        </ToastAction>
      ),
      duration: 7000,
    });
  },
});
```

### 7.9 Retention Expiry Countdown Badge

When browsing the trash directory (`viewingDeleted = true`) or viewing an archived drawer, calculate remaining retention time from `purgeAfter` or `deletedAt + retentionDays`:
- If $\le 7$ days remain: render a badge with warning tone: `⚠️ Purges in 3 days`.
- Standard display: `Archived on Jan 12 • Purges in 45 days`.
- If `retentionDays` is null/undefined: display `Archived indefinitely`.

### 7.10 Search & Filter State Preservation Across Trash Toggle

Toggling `ModuleTrashToggle` must **preserve** the active search query and facet selections. Users frequently search for an entity, discover it is missing, and toggle to the trash mode to verify if it was archived. Resetting filter state on toggle disrupts user flow and forces repetitive typing.

---

## 8. Audit Trail & Outbox Integration

Soft-delete and restore operations emit audit events through `onAfterDelete` and `onAfterRestore` hooks, and write domain events to the Transactional Outbox.

### Single-Record Audit Pattern

```ts
// contactSoftDeleteRoutes.ts (gold standard)
registerResourceRoutes(fastify, {
  deleteFn: (id, userId, reason) => contactUseCases.softDeleteContactById(id, userId, reason),
  restoreFn: (id) => contactUseCases.restoreContactById(id),
  onAfterDelete: async (user, id, deletionReason) => {
    await auditContact(user, 'contact.soft_delete', `Archived contact ${id}`, id);
  },
  onAfterRestore: async (user, id) => {
    await auditContact(user, 'contact.restore', `Restored contact ${id}`, id);
  },
});
```

### Bulk-Action Audit Pattern

```ts
registerSoftDeletableBulkTrashRoutes(fastify, {
  bulkDeleteFn: (ids, user, reason) => contactUseCases.bulkSoftDeleteContacts(ids, user, reason),
  bulkRestoreFn: (ids, userId) => contactUseCases.bulkRestoreContacts(ids, userId),
  onAfterBulkDelete: async (user, result, deletionReason) => {
    const note = deletionReason?.trim() ? ` — ${deletionReason.trim()}` : '';
    await auditContact(
      user, 'contact.bulk_soft_delete',
      `Soft-deleted ${result.succeeded} contact(s); ${result.failed} failed${note}`,
    );
  },
  onAfterBulkRestore: async (user, result) => {
    await auditContact(
      user, 'contact.bulk_restore',
      `Restored ${result.succeeded} contact(s); ${result.failed} failed`,
    );
  },
});
```

### Change Data Capture (CDC) & Transactional Outbox Integration

Because soft-delete executes as a SQL `UPDATE`, external search indexes (Meilisearch), downstream event listeners, and caching layers do not receive native SQL `DELETE` triggers. 

**Outbox Event Emission Contract with Monotonic Versioning:**
Inside the same transaction as the soft-delete `UPDATE`, emit an outbox record with an incremented monotonic `version` or millisecond timestamp:
- **`entity.soft_deleted`:** Payload includes `{ entityType, entityId, tenantId, deletedAt, deletedBy, version: Date.now() }`.
  - Downstream search processor issues index tombstone: `meiliSearch.index(entityType).deleteDocument(entityId)`.
  - Downstream cache worker invalidates relevant Redis keys (`mms:{tenant}:{entityType}:...`).
- **`entity.restored`:** Payload includes `{ entityType, entityId, tenantId, restoredAt, restoredBy, version: Date.now() }`.
  - Downstream search processor re-indexes the entity document.

**Idempotent Consumer Protection Against Out-of-Order Delivery:**
When a record is archived and restored in rapid succession, asynchronous event queues can deliver the `restored` event before the `soft_deleted` event. External consumers must check event versioning before mutating indexes:
```ts
// Idempotent consumer guard in search sync worker
if (incomingEvent.version <= existingIndexMeta.version) {
  logger.warn({ incomingEvent }, 'Dropping out-of-order CDC event');
  return;
}
```

### Content Snapshotting on Archival (Forensics Survival)

For entities with user-authored text (student progress notes, remarks, incident logs):
When an entity is soft-deleted, the audit trail event payload **must capture the full snapshot of text and body content** at deletion time. If the entity is eventually hard-purged after its retention period (§13), the textual forensic record remains preserved in the immutable audit trail.

### Audit Requirements

- Include `deletionReason` in audit message when provided.
- Bulk operations log `succeeded` and `failed` counts.
- Restore events attribute the **restoring user**, not the original deleting user.
- **Audit hooks in `crudResourceRoutes.ts` use `await`** — if the hook throws, the error propagates to `sendDatabaseError`. Two acceptable patterns:

  **Option A — Fire-and-forget with structured error log (current default for non-critical modules):**
  ```ts
  onAfterDelete?.(user, id, reason).catch((err) =>
    fastify.log.error({ err, id }, 'soft-delete audit hook failed')
  );
  ```
  **Option B — Move audit into `deleteFn` transaction (gold-standard, tamper-evident):**
  Audit write and the `UPDATE` share one DB transaction — atomic, never partially applied. Preferred for person modules.

  Choose one pattern per module and document it. **Do not mix** — never use `await` in the hook and claim it is non-blocking.

---

## 9. Anti-Patterns

These are **banned patterns** sourced from production post-mortems and GitHub ADRs. Each causes data leaks or corruption.

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Missing `WHERE deleted_at IS NULL` on a query path** | Archived rows appear in active Work lists, API responses, or background jobs | Add the predicate to every query; use Category B partial index to make omission a query-plan miss |
| **Referencing soft-deleted foreign key targets** | SQL foreign keys allow referencing soft-deleted records because the row still exists physically, creating ghost relationships | Add write-path Zod validation or a `BEFORE INSERT OR UPDATE` trigger verifying target `deleted_at IS NULL` (§1.8) |
| **Drizzle relational query without `where` on child relations** | `db.query.table.findMany({ with: { children: true } })` silently joins soft-deleted children | Mandate explicit `where: (c, { isNull }) => isNull(c.deletedAt)` on all nested relations (§2.7) |
| **Soft-deleting user without session revocation** | Soft-deleted users can still access API using existing active JWTs/sessions | Immediately invalidate tokens and Redis sessions on soft-delete (§1.2) |
| **Authentication resolver ignoring `deletedAt`** | Soft-deleted user signing in via OAuth/credentials silently resurrects account | Gate all auth resolvers on `deleted_at IS NULL` (§1.2) |
| **Soft-deleting parent with active dependent records** | Leaves orphaned children active or causes foreign key inconsistencies | Implement Restrict Guard or atomic Programmatic Cascade with `deleted_with_cascade` (§2.2) |
| **Standard `UNIQUE` constraint on `email`/`phone`** | Archived row permanently occupies unique slot; creating a new record with same email fails | Replace with `uniqueIndex(...).where(sql`deleted_at IS NULL`)` (§2.4) |
| **Restoring without uniqueness check & error trap** | Restoring a contact whose email is now owned by another active contact → 500 or duplicate | Pre-check uniqueness and catch PostgreSQL error `23505` mapping to 409 (§4.5) |
| **Cascade restore without `deleted_with_cascade` flag** | Restoring a parent cascades into restoring records that were independently archived | Add `deleted_with_cascade` column (§2.2); restore only flag-matched rows |
| **`scopeDeleted()` in new SQL-backed modules** | Full table loaded into Node.js memory, then filtered — catastrophic on large tenants | Filter at DB layer with `WHERE deleted_at IS NULL/NOT NULL` |
| **`SoftDeleteListFilter = 'all'` without tenant predicate on tenant endpoint** | Cross-tenant data leak — archived records from other tenants appear | Always pair `'all'` with `eq(table.workspaceSubdomain, tenant)` |
| **Parameterized boolean in query predicate** | `$2::boolean IS TRUE OR deleted_at IS NULL` disables Category B partial index | Construct dynamic AST branches in Drizzle (§2.7) |
| **Direct SQL `DELETE` without trigger bypass** | Fails with `check_violation` from `trg_forbid_hard_delete` | Use `UPDATE ... SET deleted_at = NOW()` or set `app.allow_hard_purge = 'true'` in purge job (§2.5) |
| **Omitting monotonic versioning on Outbox CDC events** | Rapid delete and restore actions processed out of order leave search index permanently desynchronized | Include monotonic `version` in outbox payload; discard stale events in consumer (§8) |
| **Inline `includeDeleted` ternary instead of `isQueryFlagTrue`** | `includeDeleted=True` or `includeDeleted=1` silently treated as `false` | Use `isQueryFlagTrue(query.includeDeleted)` everywhere |
| **Soft-deleting secrets / tokens / credentials** | Soft-deleted session tokens remain valid to an attacker with DB read access | Revoke/expire secrets immediately; do not soft-delete credential rows |
| **Unbounded single-transaction hard purge** | Purging thousands of rows in one query generates WAL spikes, long row locks, and blocks tenant writes | Chunk deletions using `LIMIT 500 FOR UPDATE SKIP LOCKED` with backoff pauses (§13.3) |
| **`purgeArchivedRecords` running inline in request handler** | Blocks the response thread; risks partial purge on timeout | Always run purge as a background job (§13) |
| **Not emitting audit event before hard purge** | No trace that the record ever existed after purge | Emit `entity.hard_purge` audit event inside the same transaction as the `DELETE` |

---

## 10. Architectural Deletion Taxonomy (4-Bucket Model)

To avoid ad-hoc decisions, every entity in the database is classified into one of four deletion buckets (modeled after GitHub enterprise standards):

| Bucket | Deletion Mechanism | Target Entities | Rationale & Lifecycle |
|---|---|---|---|
| **1. Soft-Delete (Audit & Recovery)** | `UPDATE SET deleted_at = NOW()` | `contacts`, `students`, `faculty`, `sessions`, `enrollments`, `finance_invoices`, `accounting_accounts` | High referential weight; user self-service restoration required; historical reporting and accounting continuity. |
| **2. Ephemeral Hard-Delete** | Standard SQL `DELETE` | `question_bank_tests`, `assessment_results`, join table edges, draft forms | Scratchpad data without independent lifecycle; no incoming FKs; absence represents desired state. |
| **3. Sweeper-Driven TTL Purge** | Scheduled background worker (`lte(purge_after, NOW())`) | `message_logs`, temporary upload artifacts, idempotency records, session tokens | Time-bounded operational data; purged after retention window (§13) to prevent storage and index bloat. |
| **4. Append-Only Immutable (Never Deleted)** | `DELETE` and `UPDATE` forbidden at DB layer | `audit_trail_events`, `accounting_entries`, hash chain partitions | Forensic source of truth; regulatory compliance; tamper-evident immutability. |

### Intentional Platform Workspace Exclusion
Platform tenant workspace teardown (`purgeTenantDataBySubdomain`) executes physical `DELETE` with explicit privilege escalation (`SET LOCAL app.allow_hard_purge = 'true'`) because tenant deletion is irreversible by contract.

---

## 11. Known Gaps (Open Work)

| Priority | Gap | Status / Resolution |
|---|---|---|
| Closed | Partial unique indexes on recyclable natural keys (`students.student_id`, `students.gr_number`, `faculty.employee_id`) — archived rows block re-registration | Resolved: DDL migration `0104_soft_delete_system_complete.sql` created partial unique indexes `WHERE deleted_at IS NULL` |
| Closed | `WHERE deleted_at IS NULL` partial indexes (Category B) on all soft-deletable tenant tables | Resolved: DDL migration `0104_soft_delete_system_complete.sql` created Category B partial indexes across all soft-deletable tables |
| Closed | `WHERE deleted_at IS NOT NULL` partial indexes (Category C) on trash-browser tables | Resolved: DDL migration `0104_soft_delete_system_complete.sql` created Category C partial indexes across all soft-deletable tables |
| Closed | `registerSoftDeletableBulkRoutes` drops `userId` on bulk restore — restore operations not attributed in DB | Resolved: passes `userId` to `bulkRestoreFn` in `crudBulkRouteFactories.ts` and `crudBulkRouteHelpers.ts` |
| Closed | No `deleted_with_cascade` column on `enrollments` — cascade restore from session restore cannot be distinguished from standalone archive | Resolved: `deleted_with_cascade` added to `enrollments` table and migration 0104; atomic cascade delete/restore implemented in `sessionsUseCases.ts` |
| Closed | `sessions.ts` and `finance.ts` parse `includeDeleted` inline with inconsistent ternaries | Resolved: normalized to `isQueryFlagTrue(query?.includeDeleted)` in `sessions.ts` and `finance.ts` |
| Closed | `captureDeletionReason: false` modules silently persist any client-supplied `deletionReason` | Resolved: stripped `deletionReason` in `crudResourceRoutes.ts` and `crudBulkRouteFactories.ts` when `captureDeletionReason: false` |
| Closed | Retention/hard-purge background worker and `forbid_hard_delete()` trigger | Resolved: `forbid_hard_delete()` trigger on all tenant soft-deletable tables with `app.allow_hard_purge` bypass; chunked background worker `purgeExpiredArchivedRecords` implemented in `apps/backend/src/worker/purgeArchivedRecordsJob.ts` |

---

## 12. Checklist: Adding Soft-Delete to a New Module

### Schema (Backend)
- [ ] Add `deletedAt`, `deletedBy`, `deletionReason` (varchar 500), `restoredAt`, `restoredBy`, `deletedWithCascade` via `softDeleteColumns` mixin
- [ ] Use `varchar('deletion_reason', { length: 500 })` — not `text` — to enforce the DB-layer length cap
- [ ] Assign `deletedAt`/`restoredAt` as `Date` objects, never ISO strings
- [ ] Add `(workspace_subdomain, deleted_at)` composite index (Category A — archive-mode)
- [ ] Add `(workspace_subdomain) WHERE deleted_at IS NULL` partial index (Category B — active-record)
- [ ] Add `(workspace_subdomain, deleted_at) WHERE deleted_at IS NOT NULL` partial index (Category C — trash browser)
- [ ] Replace any standard `UNIQUE` constraints on `email`, `phone`, `employee_id`, or slug with **partial unique indexes** scoped to `WHERE deleted_at IS NULL` (§2.4)
- [ ] Attach `BEFORE DELETE` trigger calling `forbid_hard_delete()` to prevent accidental SQL deletions (§2.5)
- [ ] Define PostgreSQL RLS policy `tenant_soft_delete_isolation` with `app.include_deleted` session gate (§2.6)
- [ ] If the module supports cascade soft-delete, verify `deleted_with_cascade boolean default false` column exists (§2.2)
- [ ] Write forward-only Drizzle DDL migration; never use `drizzle-kit push` against shared/prod DB

### `@mms/shared`
- [ ] Add `deletedAt?: Date | null`, `deletedBy?: string | null`, `deletionReason?: string | null`, `restoredAt?: Date | null`, `restoredBy?: string | null`, `deletedWithCascade?: boolean` to response type
- [ ] Add `softDelete` block (all six fields including `retentionDays`) to module manifest
- [ ] Verify write schema rejects all three soft-delete fields — add unit test
- [ ] Export `is[Entity]Deleted()` predicate helper

### Backend Routes
- [ ] Use `registerResourceRoutes` with `deleteFn` + `restoreFn`
- [ ] Use atomic conditional update (`WHERE deleted_at IS NULL RETURNING id`) to avoid TOCTOU race conditions (§4.1)
- [ ] Construct dynamic query ASTs (avoid parameterized boolean flags that break partial index usage) (§2.7)
- [ ] Add explicit `where: (c, { isNull }) => isNull(c.deletedAt)` filters to all nested relations in Drizzle `db.query` relational queries (§2.7)
- [ ] `bulkDeleteFn` / `bulkRestoreFn` use a **single batched SQL `UPDATE`** — not a per-row loop (§4.2 Performance Contract)
- [ ] For user/account entities: revoke active sessions and JWT tokens in Redis/auth store immediately upon soft-delete (§1.2)
- [ ] For user/account entities: verify `deletedAt IS NULL` in auth resolver and login routes to prevent account resurrection (§1.2)
- [ ] Enforce active foreign key guarding on writes: reject foreign key assignments pointing to soft-deleted entities (§1.8)
- [ ] Enforce referential integrity: implement Restrict Guard or atomic Programmatic Cascade (`deleted_with_cascade`) (§2.2)
- [ ] Lock parent row (`FOR UPDATE`) when cascading to prevent concurrent child insertions (§4.6)
- [ ] Implement `GET /:id` read semantics: default returns 404 for archived records; `?includeDeleted=true` requires `canDeleteCollection` check (§4.7)
- [ ] Use `registerSoftDeletableBulkTrashRoutes` for bulk operations
- [ ] Add `includeDeleted` support via `supportsIncludeDeleted: true` in `handleBulkListGet`
- [ ] Gate `includeDeleted = true` on `canDeleteCollection` check
- [ ] Wire `onAfterDelete` and `onAfterRestore` audit hooks; choose Option A or B from §8 and document it
- [ ] Emit outbox domain events `entity.soft_deleted` and `entity.restored` with monotonic versioning for CDC and search index eviction (§8)
- [ ] Trap PostgreSQL error `23505` on restore and return formatted `409 Conflict` (§4.5)
- [ ] If using cascade soft-delete, implement `deleted_with_cascade` restore filter (§2.2)
- [ ] Add integration tests for `DELETE /:id`, `POST /:id/restore`, `POST /bulk-delete`, `POST /bulk-restore`
- [ ] Verify `DELETE /:id` on already-archived record returns `404` (not 500)
- [ ] Verify `POST /:id/restore` on non-archived record returns `404` (not 500)
- [ ] Verify `POST /bulk-delete` with mixed active/archived ids reports correct `succeeded`/`failed` counts
- [ ] Verify creating a new record with the same email as an archived record **succeeds** (confirms partial unique index is in place)
- [ ] Verify restoring a record whose email is now owned by another active record returns `409`

### Frontend
- [ ] Add `viewingDeleted` state to page controller / directory filter hook, synchronized with URL search params (`?view=trash`) (§7.1)
- [ ] Map `viewingDeleted` → `includeDeleted` in TanStack Query key and URL builder
- [ ] Preserve active search query and filters when toggling `viewingDeleted` (§7.10)
- [ ] Mount `ModuleTrashToggle` in `ModuleWorkToolbar` (gated on `canDelete`)
- [ ] Wire `BulkSelectionDeleteAction` / `BulkSelectionRestoreAction` via `ModuleWorkBulkActionBar`
- [ ] Implement `[Module]ArchivedBanner` and render in detail drawer when `deletedAt != null`
- [ ] Display retention countdown badge in drawer and trash directory (`Expires in N days`) (§7.9)
- [ ] Implement optimistic soft-delete with 5–10s Undo toast for single-record delete (§7.8)
- [ ] Hide Add/Create CTA when `viewingDeleted = true`
- [ ] Hide Export CTA when `viewingDeleted = true` (if `exportsIncludeDeleted: false`)
- [ ] Guard `Cmd/Ctrl+N` shortcut: check `!viewingDeleted && canWrite`

### Verification
```bash
pnpm typecheck
cd apps/backend && pnpm lint
pnpm test  # run module-specific soft-delete integration test
```

---

## 13. Retention, Hard-Purge & GDPR Erasure

Soft-deleted records are retained indefinitely by default. For tables with compliance or storage hygiene requirements, a configurable retention window triggers a scheduled background hard-purge.

### 13.1 Archival Lifecycle & GDPR Article 17 Erasure

| Phase | Duration | Location | Recovery Mechanism |
|---|---|---|---|
| **Active** | 0–90 days post-delete | Main table (`deleted_at IS NOT NULL`) | Self-service restore via `POST /:id/restore` |
| **Cold Archival** | 90 days–retention limit | `{table}_archived` or cold partition | Platform admin restore tool |
| **Hard Purge** | Post-retention limit | — | Irreversible hard `DELETE` via background job |

#### The GDPR Right-to-Erasure Boundary: Crypto-Shredding + In-Place Pseudonymization
Soft-delete alone is **not** compliant with GDPR Article 17 (Right to Erasure) because personal data remains stored. Conversely, hard `DELETE` destroys foreign key integrity across accounting ledgers and attendance certifications.

**MMS Dual-Track Erasure Protocol:**
When a data subject exercises Right to Erasure, execute within an atomic transaction:
1. **Cryptographic Shredding:** Delete the subject's envelope encryption key in KMS/Vault. All encrypted custom fields (`custom_data`) become permanently undecipherable mathematical noise across both primary databases and immutable backups.
2. **In-Place Pseudonymization / Scrubbing:** Overwrite plain PII attributes with deterministic synthetic tokens so partial unique indexes no longer retain personal data (e.g. personal email addresses), while preserving the primary key for relational continuity:

```sql
-- GDPR Article 17 In-Place Erasure
UPDATE contacts
SET
  first_name = 'Anonymized',
  last_name = 'Subject',
  email = 'erased-' || id || '@deleted.local',
  phone = NULL,
  custom_data = '{}'::jsonb,
  deleted_at = NOW(),
  deletion_reason = 'GDPR Article 17 Erasure Request'
WHERE id = :id AND workspace_subdomain = :tenant;
```

3. **Metadata Purge:** Once legal financial retention limits expire, the background purge worker removes the remaining row metadata.

### 13.2 Schema & Indexing (`purge_after`)

Add to soft-deletable tables requiring automated lifecycle cleanup:

```ts
// Optional generated column (e.g. 90-day retention)
purgeAfter: timestamp('purge_after', { withTimezone: true, mode: 'date' })
  .generatedAlwaysAs(sql`deleted_at + INTERVAL '90 days'`),

// Partial index for planner-efficient worker queries
index('table_purge_after_idx')
  .on(table.purgeAfter)
  .where(sql`${table.deletedAt} is not null and ${table.purgeAfter} is not null`),
```

### 13.3 Background Purge Worker Architecture

The purge worker runs off-peak (e.g. daily at 02:00 UTC) as an isolated background task (`mms-background-jobs`) — never in HTTP request paths.

#### Worker Implementation (`apps/backend/src/worker/purgeArchivedRecordsJob.ts`)
To prevent lock contention, transaction exhaustion, and WAL spikes, deletions execute in **bounded chunks of 500 rows** using `FOR UPDATE SKIP LOCKED` with brief inter-chunk pauses:

```ts
import type { DbClient } from '@/db';
import { and, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { students, faculty, messageLogs, attendance } from '@/db/schema';
import { emitAuditEvent } from '@/audit';

const CHUNK_SIZE = 500;
const INTER_CHUNK_PAUSE_MS = 50;

export async function purgeExpiredArchivedRecords(
  db: DbClient,
  tenant: string,
  dryRun = process.env.DRY_RUN === 'true',
): Promise<{ purgedTables: Record<string, number> }> {
  const now = new Date();
  const results: Record<string, number> = {};

  const targets = [
    { table: messageLogs, name: 'message_logs' },
    { table: attendanceRecords, name: 'attendance_records' },
  ];

  for (const { table, name } of targets) {
    let totalPurged = 0;

    if (dryRun) {
      const count = await db.$count(table, and(
        eq(table.workspaceSubdomain, tenant),
        isNotNull(table.deletedAt),
        lte(table.purgeAfter, now),
      ));
      results[name] = count;
      continue;
    }

    // Chunked lock-free purge loop
    while (true) {
      const chunkPurgedCount = await db.transaction(async (tx) => {
        // 1. Bypass BEFORE DELETE trigger within this worker transaction
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);

        // 2. Select batch of IDs using SKIP LOCKED to prevent transaction contention
        const candidates = await tx
          .select({ id: table.id })
          .from(table)
          .where(and(
            eq(table.workspaceSubdomain, tenant),
            isNotNull(table.deletedAt),
            lte(table.purgeAfter, now),
          ))
          .limit(CHUNK_SIZE)
          .for('update', { skipLocked: true });

        if (candidates.length === 0) return 0;

        const ids = candidates.map((c) => c.id);

        // 3. Emit tamper-evident audit trail record inside transaction
        await emitAuditEvent(tx, 'entity.hard_purge', {
          tenant,
          table: name,
          count: ids.length,
          purgedIds: ids,
        });

        // 4. Physical hard delete of bounded chunk
        await tx.delete(table).where(inArray(table.id, ids));

        return ids.length;
      });

      totalPurged += chunkPurgedCount;

      // Exit loop if no rows remained or batch was partial
      if (chunkPurgedCount < CHUNK_SIZE) break;

      // Yield event loop to allow concurrent read/write transactions to proceed
      await new Promise((resolve) => setTimeout(resolve, INTER_CHUNK_PAUSE_MS));
    }

    results[name] = totalPurged;
  }

  return { purgedTables: results };
}
```

#### Production Deployment & Safeguards
- **Tenant Scoping**: All purge queries filter by `workspaceSubdomain = tenant`. Global cross-tenant purge deletes are banned.
- **Node.js 24 Execution**: Run directly via native `--experimental-strip-types` (e.g. `node --experimental-strip-types src/worker/index.ts`). No legacy dev transpilers (`ts-node-dev`).
- **Audit-First Invariant**: Emit `entity.hard_purge` inside the transactional boundary before records are deleted.
- **Dry-Run Mode**: Setting `DRY_RUN=true` logs targeted row counts without executing `DELETE`.
- **Metrics**: Exposes Prometheus counters `purge_job_executed_total` and `purge_job_deleted_rows_total`.

### 13.4 Module Manifest Retention Matrix

Declared per module in `@mms/shared` manifests:

| Module | `retentionDays` | Rationale |
|---|---|---|
| `contacts` | `null` | Audit & financial linkage — keep indefinitely |
| `students` | `null` | Academic history & certification continuity |
| `faculty` | `null` | Employment history & payroll continuity |
| `attendance_records` | `null` | Regulatory accreditation requirement |
| `message_logs` | `365` | Operational delivery hygiene — 1-year hard purge |

### 13.5 Status & Next Steps
- [x] Manifest `softDelete.retentionDays` schema declared in `@mms/shared`.
- [x] DDL migration `0107` — `purge_after` generated column (`deleted_at + INTERVAL`) on `message_logs` (365 days) and `attendance` (3650-day sentinel) with planner-efficient partial indexes (`migration 0107_autovacuum_high_churn_tables`).
- [x] Autovacuum tuning (`autovacuum_vacuum_scale_factor = 0.05`, `autovacuum_vacuum_cost_limit = 1000`) applied to `message_logs` and `attendance` via migration `0107`.
- [x] Implement `purgeExpiredArchivedRecords` worker in `apps/backend/src/worker/` — uses DB-level `purge_after` predicate to hit partial index rather than application-side cutoff arithmetic.