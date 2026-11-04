# MMS Students Module Re-Review — 2026-11-04 (Round 4)

Independent, read-only review of the **students backend** at `main` HEAD `a51ae8bd53bf460ee836f0e15abb21f5fa199f90`
(`a51ae8bd5`). It **re-verifies** the 2026-11-04 Round 3 review (`docs/students-module-review-2026-11-04-round3.md`,
pinned at `60245210a`) against the code as it stands after `#278`, `#279`, `#280` and `#282`, and audits the
surfaces those commits changed. Line numbers are from the tree as reviewed; every citation was re-read at HEAD.

**Scope:** `apps/backend/src/routes/tenant/students.ts` + `routes/tenant/students/**`,
`apps/backend/src/students/**` (use-cases, repository port/adapter, import), `db/repositories/student*.ts`,
`db/schema/students.ts` + `studentSetupTables.ts`, `services/student{Validation,Export}Service.ts`,
migrations `0162`–`0165` with the RLS/trigger DDL they rely on, `packages/shared/src/students/**` +
`students.dto.ts` + `studentsContract`, and the students specs under `apps/backend/src/__tests__`.
Contacts, enrollments, examinations, finance and faculty were inspected **only** where a students path calls them.
Frontend was read only as a consumer of students contracts.

**Method:** static audit of the production path (registered route → module gate → handler permission → use case →
repository/SQL), `git log --stat 60245210a..HEAD -- <students paths>`, the Round 3 document first (closed items are
not re-reported as new), and an execution pass of the gate suite listed in §1. No formatter, codegen, or source edit.

## 0. Tree provenance (read this before trusting line numbers)

- At the start of the pass the working tree was **clean** at `a51ae8bd5`.
- During the pass a **concurrent local process** began editing non-students files (dashboard, faculty, messaging,
  `moduleRouteActions.ts`). 31 paths are dirty as of this writing; **0 students-path changes**:
  `git status --porcelain -- apps/backend/src/students apps/backend/src/routes/tenant/students
  apps/backend/src/db/repositories/student* apps/backend/src/db/schema/students.ts packages/shared/src/students`
  returned empty. The one dirty shared file that the students gate uses (`lib/moduleRouteActions.ts`) has a
  dashboard-comment-only diff; the students rules (`:23-43`) are unchanged.
- Consequence: all students citations below are valid for the reviewed tree; gate numbers in §1 are from the clean
  baseline run at 22:20 local. A concurrent writer may renumber *non-students* files after this doc was written.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `node scripts/check-code-norms.mjs` | **Pass** — 0 `any`, 300-LOC ceiling held (students max 274 lines), semantic tokens |
| `node scripts/check-db-projections.mjs` | **Pass** — 0 wildcard projections |
| `node scripts/check-backend-boundaries.mjs` | **Pass** — 0 route→storage offenders |
| `node scripts/check-backend-structure.mjs` | **Pass** — all ratchets held (2 use-case/test pairings improved) |
| `pnpm --filter mms-backend test src/__tests__/moduleAccessCoverage.test.ts` | **Pass** — 1/1 |
| `pnpm --filter mms-backend test student` | **32 suites / 235 tests** — 31 suites passed first run; `studentsDbImprovements.test.ts` failed to *load* on a stale Vite SSR dep cache (`Cannot find module …/deps_ssr/@mms_shared.js`) and passes alone (9/9). Flake, not a red suite. |
| `pnpm typecheck` | **Cached replay only** (`6 cached, 6 total`, `FULL TURBO`) — not a fresh compile. A cold `tsc -p apps/backend/tsconfig.json` emitted **5 errors, all in `src/__tests__/facultyImportRoutes.test.ts`**, a file that is **untracked and mid-edit by the concurrent process** (`git ls-files` count 0, mtime 22:25). tsc's error list is exhaustive, so the committed students tree contributes **no** type error; the students-path typecheck result itself remains cached, not independently proven. |
| DB integration specs (`studentsSoftDelete.integration`, `studentsBulk.integration`, `studentsSetup.integration`, `students.integration`, `db-integration/*student*`) | **Included in the 235** (mocked-DB or local Postgres via the unit config as designed); a production-cardinality `EXPLAIN` was **not** run |
| Playwright / axe | **Not run** — out of scope for a backend pass |

## 2. Verdict

**No Critical.** **1 new Major** (A1) and **7 new Minor** (n1–n7). Of Round 3, **three Majors are now genuinely
closed on the production path** (M2 bulk-enroll gate, M3 fail-closed settings, M4 bulk-restore provenance) and are
verified below; **M1 (import idempotency) is still open** and remains the highest residual risk in the module,
together with the seven backend minors that survived.

One carried item is **escalated**: Round-3 **m4** (contacts merge vs the students contact uniqueness index) was
rated Minor on the assumption that the failure was an unclear message. It is not: the merge function explicitly
resolves the *same* partial-unique collision for faculty employments and workshop participants a few lines away,
skips students entirely, and the resulting `23505` is mapped by the contacts error parser to a **400 blaming the
CNIC field**. It is therefore a hard block on merging two contacts that each back an active student — a Major,
owned by contacts, reported here because the uniqueness index belongs to `students`.

The new Major is the *symmetric twin* of the Round-3 M4 defect: bulk restore was fixed to audit only the rows the
`UPDATE … RETURNING` wrote, but **bulk/single soft-delete still counts, cascades and audits the pre-read set** and
discards the database's own count. The new minors cluster in the two places the last commit wave touched most —
the OCC guard added by `#282` (shipped without its 409 test, and with a 400/409 taxonomy divergence from contacts)
and the restore-on-create path (tag reconcile covers only the merged links; the CSV import cannot use it at all).

## 3. Round-3 status at HEAD

| ID | Round-3 severity | Status | Evidence at `a51ae8bd5` |
| --- | --- | --- | --- |
| M1 import idempotency | Major | **OPEN** | `studentImportUseCases.ts:99-148` unchanged since `#275`; per-row tx at `:121-135`; no row/execution key, contact reuse only by phone/email (`:34-44`); `queueConfig.ts:91-95` `attempts: 3` |
| M2 bulk-enroll cross-module gate | Major | **CLOSED** | `studentOperationRoutes.ts:75-88` — `getModuleAccessDenial(request, "enrollment", "write")` **and** `canWriteCollection(user, "enrollments")` before dispatch |
| M3 settings-read fail-open | Major | **CLOSED** | `studentWriteValidation.ts:97-99` no longer catches; `:113-118` tenant fail-closed; `:119-128` dynamic layer unconditional. `loadStudentsSettingsCombined` (`studentConfigService.ts:47-52`) always returns a composed object, so `settings === null` is unreachable and the `if (settings)` branch cannot skip validation on a write |
| M4 bulk-restore provenance | Major | **CLOSED** | `studentRepositorySoftDelete.ts:51-92` takes a caller `restoredAt` and returns `restoredIds` from `RETURNING`; `studentRestoreUseCases.ts:216-245` drives cascade/audit from `restoredIds` and reconciles `succeeded`; pinned by `studentUseCases.test.ts:354-412` |
| m1 import offsets | Minor | **OPEN** | `importPipelineRunner.ts:101-105` still offsets into `transformed` (the *valid* array), so validation-rejected rows shift later row numbers |
| m2 `_blueprintId` stored | Minor | **OPEN** | `STUDENT_WRITE_SYSTEM_KEYS` accepts it (`studentValidation.ts:16,74`); `stripStudentServerOwnedAuditFields` removes only `createdAt/updatedAt/createdBy/updatedBy` (`shared/students/studentSoftDelete.ts:17-22`); not in `KNOWN_STUDENT_KEYS` (`studentRepositoryPersist.ts:11-51`), so `extractStudentCustomFields` (`:53-65`) persists it into `custom_fields` JSONB |
| m3 unlogged 500 | Minor | **OPEN** | `crudQueryRoutes.ts:64,99,142,177,211` call `sendDatabaseError(reply, msg)` with **no cause**; `httpErrors.ts:53-66` logs only when a cause is passed |
| m4 contacts↔students merge seam | **Major (escalated)** | **OPEN** | `contactRepositoryDuplicateReparent.ts:93-101` re-points all four student columns unconditionally at `students_workspace_contact_active_uidx` (`schema/students.ts:99-101`), with **no** collision handling, while the same function archives the loser's faculty employment first (`:102-120`) and de-duplicates workshop participants (`:128-147`) for exactly this class of partial-unique collision. The `23505` falls through `handleContactWriteError` → `parsePostgresUniqueError` and is answered as `400 validation_error` with `fieldId: "cnic"`, message *"Value must be unique per contact"* (`contactRouteErrors.ts:43,57-62`) |
| m5 public `skipCount` | Minor | **OPEN** | `studentCrudRoutes.ts:42,55`; `studentRepositoryListPage.ts:49-50,98-99` returns `total: 0` when the flag is set, in a body whose contract promises a total |
| m6 GR batch atomicity | Minor | **OPEN** | `studentOperationUseCases.ts:216` reserves the batch (own transaction via `withTenant`), `:225` writes it in a second transaction; a failed `bulkSave` burns the block |
| m7 race classification | Minor | **OPEN** | `studentRestoreUseCases.ts:84` still sniffs the error **message** (`msg.includes("student_id")`), although `getPgConstraint` exists at `studentNormalizeUseCases.ts:10-17` |
| m8 drill-down toast | Minor | **OPEN (frontend, carried)** | `apps/frontend/src/tenant/features/reports/hooks/studentReportMetrics.ts:22-23` toasts then routes `{status}`; the `students.metrics.newThisPeriod` tile passes `undefined` (`:86-91`), so hovering that tile toasts "drill-down applied" while the Work view is unfiltered. Out of backend scope — listed for completeness |
| m9 bulk-restore failure without reason | Minor | **OPEN** | `studentRestoreUseCases.ts:245` `failed = uniqueIds.length - succeeded` after the DB-count reconciliation; a row lost to the race still has no `conflicts[]` entry |

## 4. Findings detail

Every item below is reachable from a registered route; this table is the shortest path from the entry point to the
defect, so a fix can be pinned on the same chain.

| ID | Registered entry point | Chain |
| --- | --- | --- |
| A1 | `DELETE /api/students/:id`, `POST /api/students/bulk-delete` | `registerSoftDeletableBulkTrashRoutes` (`crudBulkRouteFactories.ts:86-166`) → `bulkSoftDeleteStudents` → `bulkSoftDeleteStudentsSql` |
| n1, n2 | `PUT /api/students/:id` | `studentCrudContract.update` → `studentCrudRoutes.ts:153-203` → `updateStudentById` → `saveStudentIfVersionMatches` |
| n3 | `POST /api/students` | `studentCrudContract.create` → `studentCrudRoutes.ts:114-151` → `createStudent` → `persistStudentTx` |
| n4 | `POST /api/students/import` → `students:import` worker | `registerModuleCsvImportRoutes` → `importStudentRows` → `createStudent` → `restoreArchivedStudentOnCreate` |
| n5 | `POST /api/students/bulk-status` | `studentOperationsContract.bulkStatus` → `studentOperationRoutes.ts:20-60` → `bulkUpdateStudentStatus` → `bulkUpdateStudentsStatusSql` |
| n6 | `POST /api/students` (restore-on-create branch) | `createStudent` → `restoreArchivedStudentOnCreate` → `reconcileContactSystemTags` |
| n7 | `POST /api/students` (GR auto-generation) | `createStudent` → `generateNextGrNumber` → `generateNextGrNumberBatchSql` |
| m4 | `POST /api/contacts/merge` | `contactAuditExportRoutes.ts:117-165` → `mergeContactsById` → `contactRepositoryDuplicateReparent` |

### A1 — Major — Soft-delete counts, cascades and audits rows the `UPDATE` did not write

**Evidence**

- `studentSoftDeleteUseCases.ts:49-62` — the work set is decided from a read: `findByIds` (`:46`) then
  `succeeded += 1` for every pre-read active row (`:58`).
- `studentSoftDeleteUseCases.ts:65-71` — the database's own answer is **discarded**:
  `await repo.bulkSoftDelete(tenant, ids, deletedBy, reason)`; the repository returns
  `{ succeeded, failed }` (`studentRepositorySoftDelete.ts:39-42`) and nothing reads it.
- `studentSoftDeleteUseCases.ts:75-82` — the enrollment cascade runs for the **pre-read** ids.
- `studentSoftDeleteUseCases.ts:84-104` — one `entity.soft_deleted` outbox event and one `DELETE` audit row
  (`recordModernAuditEvent`) per pre-read row, with `deletedBy` = this caller.
- `studentSoftDeleteUseCases.ts:116` — returns the pre-read count.
- Single delete inherits it: `studentSoftDeleteUseCases.ts:21-23` (`succeeded === 1`), then
  `studentCrudRoutes.ts:233-238` writes a collection summary audit and answers 200.

**Production path** `DELETE /api/students/:id` / `POST /api/students/bulk-delete` → module gate
`students` + `delete` (`moduleRouteActions.ts:26-37`) → `registerSoftDeletableBulkTrashRoutes`
(`crudBulkRouteFactories.ts:109` passes `String(user.id)`) → `studentUseCases.bulkSoftDeleteStudents` →
`studentRepositorySoftDelete.ts:11-46`.

**Consequence** A row soft-deleted (or restored and re-deleted) by another writer between the read and the
`UPDATE` is not matched by the SQL (`isNull(students.deletedAt)`, `studentRepositorySoftDelete.ts:30-36`) — yet this
request still reports it as deleted, re-runs the enrollment cascade against it, and appends an `entity.soft_deleted`
outbox event plus a `DELETE` audit row stamped with **this** caller. The audit chain therefore attributes a deletion
this request did not perform (and duplicates the winner's row), and the reported `succeeded`/`failed` split is
optimistic. This is exactly the defect class Round 3 rated **Major** for bulk restore (M4) and that `#280` fixed
there; the delete side never received the same treatment.

**Proposed fix** Mirror the restore path: have `bulkSoftDeleteStudentsSql` return
`deletedIds` from its existing `RETURNING`, drive the cascade/outbox/audit loop from those ids, and reconcile
`succeeded`/`failed` from the result (`softDeleteStudentById` returns `result.succeeded === 1` *of the write*).
Pin with the symmetric spec next to `studentUseCases.test.ts:354-412`: a repository returning `{succeeded: 0,
deletedIds: []}` while the pre-read sees one active row must produce `succeeded: 0` and **no** audit/outbox row.

### n1 — Minor — A malformed `x-expected-updated-at` answers 409 ("changed by someone else")

`studentRepositoryPersist.ts:152-153` returns `false` for an unparseable token; `studentWriteUseCases.ts:209`
turns that into `ConflictError(STUDENT_VERSION_CONFLICT)` → 409. Contacts validates the same header first and
answers 400 (`contactWriteUseCases.ts:216-219`). A client typo is reported as a concurrency conflict, and the FE
form (`useStudentsCrudActions.ts:34-44`) surfaces the stale-token copy. Fix: reject `Number.isNaN(Date.parse(token))`
with a `ValidationError` at the route or use-case boundary, before the compare-and-set.

### n2 — Minor — The OCC guard shipped without the test the norm requires

`#282` added optimistic concurrency (`studentCrudRoutes.ts:180`, `studentWriteUseCases.ts:198-212`,
`studentRepositoryPersist.ts:146-180`) but **no spec asserts the 409**: `studentWriteUseCases.test.ts` has four
tests, none with `expectedUpdatedAt`; `students.integration.test.ts:309-330` mocks `studentUseCases.updateStudentById`,
so the route test cannot reach the guard. `mms-api-interface` §6 is explicit: *never ship the check without a
route/integration test asserting the 409.* The mechanism itself is sound (see §6), so this is a test gap and a
process violation, not a behaviour defect.

### n3 — Minor — Two concurrent creates with the same client id can silently overwrite

`createStudent` probes the id (`studentWriteUseCases.ts:74-88` → `studentCreateGuard.ts:41-52`) and then persists
via `INSERT … ON CONFLICT (workspace_subdomain, id) DO UPDATE` (`studentRepositoryPersist.ts:111-125`). Between the
probe and the upsert a second writer can insert the same id; the loser then updates the winner's row and returns
201 with its own payload — the documented "an id owned by an active student is rejected with 409" guarantee
(`studentWriteUseCases.ts:43-47`) does not hold under concurrency. Low impact (ids are client-generated UUIDs;
double-submit is the realistic trigger), but it is a silent last-write-wins on a path that promises a 409.

### n4 — Minor — CSV import can never restore an archived student

`studentImportUseCases.ts:127-131` calls `createStudent(payload, { actorId, deferBroadcast })` — no `User`.
`restoreArchivedStudentOnCreate` requires one with delete permission
(`studentRestoreOnCreate.ts:40`, `canDeleteCollection`), so a row whose phone/email matches a soft-deleted
student's contact (`studentImportUseCases.ts:34-44` → `findSoftDeletedByContactId`) is reported as a row failure
with *"Restoring soft-deleted students requires delete permissions"* even for an admin import. The gate is right;
the worker context simply cannot satisfy it. Fix: pass the job's authorization context (viewer role/permissions)
into the import use case and decide with the same policy, or map this specific failure to an explicit
"already archived — restore from Trash" row error instead of a permission message.

### n5 — Minor — Bulk status writes audit and withdraw enrollments for rows the `UPDATE` skipped

`studentOperationUseCases.ts:131-142` snapshots statuses with `findByIds`, then `repo.bulkUpdateStatusSql`
(`studentRepositoryListOps.ts:50-66`, `isNull(deletedAt)`) returns the real count at `:135-137`, but
`collectStatusTransitions(affected, …)` (`:139-142`) and therefore `withdrawEnrollmentsEndedByStatus`
(`:148-154`) and `recordStudentStatusAuditEvents` (`:155`) run off the **pre-read** list. A row deleted between the
two steps still gets a `student.status_change` audit row and an enrollment withdrawal. Narrow window, audit-only
impact — but the pattern is the same stale-snapshot class as A1.

### n6 — Minor — Restore-on-create reconciles only the merged links

`studentRestoreOnCreate.ts:84-88` calls `reconcileContactSystemTags` with the **merged** columns only. The update
path deliberately reconciles both sides (`studentWriteUseCases.ts:228-242`, comment: *"Reconcile both the previous
and the new links so removed roles archive"*). When a re-registration changes `contactId` (id-collision path) or a
parent/guardian link, the archived row's former contact is never recomputed, so its Student/Parent/Guardian tag
stays active (or stays archived when it should activate) — a derived projection not reconciled on one lifecycle
path, contrary to `mms-code-review` review-order item 9.

### n7 — Minor — Annual GR rollover can collide with GRs created out of band

`studentRepositorySequence.ts:100-108` resets to `seq 1` whenever `lastYear !== year`, assuming the new year has no
GRs. The first-use seed path (`:53-92`) *does* count the year's rows, including soft-deleted ones; the rollover path
does not. A workspace that imported/backfilled `{seq}-{year}` GRs for the new year before its first UI create can
get a `23505` → 409 on that create (each retry advances the sequence, so it self-heals). No corruption; the
production path catches it as a conflict (`throwGrUniqueConflict`, `studentNormalizeUseCases.ts:20-31`).

### m4 — Major (escalated from Round 3) — Merging two contacts that each back an active student returns a 400 blaming CNIC

**Evidence**

- `contactRepositoryDuplicateReparent.ts:93-101` — the students re-point is unconditional over all four student
  contact columns, with no pre-check and no archive-first step, against
  `students_workspace_contact_active_uidx` (`schema/students.ts:99-101`, created in `0163:14-17`).
- The same function handles the identical collision class for other modules in the same transaction:
  faculty employments are archived before the re-point when the survivor already holds an active one
  (`:102-126`, comment names `faculty_employments_contact_active_uidx`), and duplicate workshop participants are
  deleted before the re-point (`:128-147`, comment names `workshop_participants_contact_uidx`). Students — the
  module that owns a partial unique index on `contact_id` — has neither.
- The resulting `23505` reaches `handleContactWriteError` (`contactRouteErrors.ts:46-70`) →
  `parsePostgresUniqueError` (`:18-44`), which matches only cnic/phone/email constraints and otherwise returns
  `{ fieldId: "cnic", tabId: "basic", message: "Value must be unique per contact" }` (`:43`), answered as
  `400 validation_error` with `errors[0]` pointing at CNIC (`:57-62`).

**Consequence** Deduplicating the contacts that most need it — a duplicate guardian/parent pair where both contacts
were registered as students — cannot complete. The operator gets a 400 that names the wrong field, with no
statement of the actual rule (one active student per contact) and no hint that one student profile must be archived
first. Round 3 rated this Minor on message quality; the missing faculty-style pre-check makes it a functional block.

Cross-reference: the contacts round-5 review (`contacts-module-review-2026-11-04-round5.md`, M-1) independently
found that *any* unmatched `23505` during merge becomes this same false 400, via the CNIC path. m4 is a **second,
distinct** constraint hitting that mapper — and unlike CNIC, whose merge case now archives the loser first, the
students re-point has no compensating step at all.

Fix belongs to contacts: archive the loser's active student (with actor/reason) or refuse up front with an explicit
`conflict` naming `students.contactId`.

## 5. Test gaps

| Gap | Why it matters | Where to pin |
| --- | --- | --- |
| Bulk soft-delete write-vs-audit reconciliation (A1) | The exact class of M4, unfixed on the delete side | `studentUseCases.test.ts` beside `:354-412` |
| OCC 409 (n2) | Norm gate; `#282`'s central change is unpinned | new `studentWriteUseCases.test.ts` case + one route-level case with the header (the route currently mocks the use case) |
| Import re-delivery (M1) | `studentsImportJob.test.ts` (170 lines) never re-runs a payload | add a same-payload twice assertion |
| Import of an archived student (n4) | The archive branch of `createStudent` is unreachable from the worker today | `studentsImportJob.test.ts` |
| Create-id concurrency (n3) | No test covers probe-then-upsert | use-case spec with a repository whose probe misses |
| Bulk status stale snapshot (n5) | DB count and pre-read count diverge only under a race | use-case spec: repository returns a smaller count |
| GR rollover vs out-of-band GRs (n7) | Seed-vs-rollover asymmetry is untested | `studentSequenceGenerator.test.ts` |
| Students data cache | `invalidateStudentsCache` (`studentCacheInvalidation.ts`) evicts domain `students`, but no production reader/writer uses that domain (`getOrSetMultiTier` callers use `setup:*`, `lookups` and the role catalog). Eviction is write-only dead weight — Round 3's hypothesis still holds; setup config has its own domain (`registerModuleSetupConfigRoutes.ts:61,69-75`) | decide whether to cache list reads or drop the invalidation |

## 6. Verified-clean surfaces

- **Module/route matrix** — one `authenticateTenant` preHandler + `registerModuleAccess(fastify, "students")`
  inherited by all seven sub-routers (`students.ts:17-27`); delete/restore/bulk-trash resolve to `delete`,
  `migrate-gr-numbers` to `setupWrite`, `duplicate-check` to `read` (`moduleRouteActions.ts:23-43`), pinned by
  `moduleAccessCoverage.test.ts:324-329` (1/1 passing).
- **Trash visibility** requires `students.delete` on both list and get, and deleted rows 404 without it
  (`studentCrudRoutes.ts:41-51,82-96`).
- **Cross-module authorization** of `bulk-enroll` (M2) — enrollment module decision *and* `enrollments.write`, both
  server-side, custom-role aware via `getModuleAccessDenial` (`requireTenantModule.ts:87-101`).
- **Write validation fail-closed** (M3) — the settings read is no longer swallowed, tenant-less writes are rejected,
  and the dynamic layer (required tabs/fields, types, blueprint lock) always runs
  (`studentWriteValidation.ts:93-130`).
- **Bulk-restore provenance** (M4) — one caller-supplied `restoredAt` for rows, cascade and audit; audit limited to
  `RETURNING` ids; conflicts classified before the write (`studentRestoreUseCases.ts:159-267`).
- **OCC mechanics** — the compare-and-set lives in the `UPDATE` predicate, not a read-then-write
  (`studentRepositoryPersist.ts:146-180`); a missing repository capability fails closed to 409
  (`studentWriteUseCases.ts:201-203`); `process.env.TZ = "UTC"` (`config/loadEnv.ts:23`) makes the naive and
  timestamptz branches of the predicate equivalent, so no timezone window widens the token match; the token is
  stripped from the payload and attribution is session-stamped.
- **Audit atomicity** — `student.create` / `student.update` / `student.soft_delete` / restore rows are appended
  inside the domain transaction (`studentWriteUseCases.ts:139-147,244-252`; `studentAuditEvents.ts:6-29`;
  `collectionAuditInTx.ts:22-45`). The delete route's extra collection summary (`studentCrudRoutes.ts:233-238`)
  duplicates the action type rather than replacing the forensic row, and its helper swallows append failures with a
  log (`createCollectionAuditHelper.ts:60-72`) — noise, not a chain break.
- **Tenancy** — every students SQL predicate carries `workspace_subdomain`, including both sides of the correlated
  contact subqueries (`studentRepositoryListQuery.ts:26-104`; `studentRepositoryWidgetsSql.ts:21-88`); hydration
  passes the tenant explicitly (`studentHydrateUseCases.ts:22-28`); `findStudentById`'s prepared statement is RLS-
  scoped and has no `deleted_at` literal, so `include_deleted` correctly governs trash reads
  (`preparedStatements.ts:140-157`).
- **No injection** — `resolveStudentFieldExpr` is a closed allowlist returning `''` for anything else; all widget
  filters bind values (`studentRepositoryWidgetsSql.ts:21-119`). No `sql.raw`/`sql.unsafe` anywhere under students.
- **Schema/DDL coherence** — composite PK, soft-delete sextuple, partial unique indexes on `lower(btrim(gr_number))`
  / `student_id` / `contact_id` (`0163:14-17,55-66`, hardened in `0165:10-21`), `ON DELETE restrict` on the primary
  contact FK (`0163:70-77`) plus `guardContactSoftDeleteDependents` (`studentDeleteGuard.ts:55-108`), status vocabulary parity
  between `STUDENT_STATUS_VALUES` (`studentTypes.ts:4-10`) and `students_status_check` (`0162:24-33`), RLS
  `USING`/`WITH CHECK` with `app.include_deleted` (`0108:323-341`).
- **GR sequence** — `SELECT … FOR UPDATE` on the config row, annual rollover, and deleted-row-inclusive seeding
  scoped by `withIncludeDeletedScope` so the caller's transaction is not left reading trash
  (`studentRepositorySequence.ts:30-130`; `studentSequenceIncludeDeletedScope.test.ts`).
- **Export paging** — keyset/offset walk stops on a short page (`studentRepositoryListPage.ts:98-99`), the export
  pager passes `skipCount: true` (`studentsExportService.ts:63-76`), and deleted rows are filtered by
  `loadStudentsByIds` (`studentLoadEntityUseCases.ts:60-67`).
- **Import atomicity per row** — contact + student commit or roll back together; one broadcast per chunk
  (`studentImportUseCases.ts:121-145`).

## 7. Adversarial audit

**Edge cases.** A duplicate id inside one bulk call is de-duplicated in both directions (`studentSoftDeleteUseCases.ts:33`,
`studentRestoreUseCases.ts:116`). Empty/blank GR and Student-ID are stored as `NULL` and the partial unique indexes
exclude them, so blank does not collide (`studentRepositoryPersist.ts:73-74`, `0165:10-21`). A restore of an
already-active row is a 404 and writes no RESTORE row (`studentRestoreUseCases.ts:46-48`). Restore-on-create
merges the archived row with the incoming payload and overrides the id (`studentRestoreOnCreate.ts:40-71`), so a
client cannot resurrect a different row's id under delete-only permission. A status outside the vocabulary is
rejected at the route (400), at the use case, and at the DB check constraint.

**Failure modes.** A rolled-back create/update/restore still evicts the students cache (`.finally`, e.g.
`studentWriteUseCases.ts:149`), so no pre-commit row can be served. A failed audit append on the collection summary
path is logged, not raised (`createCollectionAuditHelper.ts:60-72`). A settings read failure now refuses the write
instead of persisting an unvalidated row. A malformed OCC token is mis-typed as a conflict (n1). A deleted-then-
re-registered student imported via CSV is refused with a misleading permission message (n4).

**Security / multi-tenancy.** No cross-tenant predicate is missing; `bulk-enroll` now needs the enrollment module
*and* its write permission, so the students surface can no longer create/cancel enrollments under `students.write`
alone. Contact archive stays blocked while an active student links the contact (guard + FK restrict). The only
identity-adjacent weakness found is client-controlled `_blueprintId` persisting into `custom_fields` (carried m2) —
it cannot disable server validation, so it is data hygiene, not a bypass.

**Concurrency.** Restore distinguishes a pre-validated 400 from a race 409 and now audits only `RETURNING` rows;
**delete does not** (A1). Bulk status audits/withdraws from a pre-read snapshot (n5). GR allocation is serialized
by `FOR UPDATE`; only the Setup backfill reserves and writes in two transactions (carried m6). Create-by-id is
probe-then-upsert (n3). The students cache invalidation is harmless because nothing populates that domain.

## 8. Resolution plan

**Tier 1 — close before the next students change** (small, read-only to the schema):

1. **A1** delete-write reconciliation: `deletedIds` from `RETURNING`, cascade/outbox/audit from written ids,
   `softDeleteStudentById` from the write, symmetric spec.
2. **n1** validate the OCC header (400) before the compare-and-set.
3. **n2** add the OCC 409 tests (use case + route) the norm requires.

**Tier 2 — next students patch** (behavioural, each needs one pinning assertion):

4. **n4** import authorization context for the restore branch, and an explicit "archived — restore from Trash" row
   error otherwise.
5. **n6** reconcile the archived row's previous links in `restoreArchivedStudentOnCreate`.
6. **n3** fail the create on a conflicting upsert (`onConflictDoNothing` + 409, or a version predicate) instead of
   last-write-wins.
7. **n5** derive status audits/withdrawals from the ids the bulk update returned.
8. **n7** seed the rollover from the year's existing GRs, or advance past `findRegistrationConflict` before save.
9. **m4** (contacts-owned): archive or refuse the loser's active student before the students re-point, mirroring the
   faculty/workshop pre-checks in the same transaction; answer with a `conflict` that names `students.contactId`.

**Tier 3 — module patch / debt batch:** **M1** import idempotency (row key + resolve-before-create + `unchanged`
accounting), carried **m1–m3, m5–m7, m9**, and the cache-reader decision from §5. Carried **m8** is frontend.

**Hypotheses — measure, do not patch yet:** production `EXPLAIN` for the `%LIKE%` contact search and the
gender/DOB/name correlated subqueries; how often import jobs are actually re-delivered; how often bulk restore/delete
loses a race; whether any client other than the export pager sends `skipCount`.

## 9. Hypotheses not proven

- **Import retry frequency (M1)** — the retry policy and the non-idempotent code are proven; the production trigger
  rate is not.
- **Restore/delete race frequency (A1, n5)** — the over-report is proven statically; how often `written < pre-read`
  occurs in production is unknown.
- **Cache domain** — a reader for domain `students` outside `apps/backend/src` is not excluded.
- **Search performance** — local seeded data cannot represent production cardinality; no `EXPLAIN` was run.
- **Refresh of the students suite under a clean Vite cache** — the one suite failure was a dep-cache artifact
  (passes alone); a fully cold-cache re-run was not attempted because the tree is being edited concurrently.

## 10. Implementation status (2026-11-04, Round 4)

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| M1 | open | — | — |
| M2 | closed (`#278`, verified) | `bulk-enroll` requires the enrollment module + `enrollments.write` | `studentOperationRoutes.ts:75-88`; `moduleAccessCoverage.test.ts` |
| M3 | closed (`#278`, verified) | settings read no longer swallowed; tenant/dynamic layer fail-closed | `studentWriteValidation.test.ts` |
| M4 | closed (`#280`, verified) | explicit `restoredAt`, audit from `RETURNING` ids | `studentUseCases.test.ts:354-412` |
| m1–m3, m5–m7, m9 | open | — | — |
| m4 | open — **Major (escalated)** | — | `contactRepositoryDuplicateReparent.ts:93-101` |
| m8 | open (frontend) | — | — |
| A1, n1–n7 | open | — | — |
