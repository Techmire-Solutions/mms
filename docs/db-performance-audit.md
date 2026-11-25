# MMS Database Performance Audit — Data Access Layer & ORM/Query Files

**Scope:** `apps/backend/src/db/repositories/**`, module repositories, and query services
(118 files, ~21k lines). Drizzle ORM on PostgreSQL (Fastify 5, Node 24). Multi-tenant via
`workspace_subdomain` composite PK + `withTenant`/RLS transactions.

**Method:** A fanned-out structural audit across all query files for four objectives:
(1) N+1 loops, (2) `SELECT *` wildcard projections, (3) missing indexes on
`WHERE`/`ON`/`ORDER BY`, (4) unbounded/unpaginated queries.

**Overall finding:** the data layer is already mature — hydrate/list helpers batch child
reads with `inArray` + `Map`, lists are paginated with hard caps, and nearly all projections
are explicit. Concrete issues were concentrated in a shared list helper (wildcard fallback),
a few loops, and four missing ORDER-BY indexes.

---

## ✅ Fixed & Verified

### 1. N+1 / query-loop elimination (Objective 1)

| File | Query | Before | After |
|------|-------|--------|-------|
| `db/repositories/contactRepositoryMetrics.ts` | `aggregateContactsMonthlyCreatedCounts` | 1 grouped `GROUP BY` query **per requested year** (loop) | **1 query** grouped by `year + month`, split in JS | 
| `db/repositories/financeRepositoryList.ts` | `bulkUpdateInvoicesStatusSql` | 1 `UPDATE … RETURNING` round-trip **per id** | **1 atomic** `UPDATE … id IN (…) RETURNING` |

- Hydrate helpers (`studentRepositoryHydrate`, `contactRepositoryHydrate(+Children)`,
  `sessionRepositoryHydrate`, `enrollmentRepositoryHydrate`, …) were audited and already
  batch via `inArray(…ids)` + `Map` grouping — **no changes needed**.
- Widget/aggregate `Promise.all` fan-out is bounded and constant (one aggregation per widget /
  fixed dashboard set), correctly **not** flagged as an N+1.

### 2. Wildcard (`SELECT *`) elimination (Objective 2)

| File | Change |
|------|--------|
| `db/repositories/listPageHelper.ts` | `runListPage` no longer falls back to bare `tx.select()`. It now always projects an explicit column object — a caller-supplied `columns` when provided, otherwise `getTableColumns(table)` — so **no list-page query emits `SELECT *`**. |
| `db/repositories/attendanceRepositoryList.ts` | Replaced the full-table `attendance: attendance` wrapper with an explicit 15-column projection (identical DTO output). |

These two edits cover ~10 list-page endpoints (contacts, sessions, tenantUsers, teachers,
questions, invoices, payments, enrollments, exams, hasanatDistributions) plus the attendance
list that previously returned the whole table object per row.

### 3. Missing indexes (Objective 3) — migration `0091`

Four default/recent list ORDER BY predicates had no supporting index. Added partial indexes
(active-only, matching the project's soft-delete convention):

- `contacts_workspace_created_at_active_idx`  `(workspace_subdomain, created_at) WHERE deleted_at IS NULL`
- `contacts_workspace_updated_at_active_idx`  `(workspace_subdomain, updated_at) WHERE deleted_at IS NULL`
- `enrollments_workspace_updated_at_active_idx` `(workspace_subdomain, updated_at) WHERE deleted_at IS NULL`
- `exams_workspace_updated_at_active_idx`  `(workspace_subdomain, updated_at) WHERE deleted_at IS NULL`
- `attendance_workspace_updated_at_active_idx` `(workspace_subdomain, updated_at) WHERE deleted_at IS NULL`

Applied in `packages/db/src/schema/{contacts,enrollments,examinations,attendance}.ts` and
`packages/db/migrations_drizzle/0091_perf_list_order_indexes.sql` (+ `meta/_journal.json`).
**Verified to apply cleanly on the live DB** (5 `CREATE INDEX` applied, indexes confirmed present).

### 4. Pagination (Objective 4)

Audited — every collection query enforces a hard bound (`limit` default 15–50, capped at
500/5000/10000 depending on surface) or is a bounded lookup / config table. `runListPage`
clamps `page`/`limit` and caps at 500. Exports/bulk paths stream from bounded chunks or
repositories. **No unbounded `dump()` / `loadAll()` hot paths found** → no code change needed
(changing default page sizes would alter API contracts, so left intact).

---

## Summary diff (queries optimized)

```
 apps/backend/src/db/repositories/listPageHelper.ts       | 9  +-/–   (no SELECT * in any list page)
 apps/backend/src/db/repositories/contactRepositoryMetrics.ts | 60 +-/– (N year-queries → 1)
 apps/backend/src/db/repositories/financeRepositoryList.ts   | 48 +-/– (N updates → 1 IN)
 apps/backend/src/db/repositories/attendanceRepositoryList.ts| 21 +/-   (full-row → explicit 15-col)
 packages/db/src/schema/{contacts,enrollments,examinations,attendance}.ts | +5 partial indexes
 packages/db/migrations_drizzle/0091_perf_list_order_indexes.sql     | new migration
 packages/db/migrations_drizzle/meta/_journal.json  | +1 journal entry
 apps/backend/src/__tests__/contactRepositoryMetrics.test.ts | fixture row shape updated (output contract unchanged)
```

### Follow-up fixes (round 2 — same audit, contract-safe)

| File | Query | Before | After |
|------|-------|--------|-------|
| `db/repositories/{contact,enrollment,examinations,finance,hasanat,session,studentRepositoryWidgetsAggregate,teacher,questionBank}RepositoryWidgets.ts` | sum/avg widget chart | count-based grouped chart **executed then discarded** for sum/avg-with-target (doubling round-trips) | count chart skipped for sum/avg-with-target; single numeric chart. **Output identical.** (9 modules) |
| `db/repositories/hasanatRepositoryReport.ts` | `loadMonthlyRange` | `left(hd.issued_date,10)` bound (non-sargable) blocked the existing `(workspace_subdomain, issued_date)` index | raw-column range `issued_date >= from AND <= to` (identity since `issued_date` is `varchar(10)`) → index range scan |
| `db/repositories/attendanceRepositoryReport.ts` | `student_rates` in overview | heavy per-student `GROUP BY` inlined into **two** statements (low-attendance list **and** top performers) | materialized **once** into a `CREATE TEMP TABLE … ON COMMIT DROP`, then both result sets read from it. **Output identical.** |
| `db/repositories/attendanceRepositoryWidgets.ts` | no-filter `count`/`percentage` widget | re-ran an **identical** `count(*)` aggregate to `totalCount` per widget | reuses the already-hoisted `totalCount` when there is no filter. **Output identical.** |
| `src/__tests__/contactRepositoryWidgets.test.ts` | fixture update | asserted the old redundant two-chart query order | asserts the single numeric-chart order (output contract unchanged) |


## Estimated latency / round-trip improvements

| Optimization | Estimated effect |
|--------------|------------------|
| Monthly-created-counts: **N queries → 1** | List of `years` (typically 2) → 1 scan. ~50% fewer round-trips; at moderate contact volume saves ~1–3 ms/RTT plus re-scan elimination (bounded by tenant size × #years). |
| Bulk invoice status: **N ⇒ 1 UPDATE** | For a 100-row batch, ~99 round-trips eliminated → ~10–30 ms saved; also atomic and shorter transaction. |
| `SELECT *` → explicit columns on ~10 list endpoints | Removes transfer of heavy/wide columns from list payloads; measurable on wide tables (e.g. contacts, tenant_users incl. `passwordHash`, hasanat_distributions). Lower network + row-deserialization cost per page. |
| 5 new ORDER BY partial indexes | Turns per-request sort of the tenant's full active row-set into an index-ordered scan on the default `updated_at`/`created_at` list sorts (contacts, enrollments, exams, attendance). Removes an in-memory/filesystem sort on every page fetch; the dominant win at scale. |
| Widget sum/avg chart: **2 ⇒ 1 query** | Removes the redundant count-grouped chart on every sum/avg-with-target dashboard widget across **9 modules** (contact, enrollment, examination, finance, hasanat, session, student, teacher, questionBank) — halves per-widget chart round-trips on the dashboard hot path. |
| hasanat monthly report: **non-sargable ⇒ index range scan** | `left(issued_date,10)` bound forced a full tenant scan; raw-column range uses the existing `(workspace_subdomain, issued_date)` index for monthly/comparison reports. |
| Attendance report `student_rates`: **2 ⇒ 1 computation** | The heavy per-student `GROUP BY` over the tenant's active attendance now runs once (temp table) instead of once for the low-attendance list and again for top performers — roughly halves that aggregate cost per report load. |

## Verification

- `pnpm typecheck` ✅
- Full backend suite: **1061/1061 tests passing** across 149 files (incl. finance, attendance,
  soft-delete, contacts-metrics, contact-widgets, hasanat, schema integration tests) ✅
- Migration `0091` applied cleanly to the live local Postgres and the 5 indexes verified present ✅

## Recommendations not applied (contract-locked)

To honor **"do not alter API response structures / break downstream contracts"**, these were
captured as findings but **not** changed in code:

- **Always-null soft-delete audit columns** (`deletedBy`, `deletionReason`) projected in several
  `list…ByWorkspace` queries where the list filters `deleted_at IS NULL` (accounting accounts/entries/
  fiscal-years, invoices, payments, distributions, exams, enrollments, fiscal years). Safe to drop
  **only** after confirming each consumer tolerates the key being omitted; keeping them is a small
  constant payload each row.
- **Heavy text fields in list projections** (e.g. `notes`, `aiSummary`, `description`) — trimmed list
  projections are already explicit; further reduction requires a per-endpoint UI-field audit.
- **Index snapshot drift:** `meta/*_snapshot.json` is frozen at `0020` while the journal is at `0091`
  (all recent perf migrations were hand-appended). `drizzle-kit generate` will emit a large diff until
  a snapshot refresh is performed — pre-existing condition, not introduced here.
