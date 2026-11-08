# Attendance Schema & Persistence Audit — 2026-11-08

**Scope:** the Attendance persistence layer — Drizzle table definitions, constraints, the
`0218` migration history, the foreign-key graph through students / session classes / sessions /
terms, soft-delete and optimistic concurrency in
`apps/backend/src/db/repositories/attendanceRepository*.ts`, and the guards that protect them.

**Method:** read the table definition (`attendance.ts`), every migration that touches
`attendance` (0000 → 0217), the latest Drizzle snapshot (`meta/0217_…_snapshot.json`), both
repository modules, the use-cases, both contract handlers, and the guards
(`scripts/check-migration-indexes.mjs`, `.agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh`).
Verified against PostgreSQL semantics (partial-index inference, RLS `USING`/`WITH CHECK`,
`ON CONFLICT` row locking).

**Overall finding:** the *shape* of the attendance schema is sound — composite tenant keys
throughout, FORCE RLS, a partial unique index on the right business key, and a solid 3-tier
soft-delete index set. The defects were in the **seams**: the upsert targeted the surrogate id
instead of the business key (a 500 on a normal second device), the table had no concurrency
token, three soft-delete columns existed in the database but not in the ORM, and restore
collisions surfaced as 500s. All are fixed in this change set; the deferred item is recorded
below.

## Brief → code mapping

The request named `tenant_id / section_id / student_id / attendance_date`. The real names differ,
and one requirement is deliberately **not** met:

| Brief | Actual column | Note |
|---|---|---|
| `tenant_id` | `workspace_subdomain` | composite tenant key + FORCE RLS; every FK is tenant-composite, so cross-tenant references are impossible |
| `student_id` | `student_id varchar(64)` | |
| `attendance_date` | `date_on` (`date`), mapped as `date` | since 0181/0182 |
| `section_id` | `section_id text` | **stamped** attribute, not part of the unique key |
| `terms` | via `session_classes.session_id → sessions.category_id → session_categories` | there is no `terms` table; a "term" is a session category |

**Attendance grain = one row per (workspace, class, student, day).** There is no period-level
register anywhere in the attendance path (`period_id` never appears). `section_id` is deliberately
excluded from the unique key: it records the student's section *on the attendance date*
(`attendanceSectionStamp.ts`), so a mid-term section transfer must not permit a second mark for the
same day. Adding `section_id` to
`attendance_workspace_class_student_date_on_uidx` would re-open duplicate daily attendance — the
index now carries a comment saying exactly that, and a DB test asserts the section never enters the
index definition.

## Index inventory (`attendance`)

| Index | Columns | Predicate | Role |
|---|---|---|---|
| `attendance_workspace_class_student_date_on_uidx` | workspace, class, student, date_on | `deleted_at IS NULL` | **the only integrity index** — one mark per student/day |
| `attendance_workspace_class_date_on_active_idx` | workspace, class, date_on | active | marking grid, coverage |
| `attendance_workspace_class_date_on_status_active_idx` | + status | active | KPIs |
| `attendance_workspace_date_on_idx` | workspace, date_on | — | date range scans |
| `attendance_workspace_student_idx` | workspace, student_id | — | student history |
| `attendance_workspace_section_idx` | workspace, section_id | — | section coverage (FK support) |
| `attendance_workspace_status_idx` | workspace, status | — | status filter |
| `attendance_workspace_updated_at_active_idx` | workspace, updated_at | active | default list sort |
| `attendance_workspace_active_idx` | workspace | active | count/list |
| `attendance_workspace_deleted_idx` | workspace, deleted_at | — | Category A — **redundant**, see F11 |
| `attendance_workspace_deleted_records_idx` | workspace, deleted_at | deleted only | Category C (trash scan) |
| `attendance_purge_after_idx` | workspace, purge_after | deleted + purge set | purge worker |

## Findings

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| F1 | **Critical** | `ON CONFLICT` targeted the surrogate PK `(workspace, id)`, not the business key. A save carrying a new id for an existing student/day hit the partial unique index instead → `23505` → HTTP 500 for the whole bulk batch. **Reproduced in the real UI path:** the marking grid builds `id: `${classId}-${date}-${studentId}`` (`markAttendanceRowUtils.ts:59`) while `POST /api/attendance` stores `att-<uuid>`, so the first save from one client and the next save from the other collide on the business key under different ids — a guaranteed 500, not a theoretical one. | `attendanceRepository.ts:100-102`, `:140-142` (before); index at `attendance.ts:56-58`; grid id at `apps/frontend/src/tenant/features/attendance/lib/markAttendanceRowUtils.ts:59` | **Fixed** — natural-key arbiter (`targetWhere` = the partial index predicate) |
| F2 | **High** | No optimistic-concurrency token. Two instructors editing one roster silently overwrote each other; `updated_at` moved but nothing let a caller detect the lost update. | attendance had no `version`; compare `sessionCoreTables.ts:50`, `:170` | **Fixed server-side** — `version` + per-row OCC + `409 stale_write`. The marking grid does not echo the token yet (see follow-ups), so grid-vs-grid races remain last-writer-wins until it does. |
| F3 | **High** | Soft-delete sextuple incomplete. `0108` added `restored_at`, `restored_by`, `deleted_with_cascade`; the Drizzle table never declared them, so they were absent from every snapshot, unreadable by the ORM, and restores were unattributable (`_userId` was discarded). | `attendance.ts:44-46`; `0108_soft_delete_schema_rls_and_triggers.sql:126-128` | **Fixed** — `softDeleteColumns` + restore stamping |
| F4 | **High** | Restore collision returned 500. Restoring a trashed mark while a live mark existed for the same day violated the partial unique index; the `23505`→409 mapping in `genericRelationalService` is bypassed because attendance supplies `bulkRestore`. | `genericRelationalService.ts:191-205` vs `attendanceRepository.ts:248-264` (before) | **Fixed** — `NOT EXISTS` guard + `23505` → 409 |
| F5 | **Medium** | Concurrent bulk upserts could deadlock (`40P01`): `ON CONFLICT DO UPDATE` locks rows in array order, and two staff saving the same roster in different sort orders lock the same rows in opposite order. | `bulkSaveAttendanceRecords` (before) | **Fixed** — deterministic business-key order |
| F6 | **Medium** | `attendance.status` had no CHECK, which is why reports defensively `lower(trim(...))` it. A typo'd status silently drops a row out of every present/absent rate. | `attendance.ts:38`; `attendanceReportOverview.ts:15` | **Fixed** — `attendance_status_check` (skip-with-warning path) |
| F7 | **Medium** | `section_id` is not constrained to belong to `class_id`: the FK targets `(workspace, section_id)` only, so a section from another class in the same workspace is representable. | `attendance.ts:80-84` | **Deferred to 0219** — see below |
| F8 | **Medium (ops)** | `attendance` was absent from the large-table ratchet, so a future in-migration `CREATE INDEX` would write-lock the highest-row-count academic table — even though every historical attendance index on a populated database was built out of band. | `scripts/check-migration-indexes.mjs:39-52` | **Fixed** — table covered from migration 0218 forward (`LARGE_TABLES_SINCE`), so the 19 historical statements are grandfathered and `BASELINE` stays at 174 (the anti-padding guard forbids raising it — and raising it would also hide new violations on tables that were already covered) |
| F9 | **Medium (gate)** | The soft-delete schema verifier **exited 1 on `main`**: its target list named barrel modules (`contacts.ts`, `sessions.ts`) and a nonexistent `financeInvoices.ts`, and never checked `attendance.ts` — which is how F3 drifted for four releases. | `.agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh:24-34` | **Fixed** — real table modules, `attendance.ts` included |
| F10 | **Low** | Drizzle relations modelled only `workspace` + `student`, leaving `attendance_class_fk` and `attendance_section_fk` half-represented. | `relations/academicRelations.ts:24-33` | **Fixed** — `sessionClass` + `section` |
| F11 | **Low** | `attendance_workspace_deleted_idx` is redundant: the Category A partial and Category C partial cover both halves, so the full index is pure write amplification on the hottest academic table. | `attendance.ts:86` vs `:59-61`, `:90-92` | **Deferred** — drop via `DROP INDEX CONCURRENTLY`, out of band |
| F12 | **High (pre-existing)** | Soft-delete/restore under the provisioned RLS role silently matched zero rows: `tenant_soft_delete_isolation` hides `deleted_at IS NOT NULL` unless the transaction sets `app.include_deleted`, and nothing did. | `tenantTransactionGuards.ts`; precedent + explanation in `enrollmentRepositoryPersist.ts:250-252` | **Fixed** — `enableIncludeDeleted` on both trash paths |

## Locking & concurrency model

- Every attendance write runs inside `withTenant` → one transaction, `app.current_tenant` +
  `app.rls_bypass = 'off'`, statement/idle timeouts. Isolation is READ COMMITTED.
- **Lost updates** are prevented by `version`, not by row locks: the `ON CONFLICT … DO UPDATE …
  WHERE attendance.version = excluded.version` predicate makes the OCC check part of the same
  atomic statement, so there is no read-then-write window. A skipped row aborts the whole batch
  (transaction rollback), so a partial roster is never persisted.
- **Silent no-ops are impossible.** Legacy rows carry no token, so their bucket uses
  `WHERE deleted_at IS NULL` instead; a row archived between the index probe and the update is
  therefore skipped, and the `RETURNING` count mismatch turns that into a 409 rather than a success
  toast for a save that wrote nothing.
- **Deadlocks** are prevented by deterministic ordering. `ON CONFLICT DO UPDATE` acquires row
  locks as it encounters conflicts; sorting by business key means every writer walks the same
  sequence.
- **Duplicates** are prevented by the partial unique index, which is also the conflict arbiter —
  there is now exactly one source of truth for "what makes a mark unique".
- Row-lock (`FOR UPDATE`) is deliberately *not* used: it would serialize every roster save on the
  whole class and buy nothing the version predicate does not already give.

## Changes landed

**Schema** — `apps/backend/src/db/schema/attendance.ts`: `...softDeleteColumns`; `version integer
NOT NULL DEFAULT 1`; `attendance_status_check`; comments pinning the section-exclusion decision.

**Migration** — `apps/backend/src/db/migrations_drizzle/0218_attendance_integrity.sql` +
`meta/0218_attendance_integrity_snapshot.json` + journal entry `idx: 218`. Idempotent
(`ADD COLUMN IF NOT EXISTS`), `SET LOCAL lock_timeout = '2s'`, casing normalization before the
CHECK, and a 0207-style skip-with-warning when a tenant carries an unrecognised status.
**Hand-authored, reviewed exception** (mms-schema-migrate §2): `drizzle-kit generate` is blocked by
the pre-existing snapshot-chain collision (`0216`/`0217` share a parent) recorded in
`docs/open-items.md`; the snapshot is a patched copy of `0217`.

**Persistence** —
`db/repositories/attendanceUpsert.ts` (new): business key, upsert target/set, OCC predicate, and
`planAttendanceUpsert` (dedupe by key → deterministic order → id-collision validation).
`db/repositories/attendanceRepositoryTrash.ts` (new): trash/restore/replace, now with
`enableIncludeDeleted`, restore provenance, and collision handling.
`db/repositories/attendanceRepository.ts`: natural-key upserts returning persisted rows,
`23505` → 409; the unused hard-delete helper `deleteAttendanceRecord` was removed.

**Contracts** — `packages/shared/src/attendance/attendanceModuleManifest.ts`: `version`,
`restoredAt`, `restoredBy`, `deletedWithCascade` on the record schema (it is `.strict()`, so an
undeclared field would reject the bulk payload).

**API** — `PATCH /api/attendance/:id` accepts optional `x-expected-version` (sessions use the same
header; attendance keeps it optional so a token-less grid still saves). `PUT /api/attendance/bulk`
uses the per-row `version` echoed from the list response. A lost race is `409` with
`type: "stale_write"`.

## Verification

- `pnpm --filter mms-backend exec vitest run` — 431 files / 2915 tests green.
- `pnpm --filter mms-frontend exec vitest run src/tenant/features/attendance` — 54 files / 90 tests.
- `pnpm typecheck` (backend + shared + frontend).
- `node scripts/check-migration-indexes.mjs` — 193 (baseline 193), attendance covered.
- `node scripts/check-migration-hygiene.mjs` — lock_timeout / timestamptz / snapshot chain all held.
- `node scripts/check-migrations-forward-only.mjs` — no applied migration modified.
- `node scripts/check-code-norms.mjs` — 300-line ceiling held (new modules split at 225 / 169 / 122).
- `bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh` — now exits 0.
- `pnpm --filter mms-backend test:db` (CI, real Postgres) —
  `attendanceIntegrityDb` and `attendanceConcurrencyDb` suites; the latter is also repeated by
  `pnpm --filter mms-backend test:db:concurrency`.

## Accepted risks (reviewed, no change)

| Topic | Why accepted |
|---|---|
| `attendance_student_fk ON DELETE CASCADE` (`0068:62-66`) | Deliberate erasure semantics: purging a student removes their marks. Certified evidence is already frozen by `forbid_certified_evidence_change` (`0207:219-222`), and the sanctioned purge deletes `attendance` before `students` (`purgeSelectedModulesAllowlist.ts:51-53`, `:78-80`). Switching to RESTRICT would risk tenant-wipe cascade ordering for no data-safety gain. |
| No FK/CHECK binding `date_on` to the session window | Enforced by `assertInstructionalDays` (`instructionalDayGuard.ts:63`) with an audited `allowExtraClassOnHolidays` override. A DB trigger would fire on the hottest academic table for a genuinely configurable policy. |
| `marked_by` has no FK to users | Consistent with `students.created_by`; actor columns are deliberately unconstrained so a platform actor can be recorded. |
| `attendance_leaves` has no soft-delete columns and no status CHECK | Administrative rows with their own lifecycle; `attendance_leaves_date_range_check` (0172) covers the temporal invariant. Recorded for a follow-up, out of this change. |
| `replaceAttendanceRecordsForWorkspace` hard-deletes | Reachable only through the backup/restore mirror, which sets `app.allow_hard_purge = 'true'` (`dbSyncRestoreService.ts:126`) and is blocked by `trg_attendance_forbid_hard_delete` otherwise. |

## Deferred: 0219 (opt-in)

**F7 — a section must belong to its class.** Needs a new unique index on a live table, so it is a
separate, gated change:

1. `CREATE UNIQUE INDEX CONCURRENTLY session_class_sections_ws_class_id_uidx ON
   session_class_sections (workspace_subdomain, class_id, id)` — via
   `pnpm --filter mms-backend index:concurrent`, in a new
   `attendance_integrity_concurrent_indexes.sql`.
2. Repair mismatched stamps: repoint `attendance.section_id` from the student's enrollment in that
   class, else `NULL`; report the count.
3. Replace the FK:
   `attendance_section_fk (workspace_subdomain, class_id, section_id) →
   session_class_sections (workspace_subdomain, class_id, id) ON DELETE RESTRICT`,
   added `NOT VALID` then `VALIDATE` (non-blocking).
4. Mirror in `attendance.ts` and regenerate the snapshot.

Prerequisite audit query (must return 0 rows first):

```sql
SELECT a.workspace_subdomain, a.class_id, a.section_id, count(*)
  FROM attendance a
  JOIN session_class_sections s
    ON s.workspace_subdomain = a.workspace_subdomain AND s.id = a.section_id
 WHERE s.class_id <> a.class_id
 GROUP BY 1, 2, 3;
```

**F11 — drop `attendance_workspace_deleted_idx`** out of band:
`DROP INDEX CONCURRENTLY IF EXISTS attendance_workspace_deleted_idx;`

## Follow-up observations (outside this audit)

- **The marking grid still opts out of OCC.** `attendanceRecordsFromRows`
  (`apps/frontend/src/tenant/features/attendance/lib/markAttendanceRowUtils.ts:58`) rebuilds each
  record from the row and drops `version`, so the bulk save lands in the legacy bucket. Adopting OCC
  in the UI needs one extra step: return the persisted rows from `persistBatch` and merge their
  `version` back into the grid state (`useMarkAttendancePersistence` currently has no row setter).
  Without that merge, a draft-then-submit double save from the same user would 409 on its own write —
  which is why the change was deliberately not half-done here.
- **Trash visibility is systemic, not attendance-specific.** F12 exists because no generic path sets
  `app.include_deleted`; enrollment worked around it locally. Every module with a trash directory
  needs the same audit — the cleanest fix is a `withTenant(..., { includeDeleted: true })` option in
  `tenantTransactionGuards`.
- **Snapshot chain.** `drizzle-kit generate` remains blocked for the whole repository until the
  0133→0196 regeneration in `docs/open-items.md` lands. Until then every schema change is a
  hand-authored migration + patched snapshot.
