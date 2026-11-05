# MMS Students Module Review — 2026-11-03

Independent, read-only review of the students domain at commit `38b0f8f9f` (working tree clean at
review time). This is the first dedicated students-module review; it follows the format of
[contacts-module-review-2026-11-02](./contacts-module-review-2026-11-02.md).

**Change set status.** Every fix recorded in §5 is present in the working tree and deliberately
**left uncommitted** on `main` at `38b0f8f9f` — no commit, push or branch change was performed.
Deferred items (§6) stay open by design.

**TDD evidence.** Red-first was observed for the two defects where the guard was authored before the
fix: `studentCreateIdCollision.test.ts` (`4 failed | 1 passed` against the unguarded create path) and
`studentWriteValidation.test.ts` (`1 failed | 6 passed`, because zod's strict-object rejection mapped
the unknown key to `form` instead of the key). For the remaining findings the spec was authored with
the fix and asserts the failure mode directly — e.g. a 409 must *reject* instead of resolving
(`useStudentsCrudActions.test.tsx`), a withdrawal throw must reject the bulk status
(`studentStatusTransition.test.ts`), and a restricted key must be absent from both the record and its
`customFields` map (`studentsResponseSanitizer.test.ts`).

**Method.** Baseline gates and the students unit/integration suites were run locally (see §1). Two
independent lane audits were run in parallel — frontend feature, and contracts/data/test surface —
alongside a review of the backend domain and route layer. Candidate defects were confirmed by
reading the executed path (route → use case → repository → SQL); concurrency claims were **not**
race-reproduced (no local Postgres), and are marked as such.

**Scope.** `apps/backend/src/routes/tenant/students/**`, `apps/backend/src/students/**`,
`apps/backend/src/db/repositories/student*`, `apps/backend/src/db/schema/students.ts`,
`packages/shared/src/students/**`, `packages/shared/src/schemas/students.dto.ts`,
`packages/shared/src/contracts/students*.ts`, `apps/frontend/src/tenant/features/students/**`,
`apps/frontend/src/tenant/hooks/collections/students.ts`, the students module manifest and route
registration, students migrations `0011`–`0202`, and the students e2e/a11y entry points. Contacts,
enrollments and finance were inspected only where the students module calls them.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, backend, frontend, e2e, ui) | **Pass** |
| `pnpm --filter mms-backend test student` | **19 files / 147 tests passed** |
| `pnpm --filter mms-frontend test features/students` | **54 files / 144 tests passed** |
| `apps/backend/src/__tests__/moduleAccessCoverage.test.ts` | 1 passed |
| `apps/frontend/src/lib/config/routeAccess.test.ts` | 11 passed |
| `check:code-norms` | 0 explicit `any`, 4 files over 300 LOC (baseline 4; none in students), 0 arbitrary colours |
| `check:frontend-structure` / `check:backend-boundaries` / `check:db-projections` / `check:work-directory` / `check:shared-ui` / `check:shared-structure` | 0 violations |
| `pnpm check:i18n` | 9,480 keys; ar/ur/fa missing = 0 |
| Students tree size | 120 non-test frontend files / 11,054 LOC + 54 specs; largest file 263 LOC |
| `test:db` / `test:rls` | **Not run** — no local Postgres in the review environment |
| Playwright e2e + axe | **Not run** — requires the dev servers |

Environment: Node `v26.7.0`, pnpm `11.15.1`.

## 2. Verdict

The module is structurally clean — zero `any`, zero files over the 300-LOC cap, no duplicated
dialogs/tables/export logic, correct module-access registration, complete i18n, and genuine Drizzle
`FORCE RLS` + partial unique indexes on `gr_number`, `student_id` and `contact_id`. It is **not
healthy**: there is one entirely broken feature (CSV import has no job runner), one data-integrity
gap (bulk status changes never withdraw enrollments), a server-side validation layer that was
deleted by a refactor and is still mocked green in CI, and a frontend that reports success for
failed writes. None of these are visible to the ratchets, which measure structure, not execution.

## 3. Findings summary

### Domain / backend

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| D-01 | **P1** | Background jobs | `POST /api/students/import` enqueues `students:import`, but no runner is registered — every import fails |
| D-02 | **P1** | Write path / authz | Create upserts by client-supplied `id`: an existing row is overwritten, a soft-deleted row is resurrected without `students.delete` |
| D-03 | **P1** | Domain integrity | Bulk status change skips the enrollment-withdrawal pipeline that the single edit runs |
| D-04 | **P1** | Validation | Strict + tenant-dynamic student validation never runs on create/update (removed in `7b9e5072b`) |
| D-05 | P2 | Soft delete | Restore of an already-active student returns 200 and writes a false `student.restore` audit row |
| D-06 | P2 | Data layer | Sibling/family filters target guardian columns that writes never populate — the sibling list is always empty |
| D-07 | P2 | Field visibility | The viewer sanitizer leaks restricted custom values through the nested `customFields` map |
| D-08 | P2 | Write path | GR/Student-ID casing is force-lowercased, contradicting literal-case templates |
| D-09 | P2 | Transactions | Status change commits before enrollment withdrawal (partial state on failure) |
| D-10 | P2 | Contracts | `GET /lookups/:kind` declared but unregistered; export/import undeclared; restore's 400 undeclared |
| D-11 | P2 | List query | Search ignores father/mother/guardian names although the manifest declares them searchable |
| D-12 | P3 | Bulk ops | Bulk delete/restore do not dedupe ids → inflated counts and duplicate audit rows |
| D-13 | P3 | Audit | `export-audit` persists a client-supplied count as audit truth |
| D-14 | P3 | Audit | Bulk-status audit is not subject-scoped (`recordId` = `"students"`); `updated_by` never set |
| D-15 | P3 | Contracts | Create/update responses are un-hydrated, unlike GET/list |
| D-16 | P3 | Validation | Free-text write fields have no length bounds → 500 instead of 400 |
| D-17 | P3 | Validation | `.passthrough()` lets unknown keys persist into `custom_fields` (subsumed by D-04) |
| D-18 | P3 | Cleanup | Guardian reconciliation call sites pass values normalization already stripped |
| D-19 | P3 | Pagination | Cursor pagination silently forces `id asc`, ignoring the requested sort |
| D-20 | P3 | Field visibility | Sanitizer fails open when the tenant field-config row is absent |
| D-21 | P3 | Performance | `quickFilter=new` predicate unindexed; GR `FOR UPDATE` spans the create tx and leaks `app.include_deleted` |

### Frontend

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| F-01 | **P1** | Data flow | Every students write treats a resolved response as success; 400/409 never inspected |
| F-02 | **P1** | Form save | After one client-side validation error, `savingRef` stays true and Save becomes a silent no-op |
| F-03 | **P1** | Form save | GR conflicts detected by `message.includes("gr")`; unrelated failures are misreported |
| F-04 | P2 | Setup save | Preferences report "saved" on a 400/500 |
| F-05 | P2 | Query keys | Two list-key/fetcher conventions; the declared "SSOT" builders are test-only |
| F-06 | P2 | Invalidation | Bulk enroll leaves the Enrollments module stale |
| F-07 | P2 | Tenant | GR-migration completion flag is global localStorage, not tenant-scoped |
| F-08 | P2 | Branding | Printed ID cards ignore the workspace name |
| F-09 | P3 | Dead code | Dead/duplicate hooks (second next-GR hook, infinite-list and contract factories) |
| F-10 | P3 | UX | The "None" sort option cannot clear sorting |
| F-11 | P3 | Invalidation | Student writes do not invalidate contact tags derived from the student link |

### Test surface

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| T-01 | Cause of F-01…F-04 | Tests | No spec simulates a failed save (no 400/409 mock anywhere in the students tree) |
| T-02 | P2 | Tests | No spec covers `studentsResponseSanitizer` (D-07 unguarded) |
| T-03 | P2 | Tests | `students.integration.test.ts` mocks the domain, so D-01/D-03/D-04 are invisible |
| T-04 | P3 | Tests | Several "DB improvement" specs assert source text rather than behaviour |
| T-05 | P3 | Tests | E2E only loads `/students` and toggles trash |

## 4. Findings

### D-01 — P1 — CSV import is wired to a job runner that does not exist

**Evidence.** `apps/backend/src/routes/tenant/students/studentExportRoutes.ts:30-37` registers
`POST /api/students/import` through `registerModuleCsvImportRoutes`, which enqueues a
`{moduleId: "students", kind: "import"}` job (`apps/backend/src/lib/registerModuleCsvImportRoutes.ts:66-80`).
`registerDefaultBackgroundJobRunners` registers contacts, faculty, messaging and sessions import
runners but no students runner (`apps/backend/src/services/backgroundJobRunnerService.ts:112,218`);
`grep -rn "students:import"` over `apps/backend/src`, `apps/frontend/src`, `e2e` and `docs` returns
**zero** matches. Execution therefore fails closed:
`apps/backend/src/services/backgroundJobWorkerService.ts:57-58,117` — `No runner registered for ${key}`.
The UI posts there from `StudentsCsvImportDialog.tsx:22` via the shared
`StandardModuleCsvImportDialog`, so the Work-tier **Import** action always ends in a failed job.

**Impact.** A shipped, permission-gated module feature (Students → Work → Import) cannot succeed.
No test caught it because the only import spec asserts the POST path is called.

### D-02 — P1 — Create path adopts any client-supplied id (overwrite / unauthorized resurrect)

**Evidence.** The wire DTO accepts an `id` (`packages/shared/src/schemas/students.dto.ts:9`), and
`resolveStudentRowId` keeps any non-empty string
(`apps/backend/src/students/use-cases/studentNormalizeUseCases.ts:45-53`). `createStudent` only
probes for an existing row **by `contactId`**
(`apps/backend/src/students/use-cases/studentWriteUseCases.ts:57-117`). Persistence is an upsert
keyed on `(workspace_subdomain, id)`:
`apps/backend/src/db/repositories/studentRepositoryPersist.ts:109-120`. Contacts solved the same
problem correctly — it loads the row *including deleted*
(`apps/backend/src/contacts/use-cases/contactWriteUseCases.ts:60-115`), gates a restore on delete
permission, and stamps restore provenance.

**Impact.**
1. `POST /api/students` with an existing `id` silently overwrites that student (clearing
   `gr_number`, `contact_id`, `notes`, …) and writes a `student.create` audit row.
2. With the `id` of a **soft-deleted** student, the row is resurrected without `students.delete`:
   the restore gate is inside the `contactId` branch only, so no `StudentPermissionError`, no
   cascaded-enrollment restore, no `student.restore` audit. `mapAuditToInsert` resets `deleted_at`
   to `null` on the same write (`apps/backend/src/db/repositories/repositoryMappers.ts:96-101`).
3. `createdBy` is taken from the payload when present
   (`studentWriteUseCases.ts:52-55`) → attribution forgery on the row.

### D-03 — P1 — Bulk status change skips the enrollment-withdrawal pipeline

**Evidence.** The single edit path calls `withdrawEnrollmentsForStudentStatus` when
`studentStatusEndsEnrollments(previousStatus, next)` (`studentWriteUseCases.ts:219-226`).
`bulkUpdateStudentStatus` performs only a raw SQL status update
(`apps/backend/src/students/use-cases/studentOperationUseCases.ts:89-125` →
`apps/backend/src/db/repositories/studentRepositoryListOps.ts:39-66`) and never calls it. There is
no DB trigger on `students.status` (migration grep: only `updated_at`, `forbid_hard_delete`, and
date-column triggers), so nothing else ends the enrollments.

**Impact.** Bulk-marking a selection `graduated`/`transferred`/`inactive` leaves live enrollments:
seats stay held, freed-seat waitlist offers never fire, and withdrawal invoice settlement
(`settleEnrollmentWithdrawal`) is skipped. Single edit and bulk edit disagree on the domain result.

### D-04 — P1 — Server-side student validation is orphaned

**Evidence.** `validateStudentDynamic` (`apps/backend/src/services/studentValidationService.ts:73`)
has **no production caller** — `grep -rn "validateStudentDynamic" apps/backend/src` returns only
the definition and the still-present mock in `students.integration.test.ts:73`. Commit `7b9e5072b`
("align contract routing…") deleted `await validateStudentDynamic(tenant, body, lang)` from both
create and update in `routes/tenant/students/studentCrudRoutes.ts`. `buildStudentWriteSchema` — the
strict, tenant-aware allowlist — is likewise referenced only by its own spec
(`packages/shared/src/__tests__/studentWriteSchema.test.ts`); the HTTP boundary uses the
`.passthrough()` wire schema (`students.dto.ts:84-88`). Blueprint-version conflict detection
(`verifyBlueprintVersion`) therefore no longer runs for students, while contacts still enforce it
(`apps/backend/src/contacts/use-cases/contactBlueprintValidation.ts:49`).

**Impact.** Setup-configured required fields, custom-field typing and blueprint staleness are
enforced only in the browser. Any REST client can persist a student that violates the tenant's
published field contract; unknown keys are stored in `custom_fields`
(`studentRepositoryPersist.ts:53-65`) and echoed back at top level
(`studentRepositoryMappers.ts:29-38`) — D-17.

### D-05 — P2 — Restore of an active student is reported and audited as a restore

**Evidence.** `restoreStudentById` returns the existing row when it is not deleted
(`apps/backend/src/students/use-cases/studentRestoreUseCases.ts:43`), and the generic route audits
unconditionally (`apps/backend/src/lib/crudSingleDeleteRestoreRoutes.ts:117-124` +
`routes/tenant/students/studentSoftDeleteRoutes.ts:45-47`). Contacts fixed the identical defect by
returning `null` (`apps/backend/src/contacts/use-cases/contactRestoreUseCases.ts:40-42`, "C-07").
The current behaviour is pinned by `studentUseCases.test.ts:334`.

**Impact.** The audit chain accumulates `student.restore` rows for restores that never happened, and
the client is told the (never deleted) record was restored.

### D-06 — P2 — Sibling/family filter targets columns nothing writes

**Evidence.** Guardian links are stripped before persistence by design —
`normalizeStoredStudent` removes `fatherContactId`/`motherContactId`/`guardianContactId` and the
matching names (`packages/shared/src/students/studentUtils.ts:28-47`,
`apps/backend/src/students/use-cases/studentNormalizeUseCases.ts:74-106`), so
`students.father_contact_id` etc. are always `NULL` for modern rows. Yet the list filter matches
those columns (`apps/backend/src/db/repositories/studentRepositoryListQuery.ts:161-174`) and the
contact delete guard reads them (`apps/backend/src/db/repositories/studentDeleteGuard.ts:67-79`).
The student detail drawer drives the Sibling section with exactly that filter
(`apps/frontend/src/tenant/features/students/hooks/useStudentDetailModel.ts:125-146`).

**Impact.** The Sibling section of the student detail drawer is always empty for modern rows, and
the `fatherName` fallback matches `students.father_name`, which is also always `NULL`. The guardian
triad is only discoverable through `contact_relationships` — which no students query joins.

### D-07 — P2 — Restricted custom-field values leak through `customFields`

**Evidence.** Reads flatten `custom_fields` onto the record **and** keep the nested map
(`apps/backend/src/db/repositories/studentRepositoryMappers.ts:29-38`). The viewer sanitizer deletes
only top-level keys (`packages/shared/src/students/studentsResponseSanitizer.ts:70-98`), so a field
key removed at the top level remains readable inside `customFields`.

**Impact.** A role that may not read a Setup field still receives its value. Contacts' equivalent
"scalar field" gap was fixed as C-04; this variant is specific to the students custom-field map.

### D-08 — P2 — GR/Student-ID casing is destroyed on write

**Evidence.** `prepareStudentRecord` lowercases `grNumber` and `studentId`
(`studentNormalizeUseCases.ts:101-103`) and persistence lowercases again
(`studentRepositoryPersist.ts:71-72`). The SSOT formatter preserves literal template case — its own
spec expects `GR26001` for the template `GR{yy}{seq}`
(`packages/shared/src/students/studentRegistrationUtils.test.ts:38-41`).

**Impact.** The GR previewed by `GET /next-gr-number` (e.g. `GR26001`) is stored and redisplayed as
`gr26001`. Case-insensitive uniqueness is already guaranteed by the
`lower(btrim(gr_number))` partial unique index (`0165_students_db_improvements.sql:11-15`).

### D-09 — P2 — Status change commits before the withdrawal

**Evidence.** `updateStudentById` returns from `runInTransaction`
(`studentWriteUseCases.ts:181-217`) and only then withdraws enrollments
(`studentWriteUseCases.ts:219-226`). Any failure in the enrollment/finance pipeline leaves the
status persisted with live enrollments, and the request already broadcast `students`.

**Impact.** Non-atomic cross-domain transition; the two halves can disagree permanently.

### D-10 — P2 — Contract drift

**Evidence.**
- `getLookupKind` (`GET /api/students/lookups/:kind`) is declared
  (`packages/shared/src/contracts/students.contract.ts:192-197`) but
  `registerModuleLookupRoutes` only registers `GET /lookups` and `PUT /lookups/:kind`
  (`apps/backend/src/lib/registerModuleLookupRoutes.ts:38,49`). The path is unreachable, and
  `loadStudentLookupKind` has no consumer outside its spec
  (`apps/backend/src/students/use-cases/studentLookupsService.ts:29`).
- Export (`POST /export/csv`) and import (`POST /import`) return `202 {job}` but are absent from the
  contract; the FE calls them by raw path
  (`apps/frontend/src/lib/backgroundJobs/startServerStudentsCsvExport.ts:12`).
- `mapStudentRestoreError` can answer 400 (`studentSoftDeleteRoutes.ts:19-31`) while `restore` /
  `bulkRestore` declare no 400 (`students.contract.ts:37-83`).

**Impact.** A typed client can generate a call to a route that 404s; error surfaces are not
representable by the contract types.

### D-11 — P2 — Search omits the fields the manifest declares searchable

**Evidence.** `studentsModuleManifest.ts:88-95` declares `searchableFieldKeys` including
`fatherName`/`guardianName`; the search predicate covers GR, student id, contact name, CNIC, phones
and emails only (`studentRepositoryListQuery.ts:77-81`).

**Impact.** Searching a guardian's name returns nothing, and because of D-06 the fallback columns are
`NULL` anyway.

### D-12 — P3 — Bulk id lists are not deduped

**Evidence.** `bulkSoftDeleteStudents` iterates the raw `ids` and pushes duplicates into `toSave`
(`studentSoftDeleteUseCases.ts:46-59`), then writes one audit/outbox event per entry
(`:92-100`). `bulkRestoreStudents` does the same (`studentRestoreUseCases.ts:146-197`), and a
duplicate that carries a `contactId` is additionally mis-reported as a conflict (`:152-160`). The SQL
layer *does* dedupe (`studentRepositorySoftDelete.ts:20,63`), so `succeeded` disagrees with the
persisted result.

**Impact.** Inflated counts and duplicate `DELETE`/`RESTORE` rows in the audit chain (contacts C-08
parity).

### D-13 — P3 — `export-audit` persists a client-supplied count

**Evidence.** `packages/shared/src/contracts/students.contract.ts:84-94` and
`apps/backend/src/lib/registerModuleCsvExportRoutes.ts:118-149` write `count`/`scope` from the
request body into the audit chain; the FE calls it from
`apps/frontend/src/tenant/features/students/hooks/useStudentsExportActions.ts:32,81`. The queue path
already writes an authoritative audit row. Contacts fixed C-09 by passing
`registerExportAudit: false` (`routes/tenant/contacts/contactAuditExportRoutes.ts:39`) and removing
the contract entry.

**Impact.** A caller can forge export-audit volume.

### D-14 — P3 — Bulk-status audit is not subject-scoped

**Evidence.** `auditStudent(user, "student.bulk_status", …)` is called without an entity id
(`studentOperationRoutes.ts:42-46`), so `createCollectionAuditHelper` records both `recordId` and
`subjectId` as `"students"` (`apps/backend/src/lib/createCollectionAuditHelper.ts:30-63`). The raw
SQL also never sets `updated_by` (`studentRepositoryListOps.ts:49-64`), unlike soft delete which
writes one subject-scoped event per row (`studentSoftDeleteUseCases.ts:92-100`).

### D-15 — P3 — Write responses are un-hydrated

**Evidence.** `createStudent`/`updateStudentById` return the normalized record
(`studentWriteUseCases.ts:152,215`); GET and list hydrate from contacts
(`studentLoadEntityUseCases.ts:35,49`). The FE discards the body and refetches, so this is cosmetic
today.

### D-16 — P3 — No length bounds on free-text writes

**Evidence.** `students.dto.ts:27-52` declares `z.string()` for `name`, `notes`, `email`, `cnic`,
`grNumber`, `studentId`. Oversized input reaches the column and fails as a 500 instead of a 400.

### D-17 — P3 — Unknown keys persist into `custom_fields`

Subsumed by D-04: the `.passthrough()` wire schema accepts arbitrary keys, and
`extractStudentCustomFields` stores them (`studentRepositoryPersist.ts:53-65`), which are then
re-emitted at top level (`studentRepositoryMappers.ts:29-38`). Fixing D-04 with the strict schema
closes this.

### D-18 — P3 — Guardian reconciliation passes stripped values

**Evidence.** `createStudent`/`updateStudentById` call `reconcileContactSystemTags` with
`merged.fatherContactId`/`motherContactId`/`guardianContactId` (`studentWriteUseCases.ts:105-114,
201-214`), but those keys were already removed by `normalizeStoredStudent` (see D-06). The calls are
effectively `[contactId, undefined, undefined, undefined]`.

### D-19 — P3 — Cursor pagination overrides sort

**Evidence.** `studentRepositoryListPage.ts:32-43` forces `id asc` whenever `afterId` is supplied,
silently ignoring `sortField`/`sortDir`. The frontend never sends `afterId`
(`useStudentsQueries.ts:42` carries the type only), so this is a latent API inconsistency.

### D-20 — P3 — Sanitizer fails open

**Evidence.** `apps/backend/src/students/use-cases/studentSanitizeUseCases.ts:22-30` returns the
input untouched when no config is loaded; the loader returns `null` when the tenant has no row
(`apps/backend/src/lib/createModuleFieldConfigService.ts:31-37`). Pinned by
`studentUseCases.test.ts:598,652`. Contacts C-10 parity — the export path in contacts explicitly
falls back to the seeded defaults instead.

### D-21 — P3 — `new` filter unindexed; GR lock spans the create tx

**Evidence.** The `quickFilter=new` predicate
`COALESCE(registered_on::timestamptz, created_at)` (`studentRepositoryListQuery.ts:119-124`) had no
supporting index. The GR generator takes `SELECT … FOR UPDATE` on `student_sequence_config`
(`studentRepositorySequence.ts:31-41`) and `withTenant` reuses the caller's transaction
(`apps/backend/src/db/tenant-context.ts:68-92`), so the row lock is held until the whole create
commits; the bootstrap branch additionally set `app.include_deleted = 'true'` for the remainder of
that transaction (`studentRepositorySequence.ts:42`).

**Resolution.** The proposed expression index is **impossible**: `date → timestamptz` depends on the
session `TimeZone`, so it is not IMMUTABLE and PostgreSQL rejects it in an index — and `CONCURRENTLY`
cannot live in a migration at all (Drizzle wraps migrations in one transaction). Instead the predicate
was rewritten as two OR-ed comparisons (`registered_on >= since::date` with a `created_at` fallback
for rows without a registered date), which lets the existing
`students_workspace_registered_on_idx` and `students_workspace_created_at_active_idx` serve it via a
BitmapOr — proven by an `EXPLAIN` assertion. The GUC leak was fixed with
`withIncludeDeletedScope`, which restores the previous `app.include_deleted` value in `finally`.
The `FOR UPDATE` lock span remains accepted (single per-tenant registration row).

### F-01 — P1 — Writes are status-blind

**Evidence.** `apps/frontend/src/lib/api.ts:54-64` throws only for 401/403 — documented at
`apps/frontend/src/lib/apiContractError.ts:36-44` ("the ts-rest fetcher only throws for 401/403, so
feature hooks inspect the envelope themselves"). `useStudentsCrudActions.ts:30-46` returns
`res.body` without inspecting `res.status`, so `studentFormSaveFlow.ts:108-118` closes the form and
resets the baseline; `:61-74` shows "archived + Undo" although the delete guard answers 409
(`apps/backend/src/__tests__/studentDeleteGuard.test.ts:42-74`).

### F-02 — P1 — Save deadlocks after a validation error

**Evidence.** `useStudentFormActionHandlers.ts:88-90` sets `savingRef.current = true` before calling
the flow; `studentFormSaveFlow.ts:66-74` returns `false` on zod errors without `setSaving(false)`
(only the GR/duplicate branches at `:96`,`:104` clear it). Every later Save click hits
`if (savingRef.current) return false` with no feedback.

### F-03 — P1 — GR conflict by substring

**Evidence.** `studentFormSaveFlow.ts:121-126`: `errText.includes("gr")` over the lower-cased
message. Any failure whose text contains "gr" ("grade", "agreement", "progress", a 403 body) is
reported as a duplicate GR, scrolled to `grNumber`, and the real error is swallowed. Because 409
never throws (F-01) the branch is also unreachable for the case it exists to catch.

### F-04 — P2 — Setup save reports success on failure

**Evidence.** `useStudentsSetupSaveActions.ts:35-53` awaits `mutateAsync` then unconditionally
`notify.success(...)` and `setSaved(true)`.

### F-05 — P2 — Two list-key conventions

**Evidence.** The live key is ad hoc (`useStudentsQueries.ts:90-97`
`[...STUDENTS_QUERY_KEY, "contract", query]`); the declared builders
(`hooks/studentsListQueryBuilders.ts:21-42`) are imported only by their spec and the barrel
(`studentsQueryKeys.ts:16-21`). `studentsListQueryOptions` (`useStudentsQueries.ts:47-62`) reuses
the identical key with a different queryFn and is exported on the cross-module facade
(`tenant/hooks/collections/students.ts:29`). Trash/active separation is safe
(`includeDeleted` is part of the key, `useStudentsPageWorkQuery.ts:51`).

### F-06 — P2 — Bulk enroll leaves Enrollments stale

**Evidence.** `useStudentsQueries.ts:127-135` invalidates students + `SESSIONS_QUERY_KEY`;
`ENROLLMENTS_QUERY_KEY` is never referenced in the students tree.

### F-07 — P2 — GR-migration flag is not tenant-scoped

**Evidence.** `useGrMigration.ts:8,10-24,40` uses the constant key
`mms_students_gr_migration_v1`. Once one workspace runs the backfill in a browser, every other
workspace on that browser is skipped, and the flag survives logout.

### F-08 — P2 — Printed ID cards ignore the workspace name

**Evidence.** `StudentIdCardModal.tsx:36` defaults `madrasaName` to the product name (repeated in
`card-template/StudentCardPrintPreview.tsx:40` and `useStudentCardSampleData.ts:35`);
`StudentsPageOverlays.tsx:131-136` never passes branding, while faculty does
(`features/faculty/components/FacultyPageOverlays.tsx:138`).

### F-09 — P3 — Dead / duplicate exports

Barrel-only with no application consumer: `useStudentsInfiniteList`,
`useStudentsContractNextGrNumber`, `useStudentsContractDuplicateCheck`, `studentsListQueryOptions`,
`studentsInfiniteQueryOptions` (`tenant/hooks/collections/students.ts:29-39`).
`useStudentsContractNextGrNumber` (`useStudentsQueries.ts:137-152`, key `…/"next-gr"`) duplicates
the live `useStudentNextGrNumber` (`useStudentsAnalyticsQueries.ts:29-51`, key `…/"next-gr-number"`).

### F-10 — P3 — The "None" sort option cannot clear sorting

**Evidence.** `StudentsFiltersMenuButton.tsx:123-129` maps "None" to `onSortChange("name")`;
`useStudentsDirectoryFilters.ts:100-110` then sorts by name.

### F-11 — P3 — Contact tags are not invalidated

**Evidence.** `invalidateStudentsQueries.ts` covers students list/metrics/widgets/preferences/
lookups only. The backend reconciles `Student`/`Guardian` contact tags on every student write
(`studentWriteUseCases.ts:105-114,142-151,201-214`) without broadcasting contacts
(`apps/backend/src/contacts/systemTags/contactSystemTagUseCases.ts` has no broadcast/invalidate), so
the contacts directory shows stale tags until an unrelated refetch.

### Test findings

- **T-01.** No spec in the students tree mocks a 400/409 — F-01…F-04 are green in CI by construction.
- **T-02.** `studentsResponseSanitizer.ts` has no spec; D-07 is unguarded.
- **T-03.** `students.integration.test.ts:49` and `studentsSoftDelete.integration.test.ts:49` mock
  `studentUseCases`, so route↔domain drift (D-01, D-03, D-04) cannot surface.
- **T-04.** `studentsDbImprovements.test.ts:28-37`, `studentsDeferredDbMigrations.test.ts:8-50` and
  `studentRepositoryListContactSsot.test.ts:5-43` assert source text rather than behaviour.
- **T-05.** `e2e/tests/tenant/tenant-operations-flow.spec.ts:64-77` only loads `/students` and toggles
  trash; no bulk, restore, import or export flow.

## 5. Resolution log

| ID | Status | Fix | Guard |
| --- | --- | --- | --- |
| D-01 | Fixed | `studentsImportService` (contact resolve/reuse → `createStudent`) + `students:import` runner registered in `registerDefaultBackgroundJobRunners` | `studentsImportJob.test.ts` |
| D-02 | Fixed | `studentCreateGuard` rejects an active id with 409 and routes an archived id through the delete-permission-gated restore; session attribution no longer read from the payload | `studentCreateIdCollision.test.ts` |
| D-03 | Fixed | shared status-transition pipeline used by single edit + bulk status | `studentStatusTransition.test.ts` |
| D-04 | Fixed | strict `buildStudentWriteSchema` + `collectStudentDynamicIssues` + blueprint lock re-wired at the route boundary | `studentWriteValidation.test.ts` |
| D-05 | Fixed | restoring an active student returns `null` → 404, no audit/outbox row | `studentUseCases.test.ts`, `students.integration.test.ts` |
| D-06 | Fixed | sibling/family filters also match `contact_relationships` on the primary contact; legacy columns kept for pre-migration rows | `studentRepositoryListContactSsot.test.ts` |
| D-07 | Fixed | sanitizer strips restricted keys from the nested `customFields` map too | `studentsResponseSanitizer.test.ts` |
| D-08 | Fixed | GR/Student-ID casing preserved; case-insensitive uniqueness stays on the `lower(btrim(...))` indexes | `studentNormalizeUseCases.test.ts`, `studentUseCases.test.ts` |
| D-09 | Fixed | the withdrawal runs inside the status transaction (single + bulk) | `studentStatusTransition.test.ts` |
| D-10 | Fixed | removed the unregistered `getLookupKind`; restore/bulk-restore declare 400; `exportAudit` removed | `students.integration.test.ts`, typecheck |
| D-11 | Fixed | search matches guardian names through `contact_relationships` | `studentRepositoryListContactSsot.test.ts` |
| D-12 | Fixed | ids deduped before the loops → truthful counts, one audit row per student | `studentUseCases.test.ts`, `studentStatusTransition.test.ts` |
| D-13 | Fixed | `registerExportAudit:false`, contract entry removed, FE `logExportAudit` path deleted | `students.integration.test.ts` |
| D-14 | Fixed | one subject-scoped audit row per changed student; `updated_by` stamped in the bulk UPDATE | `studentStatusTransition.test.ts` |
| D-15 | Deferred | FE refetches after save; no consumer needs the hydrated body | — |
| D-16 | Fixed | `max()` bounds mirrored from the Drizzle column widths | `studentWriteValidation.test.ts` |
| D-17 | Fixed | closed by D-04's strict `.strict()` allowlist | `studentWriteValidation.test.ts` |
| D-18 | Documented | the guardian/id argument lists are kept for legacy rows only; guardians reconcile through the contact graph (see D-06) | `studentUseCases.test.ts` |
| D-19 | Accepted | keyset paging stays id-ordered by contract: a bare-`id` cursor cannot honour a column sort without a composite cursor, and no consumer sends `afterId` with a sort. Documented in `studentRepositoryListPage.ts` | code comment |
| D-20 | Fixed | falls back to the seeded defaults instead of passing the raw record through; behaviour-neutral on today's seed (no disabled/role-restricted seed fields), so no dedicated spec | `studentUseCases.test.ts` (pass-through cases) |
| D-21 | Fixed | "new" filter rewritten as two OR-ed comparisons so the existing date indexes serve it (the `date::timestamptz` expression could never be indexed — not IMMUTABLE); GR sequence seeding now runs inside `withIncludeDeletedScope`, restoring the GUC even on failure | `studentsNewFilterDb.integration.test.ts` (behaviour + `EXPLAIN` plan), `studentSequenceIncludeDeletedScope.test.ts` |
| F-01 | Fixed | `assertContractOk` on all nine student mutation wrappers | `useStudentsCrudActions.test.tsx` |
| F-02 | Fixed | `try/finally` clears the saving latch on every exit | `studentFormSaveFlow.test.ts` |
| F-03 | Fixed | GR conflict keyed on 409 + `errors[0].field === "grNumber"` (`studentFormApiErrors.ts`); a server 409 now carries `errors[]` | `studentFormSaveFlow.test.ts` |
| F-04 | Fixed | `saveStudentPreferencesAsync` asserts the contract status, so a 400/500 rejects before the success toast | `studentSetupConfigApi.test.ts`, `useStudentsSetupSaveActions.test.tsx` |
| F-05 | Fixed | one list key (`studentsListQueryKey`) with one cached shape (the contract envelope): `studentsListQueryOptions` is the only factory and the ts-rest hook stores the same shape; the unused duplicate builders/factory were deleted | `queryFactories.test.ts` parity |
| F-06 | Fixed | `invalidateStudentsBulkEnrollQueries` covers enrollments + sessions | `invalidateStudentsQueries.test.ts` |
| F-07 | Fixed | GR-migration gate is workspace-scoped via `scopedStorageKey` | `useGrMigration` behaviour |
| F-08 | Fixed | `useBranding().madrasaName` threaded into the ID-card modal/print preview | `StudentsPageOverlays.test.tsx` |
| F-09 | Fixed | dead/duplicate hooks removed (next-GR duplicate, infinite-list/contract factories) | typecheck |
| F-10 | Fixed | "None" resolves to `null` and clears the sort | `StudentsFiltersMenuButton.test.tsx` |
| F-11 | Fixed | student invalidation also refreshes the contact caches | `invalidateStudentsQueries.test.ts` |

## 6. Deferred & accepted

- **D-15** — un-hydrated write responses: the client discards the body and refetches; no consumer
  depends on it. Revisit only if a caller starts reading the create/update body.
- **D-21** — accepted: the GR `SELECT … FOR UPDATE` on `student_sequence_config` is still held for the
  whole create transaction. That is one row per tenant at registration volume; a composite cursor or
  a pre-reserved batch design would be needed before bulk admissions import.
- **Import semantics** — student import creates new records from the transfer entity (it carries
  `name`, not `id`); it never overwrites an existing student. Overwrite-on-import remains
  unsupported by design (use backup restore for that).
- **Guardian triad** — guardian links stay in the contact relationship graph; the students table
  columns are intentionally never written (`mms-student-lifecycle` §1).
- **Import scope** — the CSV import creates a person contact per row (reusing an existing contact by
  phone/email) and then a student through `createStudent`. It deliberately does **not** import
  enrollments (`enrolledSessions` is ignored — enrollments are their own module) and does not create
  guardian relationships from `fatherName`/`motherName`/`guardianName`.

## 7. Adversarial audit

Four-vector pass over the changed code (`mms-completion-review` §4).

**Edge cases.** Create with an id owned by another tenant → no collision in this tenant, inserts
normally (composite PK is tenant-scoped). Create with an id owned by a soft-deleted row and no
delete permission → 403, row untouched. Bulk status with duplicate ids → deduped before counting and
withdrawing. Bulk status to the current status → no withdrawal, no audit (nothing changed). Restore
of an active row → 404, no audit. Import row without `name` → per-row error, batch continues. Import
row whose contact belongs to an archived student → per-row "requires delete permissions" error.
GR template with literal case → stored verbatim, uniqueness still case-insensitive.

**Failure modes.** Enrollment withdrawal throws inside the status transaction → the status write is
rolled back (single and bulk), and no live-push is sent. Bulk import row fails → counted in `errors`
with its position, batch continues. Sanitizer receives a record without `customFields` → top-level
stripping only. `collectStudentDynamicIssues` throws on a stale blueprint → mapped to 409, not 500.
Queue unavailable on export/import → 503 from the shared registrar.

**Security / multi-tenancy.** Every new query is tenant-predicated (`workspace_subdomain` on students
and `contact_relationships`). `buildStudentWriteSchema` rejects unknown keys, so no mass-assignment
into `custom_fields`. Attribution is stamped from the session (`createdBy`/`updatedBy`,
`realUserId`), never from the payload. A soft-deleted student can only be revived through
`students.delete`. `export-audit` no longer accepts a client count. Field visibility now also covers
the nested `customFields` map and no longer fails open without a config row.

**Concurrency.** Two concurrent creates with the same supplied id: both pass the pre-write probe and
the upsert resolves last-writer-wins (same semantics as an update; no uniqueness invariant is
violated). Two concurrent bulk status changes: each transition withdraws the enrollments it sees;
the enrollment pipeline is idempotent per enrollment (already-withdrawn rows are skipped). GR
reservation still uses `SELECT … FOR UPDATE` on `student_sequence_config` (D-21 documents the lock
scope, accepted), and its bootstrap now restores the caller's `app.include_deleted` scope. The `new`
filter is index-servable after the D-21 rewrite (asserted by an `EXPLAIN` test).

## 8. Verification evidence (post-fix)

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, backend, frontend, e2e, ui) | **Pass** |
| `@mms/shared` full suite | **237 files / 1,785 tests passed** |
| `mms-backend` full suite | **360 files / 2,493 tests passed** (one pre-existing `questionBankUseCases` flake under full parallelism — passes in isolation) |
| `mms-frontend` full suite | **1,074 files / 3,910 passed, 2 skipped** |
| `mms-backend` students-only suites | **26 files / 195 tests passed** |
| `mms-frontend` students-only suites | **63 files / 197 tests passed** |
| `check:docs` / `check:code-norms` / `check:frontend-structure` / `check:backend-boundaries` / `check:db-projections` / `check:work-directory` / `check:shared-ui` / `check:shared-structure` | **Pass** (0 new offenders; 4 over-300-LOC files unchanged) |
| `check:i18n` | 9,480 keys; ar/ur/fa missing = 0 |
| Lint on every changed path | **Pass** (including the `mms-boundary/no-cross-feature-imports` rule) |
| `pnpm --filter mms-backend test:db` (real PostgreSQL) | **54 files / 211 passed, 1 skipped** — includes `studentSoftDeleteCascadeDb`, `crossTenantIsolation` (8 tests), and `studentsNewFilterDb` (behaviour + `EXPLAIN` plan) |
| Changed-file coverage gate — backend (`scripts/ci/check-changed-coverage.mjs`) | **66.6 % of 1,163 changed statements ≥ 60 % — pass** (1,163 statements; every changed file ≥ 20 statements now executed). Run with `git add -N` on the untracked files so the gate sees the same diff a PR would |
| Changed-file coverage gate — frontend | **64.3 % of 538 changed statements ≥ 60 % — pass** (was 23.6 % before the hook specs). Clean run needs `--maxWorkers=4` (the CI setting): under full local parallelism a pre-existing `ClassModal` test times out |
| Whole-tree coverage floors (`vitest.config.ts`) | Backend **47.54 / 45.32 / 43.49 / 36.4** vs 44 / 42 / 40 / 32; frontend **43.89 / 42.93 / 35.89 / 41.86** vs 42 / 41 / 34 / 40 — **pass** |
| Remaining cheap CI gates (`check:backend-structure`, `check:shared-purity`, `check:migration-indexes`, `check:migration-hygiene`, `check:migrations-forward-only`, `check:tdd-pairing`, `check:secrets`) | **Pass** (backend-structure improved: 54 use-case files without a companion test vs baseline 55) |
| `pnpm --filter mms-backend test:rls` | **Blocked by the runtime role** — the local `apps/backend/.env` connects as `postgres`, so the suite refuses to prove isolation by design (the backend logs the same at boot: `[rls] the database role bypasses row-level security`). CI provisions `mms_app` (`NOSUPERUSER NOBYPASSRLS`). Environment left untouched |
| Playwright `tenant-academic-flow` | **Passed** — creates contacts, registers a student with a guardian relationship through the real form (this exercises the re-wired strict + blueprint validation and GR generation), and submits class attendance. Re-run green after the platform-user reset |
| Playwright `tenant-critical-lifecycles` | **Passed** — admissions → enrollment lifecycle, LTR + RTL |
| Playwright `tenant-operations-flow` | **Passed** with `ALLOW_RESET_PLATFORM_USERS=true` (local platform users reset so the first-run setup page renders; tenant data untouched). Without the flag it stops at platform bootstrap, which is the helper's safeguard, not a code defect |
| Playwright `a11y-populated` (axe) | **9 passed** — including the students directory grid and the student detail drawer; the spec seeds 20 students through `POST /api/students` against this change set |

**Freshness proof for the browser run.** The dev stack was restarted from the working tree and the
running server was proven current before the specs: `POST /api/students/export-audit` → `404 Route
not found` (endpoint removed by this change set), `POST /api/students/bulk-status` and
`POST /api/students/import` → `401` (present), unknown `/api/*` → `404`.

**Handover note.** The change set is left uncommitted on purpose. The dev servers now run the current
working tree (backend, worker and frontend were restarted; `screen` cannot spawn shells inside the
agent sandbox, so they run under a managed session job — run `./restart_servers.sh` from your own
terminal to put them back under screen). To finish the last layer, run the RLS suite against the
dedicated role:

```bash
DATABASE_URL="postgresql://mms_app:$MMS_DB_PASSWORD@localhost:5432/mms" \
MMS_DB_ROLE_ENFORCEMENT=strict \
pnpm --filter mms-backend test:rls
```


