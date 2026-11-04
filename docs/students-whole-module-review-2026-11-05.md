# Students Whole-Module Review — Critical Fixes, Refactors, and Unused Code (2026-11-05)

End-to-end read-only review of the **students module** — shared contracts/validation, Fastify backend, SQL
layer, React frontend — on the current working tree (`HEAD a51ae8bd5` plus this session's uncommitted
students review fixes). Organised as requested: **Critical Fixes** (with diffs), **Recommended Refactors**,
and **Unused Code Candidates** (listed only — nothing deleted).

**No production file was changed by this review.** Everything below is a proposal; the only writes are this
document and its `docs/README.md` index row.

## 0. Provenance and baseline

| Item | Value |
| --- | --- |
| HEAD | `a51ae8bd5` (students backend unchanged since round 4; students frontend includes the 2026-11-04 UI/UX fixes, uncommitted) |
| Dirty tree | 460+ paths; a concurrent process is editing dashboards, messaging, contacts, i18n packs and `index.css` |
| Students paths in the tree | 29 modified/new (prior review rounds + UI/UX fixes), all intentional |
| Backend students suite | `pnpm --filter mms-backend test student` → **32 files / 235 tests pass** |
| Frontend focused suite | `src/tenant/features/students src/components/app src/components/reports` → **170 files / 658 tests pass** (one transient worker failure during concurrent edits; clean rerun) |
| Full frontend suite | 4,219 pass, **2 failures outside this module** — `printStyles.test.ts` (`header` removed from the print hide list in the concurrently edited `index.css`) and `testAssertionSpecificity.test.ts` (286 vs baseline 283; the 3 new `toBeDefined` calls are in concurrently edited contacts tests) |
| Cold typecheck | `tsc -p apps/frontend/tsconfig.json` (fresh buildinfo) → **pass**; backend typecheck pass |
| Gates | code-norms, frontend-structure, shared-ui, BiDi (3,949 files), i18n parity (9,593 keys), docs → **pass** |
| axe / Playwright | **not run** (no stack) |

Method: production-path tracing (route → module gate → handler → use case → repository/SQL), targeted
concurrency/error-path reading, and a repo-wide export-reference scan (`§4`). Prior-round findings that this
session already fixed (gender sentinel, notes wipe, report double-container, setup dialog, KPI states, GR
chunk loop, overlay-aware shortcuts, failure semantics, …) are **not re-reported**.

---

## 1. Critical Fixes

### C1 — Reports export crashes on any non-200 list response (and mislabels its own cap)

**Where:** `apps/frontend/src/tenant/features/students/hooks/useStudentsListQueries.ts:27-39`
**Root cause:** the imperative page-walk reads the ts-rest envelope without `assertContractOk`. On 403/500
the body is `{type,message}`; `studentsPage.students` is `undefined`, and `all.push(...undefined)` throws
`TypeError: undefined is not iterable`. The user sees a JS error instead of the server message. The cap error
is hardcoded English claiming 100,000 rows while `200 × maxPageSize(100)` = 20,000.
**Impact:** the Reports → export students path is unusable whenever the list query fails (permission revoked
mid-session, 500, offline), and the one guard message that does surface is wrong and untranslated.
**Fix (unified diff):**

```diff
--- a/apps/frontend/src/tenant/features/students/hooks/useStudentsListQueries.ts
+++ b/apps/frontend/src/tenant/features/students/hooks/useStudentsListQueries.ts
@@
 import { STUDENTS_MODULE_MANIFEST, type Student, type StudentsListQuery } from "@mms/shared";
 import { apiContract, tsrClient } from "@/lib/api";
+import { assertContractOk } from "@/lib/apiContractError";
 import { useQuery } from "@tanstack/react-query";
@@
 ): Promise<StudentRecord[]> {
   const limit = STUDENTS_MODULE_MANIFEST.maxPageSize;
+  const maxPages = 200;
   const all: StudentRecord[] = [];
@@
     const response = await apiContract.students.list({ query: listQuery });
+    assertContractOk(response, "Failed to export students");
     const studentsPage = response.body as StudentsListPageResult;
-    all.push(...(studentsPage.students as StudentRecord[]));
-    total = studentsPage.total;
+    all.push(...((studentsPage.students ?? []) as StudentRecord[]));
+    total = studentsPage.total ?? 0;
     onProgress?.(all.length, total);
     if (!studentsPage.hasMore) break;
-    if (page >= 200) {
+    if (page >= maxPages) {
       throw new Error(
-        "Student export exceeds the 100,000-record safety limit; narrow the filters.",
+        `Student export exceeds the ${maxPages * limit}-record safety limit; narrow the filters.`,
       );
     }
```

**Pinning test:** mock `apiContract.students.list` to `{ status: 403, body: { type: "forbidden", message: "Insufficient permissions" } }` → expect a rejection carrying that message, never a `TypeError`; and a 201-page walk rejecting with `200 × maxPageSize`.

### C2 — Bulk soft-delete counts, cascades and audits rows the `UPDATE` never wrote

**Where:** `apps/backend/src/students/use-cases/studentSoftDeleteUseCases.ts:46-116`,
`apps/backend/src/db/repositories/studentRepositorySoftDelete.ts:11-46`,
`apps/backend/src/students/repository/studentsRepository.ts:113-118`
**Root cause:** the work set is decided from a pre-read (`findByIds`) and the SQL's own result
(`{succeeded, failed}` from `RETURNING`) is discarded. A row soft-deleted/restored by a concurrent writer
between read and update is not matched by `isNull(deletedAt)`, yet this request still reports it deleted,
re-runs the enrollment cascade over it, and appends an `entity.soft_deleted` outbox event plus a `DELETE`
audit row stamped with this caller.
**Impact:** fabricated deletion evidence in the audit chain and duplicate/incorrect outbox events — the same
class the restore path already fixed (`#280`), but the delete side never received it. `succeeded`/`failed`
can also disagree with the database.
**Fix (unified diff):**

```diff
--- a/apps/backend/src/students/repository/studentsRepository.ts
+++ b/apps/backend/src/students/repository/studentsRepository.ts
@@
   bulkSoftDelete?(
     tenant: string,
     ids: string[],
     deletedBy?: string,
     deletionReason?: string,
-  ): Promise<{ succeeded: number; failed: number }>;
+  ): Promise<{ succeeded: number; failed: number; deletedIds?: string[] }>;
```

```diff
--- a/apps/backend/src/db/repositories/studentRepositorySoftDelete.ts
+++ b/apps/backend/src/db/repositories/studentRepositorySoftDelete.ts
@@
-): Promise<{ succeeded: number; failed: number }> {
+): Promise<{ succeeded: number; failed: number; deletedIds: string[] }> {
@@
     return {
       succeeded: updated.length,
       failed: uniqueIds.length - updated.length,
+      deletedIds: updated.map((row) => String(row.id)),
     };
```

```diff
--- a/apps/backend/src/students/use-cases/studentSoftDeleteUseCases.ts
+++ b/apps/backend/src/students/use-cases/studentSoftDeleteUseCases.ts
@@
       if (existing && !existing.deletedAt) {
         toSave.push({
           ...existing,
           deletedAt: now,
           deletedBy,
           deletionReason: trimmedReason || undefined,
         });
-        succeeded += 1;
       } else {
         failed += 1;
       }
     }
 
     if (toSave.length > 0) {
+      let written = toSave;
       if (repo.bulkSoftDelete) {
-        await repo.bulkSoftDelete(
+        const write = await repo.bulkSoftDelete(
           tenant,
           toSave.map((s) => String(s.id)),
           deletedBy,
           trimmedReason,
         );
+        // Only the rows this request actually wrote may be cascaded or audited.
+        written = write.deletedIds
+          ? toSave.filter((s) => write.deletedIds!.includes(String(s.id)))
+          : toSave.slice(0, write.succeeded);
       } else {
         await repo.bulkSave(tenant, toSave);
       }
+      succeeded = written.length;
+      failed = uniqueIds.length - succeeded;
       await cascadeSoftDeleteEnrollmentsForStudents(
         activeDb(),
         tenant,
-        toSave.map((s) => String(s.id)),
+        written.map((s) => String(s.id)),
         deletedBy,
         trimmedReason,
         new Date(now),
       );
-      for (const s of toSave) {
+      for (const s of written) {
@@
-        toSave.flatMap((s) => [
+        written.flatMap((s) => [
@@
-    return { succeeded, failed };
+    return { succeeded, failed };
```

**Pinning test:** repository returns `{ succeeded: 0, deletedIds: [] }` while the pre-read sees one active row → `succeeded: 0`, no cascade call, no outbox/audit rows (extend `studentUseCases.test.ts` beside the restore-provenance specs).

### C3 — Bulk status audits and withdraws enrollments for rows the `UPDATE` skipped

**Where:** `apps/backend/src/students/use-cases/studentOperationUseCases.ts:130-167`,
`apps/backend/src/db/repositories/studentRepositoryListOps.ts:39-67`,
`apps/backend/src/students/repository/studentsRepository.ts:107-112`
**Root cause:** `bulkUpdateStudentsStatusSql` filters `isNull(deletedAt)` and returns only a count, but
`collectStatusTransitions` (and therefore `student.status_change` audit rows and
`withdrawEnrollmentsEndedByStatus`) is computed from the pre-read `affected` list.
**Impact:** a student deleted between read and update still receives a status-change audit row and an
enrollment withdrawal, and a concurrent status change is mis-audited.
**Fix (unified diff):**

```diff
--- a/apps/backend/src/db/repositories/studentRepositoryListOps.ts
+++ b/apps/backend/src/db/repositories/studentRepositoryListOps.ts
@@
-): Promise<number> {
+): Promise<{ succeeded: number; updatedIds: string[] }> {
@@
-  if (!subdomain || uniqueIds.length === 0) return 0;
+  if (!subdomain || uniqueIds.length === 0) return { succeeded: 0, updatedIds: [] };
@@
-    return updated.length;
+    return {
+      succeeded: updated.length,
+      updatedIds: updated.map((row) => String(row.id)),
+    };
```

```diff
--- a/apps/backend/src/students/repository/studentsRepository.ts
+++ b/apps/backend/src/students/repository/studentsRepository.ts
@@
   bulkUpdateStatusSql(
     tenant: string,
     ids: string[],
     status: string,
     updatedBy?: string,
-  ): Promise<number>;
+  ): Promise<{ succeeded: number; updatedIds: string[] }>;
```

```diff
--- a/apps/backend/src/students/use-cases/studentOperationUseCases.ts
+++ b/apps/backend/src/students/use-cases/studentOperationUseCases.ts
@@
-    const succeeded = userId
-      ? await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus, userId)
-      : await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus);
-
-    const transitions = collectStatusTransitions(
-      affected.map((student) => ({ id: String(student.id), status: student.status })),
-      normalizedStatus,
-    );
+    const statusWrite = userId
+      ? await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus, userId)
+      : await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus);
+    // Audit/withdraw only the rows the UPDATE wrote; the pre-read may include rows a
+    // concurrent delete removed.
+    const updatedIds = new Set(statusWrite.updatedIds);
+    const transitions = collectStatusTransitions(
+      affected
+        .filter((student) => updatedIds.has(String(student.id)))
+        .map((student) => ({ id: String(student.id), status: student.status })),
+      normalizedStatus,
+    );
@@
-    return { succeeded, failed: uniqueIds.length - succeeded };
+    return {
+      succeeded: statusWrite.succeeded,
+      failed: uniqueIds.length - statusWrite.succeeded,
+    };
```

**Test updates:** the four fake repositories (`studentUseCases.test.ts`, `studentStatusTransition.test.ts`,
`studentCreateIdCollision.test.ts`, `studentRepositoryBulkStatus.test.ts`) must return the new object shape.
**Pinning test:** repo reports `updatedIds` without the pre-read row → no audit row and no withdrawal for it.

### C4 — CSV import is not idempotent under BullMQ retry; succeeded rows are reported as failures

**Where:** `apps/backend/src/students/use-cases/studentImportUseCases.ts:99-148`,
`packages/shared/src/dataTransfer/import/importPipelineRunner.ts:45-48,99-116`,
`apps/backend/src/worker/queues/queueConfig.ts:91-95` (`attempts: 3`)
**Root cause:** each attempt re-runs the whole chunk. Rows with a phone/email reuse the contact by unique
match and then `createStudent` collides on `students_workspace_contact_active_uidx` → row reported failed
even though it was imported; rows without phone/email create a **second contact and student** (fresh id and
GR). Nothing keys the import by job/row.
**Impact:** silent duplicate students/contacts (inflated counts, duplicate guardians) and misleading failure
reporting on a normal retry.
**Fix (targeted snippets — minimal idempotency in the domain path):**

```diff
--- a/packages/shared/src/dataTransfer/import/importPipelineRunner.ts
+++ b/packages/shared/src/dataTransfer/import/importPipelineRunner.ts
@@
 export type ImportBatchFn<TRow> = (
   rows: TRow[],
   ctx: ImportPipelineContext,
-) => Promise<{ imported: number; errors?: ImportRowError[] }>;
+) => Promise<{ imported: number; unchanged?: number; errors?: ImportRowError[] }>;
@@
-  let imported = 0;
+  let imported = 0;
+  let unchanged = 0;
@@
     imported += result.imported;
+    unchanged += result.unchanged ?? 0;
@@
-  return { total, imported, failed, errors: allErrors };
+  return { total, imported, unchanged, failed, errors: allErrors };
```

```diff
--- a/apps/backend/src/students/use-cases/studentImportUseCases.ts
+++ b/apps/backend/src/students/use-cases/studentImportUseCases.ts
@@
 import { createStudent } from "./studentWriteUseCases.js";
+import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
@@
 export const importStudentRows: ImportBatchFn<StudentImportRow> = async (rows, ctx) => {
   const errors: ImportRowError[] = [];
   let imported = 0;
+  let unchanged = 0;
@@
     try {
+      // BullMQ retries this job up to 3×; resolve a row that is already imported by
+      // Student ID / GR number and report it as unchanged instead of duplicating it.
+      const identifiers = [row.studentId?.trim(), row.grNumber?.trim()].filter(
+        (value): value is string => Boolean(value),
+      );
+      if (identifiers.length > 0) {
+        const already = (await studentsRepository.resolveByIdentifiers?.(ctx.tenant, identifiers)) ?? [];
+        if (already.length > 0) {
+          unchanged += 1;
+          continue;
+        }
+      }
       await runWithTenant(ctx.tenant, () =>
@@
-  return { imported, errors: errors.length > 0 ? errors : undefined };
+  return { imported, unchanged, errors: errors.length > 0 ? errors : undefined };
```

**Residual (documented in the snippet):** rows that carry only a name still depend on the contact match and
a job-level `Idempotency-Key`/row digest is the complete fix; the full design is a per-row idempotency table
or a deterministic `studentId` derived from the job+row, plus an `unchanged` outcome in the import progress.
**Pinning test:** run the same payload twice (two attempts) → first `imported: N`, second `imported: 0,
unchanged: N`, and the student/contact counts unchanged.

---

## 2. Recommended Refactors

### R1 — Cross-module hydration depends on `students.read` and fails silently

`GET /api/students/resolve` (and `/linked-contact-ids`) is registered under the students plugin
(`routes/tenant/students.ts:17-27`) → module access + `canReadCollection(user, "students")`
(`lib/crudQueryRoutes.ts:129-145`). But it is the hydration endpoint for **attendance**, **enrollments** and
**examinations** (`useStudentsByIds` callers in `MarkAttendance`, `EnrollmentsList/Detail`, `EligibilityCheck`,
`useEnterMarksStudents`, `useResultsViewData`). A custom role with attendance/exam rights but no
`students.read` gets 403; the callers default to `[]` and render blank names.
**Suggestion:** either document `students.read` as a dependency of those modules, or add a lean,
read-only hydration route whose gate is “students.read **or** an explicit allowlist of consumer module
reads”, with module enablement still enforced. At minimum, surface/log the denial in
`useStudentsByIds` instead of silently returning an empty list.

### R2 — Every students write invalidates the students cache twice

`invalidateStudentsQueries` → `invalidateContactsQueries` → which itself invalidates `STUDENTS_QUERY_KEY` +
`STUDENTS_METRICS_QUERY_KEY` (`invalidateStudentsQueries.ts:24-30`, `invalidateContactsQueries.ts:48-51`).
With query-core’s default `cancelRefetch`, the second invalidation cancels and restarts the refetch → up to
two list/metrics requests per create/update/delete/restore.

```diff
-export function invalidateContactsQueries(queryClient: QueryClient): void {
+export function invalidateContactsQueries(
+  queryClient: QueryClient,
+  options?: { includeStudents?: boolean },
+): void {
@@
-  void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
-  void queryClient.invalidateQueries({ queryKey: STUDENTS_METRICS_QUERY_KEY });
+  if (options?.includeStudents !== false) {
+    void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
+    void queryClient.invalidateQueries({ queryKey: STUDENTS_METRICS_QUERY_KEY });
+  }
 }
// invalidateStudentsQueries:
-  invalidateContactsQueries(queryClient);
+  // Contact-derived tags still refresh; skip the students echo (we already invalidated above).
+  invalidateContactsQueries(queryClient, { includeStudents: false });
```

### R3 — Unstable registry/derived objects defeat memoisation

`useStudentColumnLayout` rebuilds `tenantRegistry` in an IIFE every render (`useStudentColumnLayout.ts:12-24`),
and `StudentsListDesktopTable`’s column memo depends on that identity plus `statusBadgeConfig`, which is a
fresh object from `useStudentsPageOverlayState` (`StudentsListDesktopTable.tsx:79-110`). The memo never hits,
so per-cell render closures rebuild on every parent render for a 50-row table.
**Suggestion:** `useMemo(() => buildStudentWorkColumnRegistry(settings, labels), [settings, t])`; memoise
`statusBadgeConfig` in the overlay state with `[t, statuses]`; keep the cell-render callback identity stable.

### R4 — Reports export walks the roster client-side and pays a COUNT per page

`resolveStudentReportExportRows` → `fetchAllStudentsForQuery` accumulates every filtered row in memory
(≤20,000) and sends no `skipCount`, so each of up to 200 pages runs the list query **and** its `COUNT(*)`
(`studentRepositoryListPage.ts:49-68`). The Work export already streams server-side
(`createModuleExportService`, 250 rows/page).
**Suggestion:** route the report export through the queued export job. Interim patch: add `skipCount: true`
to the walk query and stop accumulating when the UI only needs the export artifact.

### R5 — `resolveByIdentifiers` cannot use the students unique indexes

`resolveStudentsByIdentifiers` filters `inArray(students.id/studentId/grNumber, …)`
(`studentRepositoryHydrate.ts:132-157`), but the unique indexes are functional
(`students_workspace_gr_number_active_uidx` on `lower(btrim(gr_number))`, `…student_id…`, migration 0165) and
the plain columns have no index. The `grNumber`/`studentId` arms therefore degrade to a tenant-wide scan on
the hydration path used by attendance/exams.
**Suggestion:** match with the same expression as the index:

```ts
sql`lower(btrim(${students.grNumber})) IN (${sql.join(identifiers.map((id) => sql`${id.toLowerCase()}`), sql`, `)})`
```

(or add plain-column indexes if the functional index is intentionally not reusable).

### R6 — Per-row audit/outbox loops in bulk paths

Bulk restore, bulk soft-delete and bulk status emit one `recordModernAuditEvent` (and one outbox event) per
row inside the transaction (`studentRestoreUseCases.ts:254-256`, `studentSoftDeleteUseCases.ts:84-104`,
`studentOperationUseCases.ts:139-155`). For a 500-row bulk operation that is 500–1,000 round trips.
**Suggestion:** add a batched `recordModernAuditEvents` (one `INSERT … VALUES` in the same tx) and have the
bulk loops pass all rows at once; keep the per-row public function for single writes.

### R7 — Two sort-field sources drift

Shared `STUDENT_SORT_FIELDS` (`studentDirectoryColumns.ts:249-257`) lacks `studentId`, while the backend’s
private Set (`studentRepositoryListQuery.ts:20-29`) includes it; the frontend allowlist is built from the
shared list, so studentId sorting is supported server-side but never offered/accepted by the UI allowlist.
**Suggestion:** add `studentId` to the shared list and import `STUDENT_SORT_FIELD_SET` (currently unused) in
the backend and in `studentsListVisibleColumns.ts` — one SSOT, no drift.

### R8 — Guardian archive guard misses relationship-graph guardians

`normalizeStoredStudent` strips `fatherContactId/motherContactId/guardianContactId` (and their names) from
every write (`studentUtils.ts:24-38`), because guardians live on the primary contact’s relationship graph.
`guardContactSoftDeleteDependents` still checks only the (now always-null) student columns
(`studentDeleteGuard.ts:55-108`), so archiving a contact that is a guardian through `contact_relationships`
is allowed while an active student still references it.
**Suggestion:** extend the guard with:
```sql
OR EXISTS (
  SELECT 1 FROM contact_relationships cr
  JOIN students s ON s.contact_id = cr.contact_id
                 AND s.workspace_subdomain = cr.workspace_subdomain
                 AND s.deleted_at IS NULL
  WHERE cr.workspace_subdomain = $1
    AND cr.related_contact_id IN (<ids>)
)
```

### R9 — Date-only report fields shift a day for tenants west of UTC

`formatDate("2026-02-01")` builds `new Date(date)` (UTC midnight) then formats in the tenant timezone
(`settingsDateFormattersCore.ts:11-30`), and the report maps `enrolledDate`/`registeredDate` that way
(`studentReportExport.ts:51`, `studentReportTypes.ts:87`). In e.g. America/New_York the date renders as the
previous day.
**Suggestion:** parse date-only values with the existing `parseIsoDate` (`core/dateFormatBounds.ts:18`) before
formatting, as the date-range bounds already do.

### R10 — Annual GR rollover can collide with out-of-band GR numbers

`generateNextGrNumberBatchSql` resets to seq 1 when `lastYear !== year` (`studentRepositorySequence.ts:100-108`)
without checking that same-year GRs already exist (CSV/backfill). Each attempt then 409s until the sequence
walks past the collision (self-healing but noisy).
**Suggestion:** before returning, advance `startSeq` while `findRegistrationConflict` reports `grNumber` (the
create path already has this probe available).

### R11 — Create-by-id probes then upserts (silent overwrite window)

`createStudent` classifies the supplied id (`studentWriteUseCases.ts:74-88`) and then persists through
`INSERT … ON CONFLICT DO UPDATE` (`studentRepositoryPersist.ts:111-125`). Two concurrent creates with the same
id can both pass the probe; the loser silently updates the winner’s row instead of the promised 409.
**Suggestion:** offer an insert-only repository method (`onConflictDoNothing().returning()`) for creates and
map zero rows to `StudentCreateIdConflictError`; keep the upsert for updates/restores.

---

## 3. Unused Code Candidates (listed only — not deleted)

Scan: 165 non-test files / **443 exported symbols** across
`apps/backend/src/students`, `packages/shared/src/students`, `apps/frontend/src/tenant/features/students`,
`apps/frontend/src/lib/students`, with repo-wide reference counts bucketed into production / test / same-file.
Caveats that block deletion: dynamic `import()` (frontend lazy routes/panels), barrel re-exports, reflection
or external consumers outside this repo. **Every item needs your confirmation before removal.**

### 3.1 Unreferenced exports (0 references anywhere) — 10

| File | Symbol | Suggested action |
| --- | --- | --- |
| `packages/shared/src/students/studentDirectoryColumns.ts` | `StudentDirectoryColumnKey`, `StudentWorkColumnKey`, `studentWorkColumnLabelsFrom`, `isStudentSortField` | Remove (or keep `isStudentSortField` if R7 adopts the SSOT) |
| `packages/shared/src/students/studentFieldDependencies.ts` | `isStudentSeedFieldKey` | Remove |
| `packages/shared/src/students/studentLookupTypes.ts` | `StudentLookupStringKind` | Remove type |
| `packages/shared/src/students/studentsListQuery.ts` | `StudentsNextGrNumberQuery` | Remove type |
| `apps/frontend/src/.../components/StudentDetail.tsx` | `StudentDrawer` | Remove export (component is used under its default export) |
| `apps/frontend/src/.../hooks/studentSetupConfigApi.ts` | `getStudentSettingsMemoryFallback` | Remove |
| `apps/frontend/src/.../lib/studentCardTemplateTypes.ts` | `StudentCardFieldDefinition` | Remove type |

### 3.2 Test-only implementations (no production consumer) — 17

These are the highest-risk category: several are **shadow implementations** of backend SQL/logic that the
tests keep alive, creating a divergence trap.

- **Shadow domain logic (recommend deleting after confirmation):** `studentRegistrationUtils.ts` —
  `findStudentRegistrationConflict`, `backfillMissingStudentGrNumbers`, `collectStudentLinkedContactIds`
  (parallel to `studentRegistrationConflictSql` and `migrateStudentsMissingGrNumbers`);
  `studentsWidgetAggregate.computeStudentsWidgetAggregate` (parallel to the backend widget SQL);
  `studentFieldDependencies.getStudentFieldRemovalIssues` (Fields UI removed);
  `studentSetupConfigTypes.mergeStudentsFormTabsFromApi`.
- **Helpers/validators only tests use:** `studentLookupTypes.isStudentLookupKind`,
  `isStudentLookupLegacyCollectionKey`, `studentFormCustomFields.listStudentSystemFormFieldKeys`,
  `isStudentSystemFormField`, `studentGuardianFromContacts.hasResponsibleAdultLink`,
  `pickPrimaryResponsibleAdult`, `deriveStudentGuardiansFromContact`, `studentUtils.formatStudentNameWithParents`,
  `studentsModuleManifest.studentListSchema`, `StudentsListDesktopTableSimpleCells.renderStudentSessionsCell`, backend `studentLookupsService.loadStudentLookupKind`.
- Barrel note: `studentRegistrationUtils` and `studentsWidgetAggregate` are re-exported from
  `packages/shared/src/entry/indexDomainsAcademic.ts`; that is the only reason they look “public”.

### 3.3 File-local exports (only referenced inside their own file) — 74

45 are prop interfaces (`StudentsListProps`, `StudentFormProps`, `StudentDetail*Props`, …) whose `export`
keyword is unnecessary; the remainder are internal constants/helpers, e.g.
`STUDENT_SERVER_OWNED_AUDIT_KEYS`, `STUDENT_GUARDIAN_LINK_FIELDS`, `computeNextGrNumberBatchForDate`,
`studentCreateGuard` types, `resolveStudentErrorTab`, `useStudentPreferencesQuery`,
`StudentsPageTabPanelProps`, `useStudentsWorkTierSource.BuildStudentsWorkSourceParams`.
**Suggested action:** drop the `export` keyword where the symbol is file-local (cosmetic, zero runtime risk);
no need to delete the declarations.

### 3.4 No production caller / obsolete artifacts

| Item | Evidence | Suggested action |
| --- | --- | --- |
| `studentsListQueryOptions` | exported through `tenant/hooks/collections/students.ts` + tests; no caller | Remove or wire the export page-walk through it |
| `studentsCommandMetricsQueryOptions` | facade + tests only (`useStudentsMetrics` uses `useServerMetrics`) | Remove |
| `StudentFormValidationScroll.test.tsx` | no matching component; the test still covers `runStudentSaveFlow` | Rename the file to match what it tests |
| Stale students setup i18n keys (`students.setup.fields`, `lookups*`) | Setup tier renders only Preferences + Card Template | Remove keys or add the Fields/Lookups UI |

### 3.5 Dead schema objects (forward-only migration required)

`students.father_contact_id`, `mother_contact_id`, `guardian_contact_id` and `*_name` are stripped on every
write (`STUDENT_GUARDIAN_LINK_FIELDS`) yet still have FKs and indexes
(`db/schema/students.ts:105-131`). The relationship graph on the primary contact is the SSOT. These are
**deprecation candidates**, not deletions, and R8’s guard gap must be fixed first. A forward-only migration
would drop the indexes/FKs, then the columns (with a compatibility window for backup/restore payloads).

---

## 4. Scan method, verification, and limits

- Dead-export scan: regex extraction of `export (async) function|const|let|class|interface|type|enum` over the
  four students roots; every identifier counted repo-wide across `apps/`, `packages/`, `e2e/`, bucketed into
  production / test / same-file, excluding the declaration itself. Redis-scan caveat: dynamic imports
  (`lazy(() => import(...))`) and barrel re-exports can make a symbol look unused — hence this is a
  candidate list, not a deletion plan.
- Verified with `pnpm --filter mms-backend test student` (235 pass), the focused frontend suite (658 pass),
  cold `tsc`, and the code-norms/frontend-structure/shared-ui/BiDi/i18n/docs gates. The two full-suite
  failures are documented in §0 and belong to the concurrently edited files.
- Not verified: axe/Playwright (no stack), real tenant cardinalities for the R4/R5 performance claims, and
  whether any external consumer imports the shared barrel symbols in §3.2.
- No production code was modified; no file or export was deleted.
