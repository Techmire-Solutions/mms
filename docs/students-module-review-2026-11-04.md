# MMS Students Module Re-Review — 2026-11-04

Independent, read-only review of the students domain at `main` (`ab9874cab`, working tree clean at
review time), **re-verifying** the 2026-11-03 / #269 round and auditing what it did not cover. Line
numbers below are from the tree as reviewed (`ab9874cab`); the resolution log (§6) names the files
that changed.

Scope: `apps/backend/src/routes/tenant/students/**`, `apps/backend/src/students/**`,
`apps/backend/src/db/repositories/student*`, `apps/backend/src/db/schema/students.ts` +
`studentSetupTables.ts`, `apps/backend/src/services/student{Validation,Export}Service.ts`,
`packages/shared/src/students/**`, `packages/shared/src/schemas/students.dto.ts`,
`packages/shared/src/contracts/students*.ts`, `apps/frontend/src/tenant/features/students/**`, the
students module manifest/route registration, and the module-access route table. Contacts,
enrollments and finance were inspected only where students calls them.

---

## 1. Baseline evidence (pre-fix)

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend test student` | **26 files / 195 tests passed** |
| `pnpm --filter mms-frontend test features/students` | **63 files / 197 tests passed** |
| `moduleAccessCoverage.test.ts` / `routeAccess.test.ts` | 1 / 11 passed |
| `check:code-norms` | 0 `any`, 0 arbitrary colours, 4 files >300 LOC (baseline 4, none in students) |
| `check:i18n` | 9,515 keys; ar/ur/fa missing = 0 |
| `check:work-directory` / `check:db-projections` / `check:backend-boundaries` / `check:frontend-structure` / `check:shared-ui` | 0 offenders |
| `node scripts/verify-rules-integrity.mjs` | pass (24 rules, 50 skills) |
| `test:db` (real PostgreSQL) | not run *at baseline* — run afterwards, see §10 |

## 2. Verdict

The module is structurally sound and the #269 fixes hold: the import job runner is registered,
create-time id collisions are gated, bulk status runs the enrollment-withdrawal pipeline in the same
transaction, the strict + blueprint validation is re-wired, and the frontend inspects contract
statuses. What the ratchets and the previous round did **not** cover is **execution completeness**:
one export path silently truncated, one audit field was client-writable, one report field was
unimplemented, and the directory's bulk selection could outlive its view. Those are fixed here.

## 3. Findings summary

### Critical / Major

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| C1 | **Critical** | Export | Student CSV/XLSX/JSON export silently truncated to its first page (100 / 250 rows) |
| M1 | **Major** | Write path / audit | Client-supplied `createdAt` was persisted on create (audit/date forgery) |
| M2 | **Major** | Data layer | `repo.save` evicted the multi-tier cache **before** the surrounding transaction committed; create/update/restore never invalidated after commit |
| M3 | **Major** | Directory UX | Bulk selection survived filter/search/sort/page changes → destructive bulk actions could hit invisible rows |
| M4 | **Major** | Reports | The `age` report field is published as numeric but had no server expression → constant "Unknown" bucket, sum/avg always 0 |

### Minor

| ID | Finding |
| --- | --- |
| m1 | Module gate action ≠ handler action: `DELETE /:id`, restore, `bulk-delete`, `bulk-restore` resolved to `write`; `migrate-gr-numbers` resolved to `write` while the handler needs `setupWrite` |
| m2 | Five contract handlers returned 500 without logging (ts-rest bypasses the Fastify error pipeline) |
| m3 | Import row numbers restarted at 1 per 200-row chunk, so later chunks' errors were mislabelled |
| m4 | The composed settings were loaded twice on every student write |
| m5 | Write DTO could not round-trip the read shape (`customFields` rejected by the strict allowlist) |
| m6 | Restore's DB unique-violation race was mapped to 400 instead of 409 |
| m7 | Bulk restore counted before writing, discarded the repo's counts, and stamped enrollments with a different `restoredAt` than the rows |
| m8 | Bulk delete/restore cleared the selection on failure; bulk enroll closed the modal and discarded placement inputs |
| m9 | The "Filtered" KPI read 0 when the page opened on Reports/Setup |
| m10 | GR `{year}` came from server-local time on a UTC-midnight date (off-by-one west of UTC) |
| m11 | Bulk-restore pre-check fetched every active student's `contact_id` for the workspace |
| m12 | Pure computations wrapped as hooks without memoization; dead `sessions`/`studentStatusOptions` props |
| m13 | Dynamic blueprint validation was skipped when the tenant resolved empty (fail-open shape) |

### Test gaps (not defects)

- **T1** `studentRepositoryListPage.test.ts` asserted `skipCount` skipped the count but never that
  `hasMore` was truthful → C1 unpinned.
- **T2** `moduleAccessCoverage.test.ts` asserted that *an* action was stamped, never the intended
  one → m1 invisible.
- **T3** No spec covered the SQL widget field mapping (only the pure in-memory aggregate), the
  directory selection-vs-view lifecycle, or the bulk-action failure contract.

## 4. Findings detail

### C1 — Critical — Export stops after one page
`apps/backend/src/db/repositories/studentRepositoryListPage.ts:95`
```ts
const hasMore = isCursorPaging ? rows.length === limit : page * limit < total;
```
`apps/backend/src/services/studentsExportService.ts:69` walks with `skipCount: true`, so `total`
stays `0` (`:48-49`) and `hasMore` is always false on page 1. The export pager starts with no cursor
(`lib/csvExportStreamFactory.ts:66-68`), so `isCursorPaging` is false and no `nextCursor` is
emitted — the walk ends after 100 rows (CSV) / 250 rows (buffered). The shared helper this copy was
derived from has the missing branch (`db/repositories/listPageHelper.ts:100`) and
`__tests__/listPageExportRegression.test.ts` pins it for modules that use `runListPage`. #269 fixed
the *job runner*; row completeness was never exercised.

### M1 — Major — `createdAt` forgeable on create
`packages/shared/src/schemas/students.dto.ts:51` accepted `createdAt`; soft-delete stripping removes
only `deleted*`/`restored*`; `prepareStudentRecord` passed it through; `repositoryMappers.ts:103-105`
honoured it. `POST /api/students {"createdAt":"1999-01-01"}` stored the forged timestamp, corrupting
the audit trail and the `COALESCE(registeredDate, createdAt)` metrics. (The form does not echo it —
`lib/studentFormDraft.ts:19-20` lists it as volatile — so only a direct API client can exploit it.)

### M2 — Major — Cache eviction before commit
`db/repositories/studentRepositoryPersist.ts:129-136` evicted after `withTenant(...)`, but a nested
`withTenant` joins the caller's open transaction (`db/tenant-context.ts:75-81` +
`hasActiveTransaction()`). `createStudent`/`updateStudentById`/`restoreStudentById`/
`bulkRestoreStudents` all wrap `repo.save` in `runInTransaction`, so eviction ran pre-commit and
nothing re-invalidated after commit; a concurrent reader could repopulate the cache with the
pre-commit row, and a rolled-back transaction was never followed by an eviction. Bulk delete/status
already invalidated post-transaction — `save` was the outlier.

### M3 — Major — Selection outlives its view
`apps/frontend/src/tenant/features/students/hooks/useStudentsDirectoryFilters.ts:33-46` cleared
`selectedIds` only when the trash flag flipped. Bulk delete/status/export/ID-card bind to that
selection, so a confirmed bulk delete could archive rows that were no longer on screen. Contacts
clears on `${filterKey}|${listPage}` (`contacts/hooks/useContactsDirectoryFilters.ts:42-52`, R4-06).

### M4 — Major — `age` is a dead report field
`apps/frontend/src/lib/reports/reportMetadataFields.ts:20-25` publishes `age` (`isNumeric: true`) for
students, but `db/repositories/studentRepositoryWidgetsSql.ts:21-77` `resolveStudentFieldExpr` has no
`age` branch and falls through to `sql\`''\``. Any students widget grouped/filtered by age rendered
one constant `'Unknown'` bucket and sum/avg returned 0 (`studentRepositoryWidgetsAggregate.ts:62-78,
95-116`). Age is derived from the linked contact's `dob` (contacts SSOT); `gender`/`city` already
model the correct pattern.

### Minor findings

- **m1** `lib/moduleRouteActions.ts` had no students entry, so the HTTP-method default applied:
  `DELETE /:id` and the three restore/bulk-trash routes resolved to `write` (handlers require
  `students.delete`), and `migrate-gr-numbers` resolved to `write` (handler requires
  `settings.global.write`). A role holding `students.delete` without `students.write` was 403'd by
  the gate. No escalation (handlers re-check), but the declared requirement was wrong.
- **m2** `studentCrudRoutes.ts:106-111` (`catch {}`), `:205-212`, `:250-259`;
  `studentOperationRoutes.ts:50-62`, `:199-204` returned 500 with no log. Sibling handlers log
  (`:157`, `:135`) and `lib/contractError.ts` exists precisely because ts-rest bypasses Fastify's
  error pipeline.
- **m3** `students/use-cases/studentImportUseCases.ts:104` numbered rows `index + 1` inside the
  chunk; `importPipelineRunner.ts:96-101` persists one chunk per `maxBatch` (200) without passing the
  position, so errors from row 201 onwards were reported as rows 1-200.
- **m4** `routes/.../studentWriteValidation.ts:97` loaded the composed settings, then
  `services/studentValidationService.ts:87` loaded them again for the same write (2 field-config +
  2 preferences reads per create/update).
- **m5** `db/repositories/studentRepositoryMappers.ts:38` emits `customFields`; the strict write
  allowlist (`students.dto.ts:56-57`, `studentValidation.ts:19-51`) rejected it, so a GET → PUT echo
  answered 400 `Unknown field "customFields"`.
- **m6** `students/use-cases/studentRestoreUseCases.ts:87-99` converted a 23505 on restore into
  `StudentRestoreConflictError` (mapped to 400 by `studentSoftDeleteRoutes.ts:19-31`);
  `mms-data-layer` §6.10 requires 409 for that race. The `msg.includes("student_id")` match was also
  fragile against the real constraint names.
- **m7** `studentRestoreUseCases.ts:220-250` incremented `succeeded` before the write, discarded the
  `{succeeded,failed}` returned by `repo.bulkRestore`, and stamped enrollments with a fresh
  `new Date()` while rows carried per-row `restoredAt` values.
- **m8** `students/hooks/useStudentsPageOverlayProps.ts:71-74, 86-89` cleared the selection after the
  awaited handler resolved even on failure (the crud handlers swallowed the error);
  `StudentsBulkEnrollModal.tsx:44-55` + `useStudentsWorkTierSource.ts:98-105` closed the modal and
  discarded the placement inputs on failure.
- **m9** `useStudentsPageController.ts:68` gated the list query on `effectiveTab === "work"` while
  `StudentsPageView.tsx:66` feeds the "Filtered" KPI from `shownCount` → 0 on a persisted
  Reports/Setup landing.
- **m10** `studentRepositorySequence.ts:25, 129` and `studentRepositoryWidgetsOps.ts:37` derived the
  GR year with `new Date(regDate).getFullYear()`; a date-only string is UTC midnight, so a server
  west of UTC read 1 January as the previous year, rolling `{year}` and defeating the annual restart.
- **m11** `studentRepositoryWidgetsOps.ts:21-27` selected every active student's `contact_id` with no
  bound; `studentRestoreUseCases.ts:144` called it on every bulk restore.
- **m12** `hooks/useStudentsSelectionTargets.ts:14` and `useStudentsPageDirectoryProps.ts:12-14`
  rebuilt arrays on every render; `StudentsListDesktopTable.tsx:51`, `StudentsListCards.tsx:17`, and
  `StudentsBulkActionBar.tsx:51` accepted unused props.
- **m13** `studentWriteValidation.ts:111-112` skipped the dynamic blueprint layer entirely when both
  the request tenant and the ALS tenant were empty. Unreachable through authenticated HTTP today;
  defence in depth.

## 5. Test gaps closed

| Gap | Guard added |
| --- | --- |
| T1 | `studentRepositoryListPage.test.ts`: `skipCount` + full page ⇒ `hasMore: true`; a 3-page `generateCsvStreamChunks` walk asserts every row is emitted |
| T2 | `moduleAccessCoverage.test.ts`: `EXPECTED_MODULE_ROUTE_ACTIONS` table asserts the intended action per students route, with a stale-entry check |
| T3 | `studentsWidgetFieldSql.test.ts` (SQL field mapping), `useStudentsDirectoryFilters.test.tsx` (selection lifecycle), `useStudentsCrudActions.test.tsx` (bulk failure contract) |

## 6. Resolution log

| ID | Status | Fix | Guard |
| --- | --- | --- | --- |
| C1 | Fixed | `studentRepositoryListPage.ts` derives `hasMore` from page fullness when `skipCount` or cursor paging is in force (matches `listPageHelper.ts`) | `studentRepositoryListPage.test.ts` (Red: 2 failures → green) |
| M1 | Fixed | `stripStudentServerOwnedAuditFields` (shared) applied in `prepareStudentRecord`; attribution is stamped from the session after normalization | `studentNormalizeUseCases.test.ts` |
| M2 | Fixed | `invalidateStudentsCache()` runs in a `finally` after the create/update/restore transactions settle | `studentWriteCacheInvalidation.test.ts` (Red: 3 failures → green) |
| M3 | Fixed | `selectionScopeKey = ${filterKey}|${listPage}` clears the selection on any view change (trash flag is part of `filterKey`, so the old tracker is gone) | `useStudentsDirectoryFilters.test.tsx` (Red: 2 failures → green) |
| M4 | Fixed | `resolveStudentFieldExpr("age")` derives the age from `contacts.dob`; `age` added to the contact-join field set | `studentsWidgetFieldSql.test.ts` |
| m1 | Fixed | Students `delete`/`setupWrite` rules in `MODULE_ROUTE_ACTION_RULES` | `moduleAccessCoverage.test.ts` (Red observed: `DELETE /api/students/:id → write, expected delete`) |
| m2 | Fixed | The five handlers route failures through `handleContractError` | `contractError.test.ts` |
| m3 | Fixed | `ImportPipelineContext.offset` (additive) passed per chunk; students numbers errors `offset + index + 1` | `studentsImportJob.test.ts` (Red observed: row 1 vs 201) |
| m4 | Fixed | `collectStudentDynamicIssues` accepts preloaded settings; the route passes the ones it already loaded | `studentWriteValidation.test.ts` |
| m5 | Fixed | `customFields` accepted by the write DTO and dropped in `prepareStudentRecord` (flattened keys remain the write surface) | `studentWriteValidation.test.ts`, `studentNormalizeUseCases.test.ts` |
| m6 | Fixed | `StudentRestoreRaceError` (409 `conflict`); pre-validated conflicts stay 400 | `studentUseCases.test.ts` |
| m7 | Fixed | One `batchRestoredAt` for rows + enrollment cascade; the repo's restored count drives the result | `studentUseCases.test.ts` |
| m8 | Fixed | `handleBulkDelete`/`handleBulkRestore`/`handleBulkEnroll` resolve `false` on failure; callers clear/close only on success (`ConfirmAlertDialog` keeps the dialog open on `false`) | `useStudentsCrudActions.test.tsx` |
| m9 | Fixed | The list query is enabled on every tier; `useServerWork` still gates the Work UI | `useStudentsPageController.test.tsx` |
| m10 | Fixed | `resolveGrYear` parses the ISO prefix (no `Date` parse) and is reused by the widgets ops | `studentSequenceGenerator.test.ts` (Red observed with the old `Date` body) |
| m11 | Fixed | `listLinkedContactIds(tenant, excludeId, onlyContactIds?)` bounds the probe to the restore candidates | `studentUseCases.test.ts` |
| m12 | Fixed | `useMemo` on both pure-derivation hooks; dead `sessions` / bulk-bar `studentStatusOptions` props removed | typecheck + `features/students` suite |
| m13 | Fixed | Missing tenant throws a validation error instead of skipping the blueprint layer | `studentWriteValidation.test.ts` |

## 7. Deferred & accepted

### Closed in the same-day follow-up (§10)

- **Dead props (m12 half)** — removed.
- **Import per-row `broadcastCollection`** — one live push per chunk now.
- **GR backfill atomicity** — one `bulkSave` per chunk and an exact `hasMore`.
- **Unchunked `inArray`** — verified **not** a risk and dropped: callers bound the id set (export
  `includeIds` chunks at 100; workspace reads page with a `limit`), so no code change is warranted.

### Still open

- **D-15 un-hydrated create/update responses** (2026-11-03). Still accepted: the client refetches and
  no consumer reads the mutation body. Revisit only if a caller starts to.
- **Search/sort performance.** `%LIKE%` over `contact_phones.number` / `contact_emails.address` with
  no trigram index, plus the `age`/dob correlated subquery for rows outside the joined path. A local
  seeded tenant cannot represent production cardinality, so this needs an `EXPLAIN` on real data
  before any DDL.
- **Field/tab blueprint has no editing surface anywhere in the app** (students persist preferences
  only; no settings surface writes any module's `*-field-config`). Cross-module gap, out of scope.
- **Schema/migration index drift** (`status_coalesce_updated_at` ASC vs DESC; `registered_on`
  non-partial vs the 0098 partial variant) — drizzle snapshot concern.

## 8. Adversarial audit

**Edge cases.** Export of exactly `N × limit` rows terminates without an extra empty page (final page
has `rows.length < limit`). `skipCount` exports with `includeIds` are untouched. Create with a forged
`createdAt` stores the column default; restore-on-create still preserves the archived row's real
`createdAt` (the upsert `set` omits the column). A `customFields` echo cannot bypass the allowlist —
the nested map is dropped before persistence. `age` with a null DOB groups as "Unknown" instead of
erroring; a future DOB clamps to 0. Import errors from any chunk are numbered against the original
file.

**Failure modes.** A rolled-back create/update/restore still evicts the cache (finally), so the next
read cannot serve the pre-commit row. `handleContractError` preserves intentional 403/400/409 domain
statuses while logging the cause. Restore's DB race now answers 409. A failed bulk delete/restore/
enroll returns `false` so the dialog stays open and the selection survives for retry.

**Security / multi-tenancy.** Every fixed query remains tenant-predicated (`workspace_subdomain` on
both sides of subqueries); the restore probe is now *more* constrained, not less. `createdAt` can no
longer be forged; attribution stays session-stamped. `customFields` is accepted and discarded, so it
cannot mass-assign into `custom_fields`. The gate now demands the action the handler actually needs
(delete / setupWrite) — a stricter declared requirement, with handlers still re-checking.

**Concurrency.** Restore now distinguishes the *pre-validated* conflict (400) from a concurrent
writer winning the unique index (409). Bulk restore reports the database's restored count rather than
its optimistic pre-count. GR year resolution is timezone-independent by construction (asserted with a
`Date` spy); sequence allocation keeps its `SELECT … FOR UPDATE` serialization.

## 9. Verification evidence (post-fix)

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, backend, frontend) | **Pass** |
| `pnpm --filter mms-backend test student` | **28 files / 221 tests passed** |
| `pnpm --filter mms-frontend test features/students` | **63 files / 202 tests passed** |
| `@mms/shared` full suite | **238 files / 1,793 tests passed** |
| `moduleAccessCoverage.test.ts` | 1 passed (now with expected-action assertions) |
| `check:code-norms` / `check:i18n` / `check:work-directory` / `check:db-projections` / `check:backend-boundaries` / `check:frontend-structure` / `check:shared-ui` | **Pass** |
| `node scripts/verify-rules-integrity.mjs` | **Pass** |
| `test:db` (real PostgreSQL 16.14) | **55 files / 219 passed, 1 skipped** — includes `studentsNewFilterDb`, `studentSoftDeleteCascadeDb`, `crossTenantIsolation` (8) |
| `test:rls` (`mms_app`, `NOSUPERUSER NOBYPASSRLS`, `MMS_DB_ROLE_ENFORCEMENT=strict`) | **5 tests passed**; the boot log confirms "runtime role is subject to row-level security" |
| Playwright e2e / axe | **Not run** — requires the dev servers |

> **Correction.** An earlier draft of this table said the DB suites were "not run — no local
> Postgres". A Docker `mms-postgres` (and `mms-redis`) was in fact running; the suites had simply not
> been executed. They have since been run against a disposable scratch database — see §10.

Red was observed directly before each fix for **C1** (2 failures), **M1**, **M2** (3 failures),
**M3** (2 failures), **m1** (route action `write` vs `delete`), **m3** (row 1 vs 201) and **m8**
(boolean contract). **M4**, **m4**, **m5**, **m6**, **m7**, **m9**, **m11** and **m13** are guarded by
the specs listed in §6; their Red state was not separately re-captured (each spec asserts the
corrected behaviour on the production path). **m12** is performance-only.

`bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh` (secrets, rules/skills integrity, i18n
completeness + unused keys, shared purity/structure, migration index/hygiene/forward-only, work
directory, frontend structure, shared UI, docs, script units, ratchet baselines, DB projections,
backend boundaries, code norms, typecheck, ESLint) — **all passed**.

`check:tdd-pairing` still reports the advisory for changed backend files that have no spec of their
own name — the repository interfaces/adapters (`studentsRepository.ts`,
`studentsRepositoryAdapter.ts`), the shared cache-invalidation helper, and use cases whose behaviour
is asserted from the composition-root spec (`studentUseCases.test.ts`). The two misnamed specs were
renamed in the follow-up (§10); the residual is structural, not missing coverage.

## 10. Follow-up (same day): real-DB verification and deferred closures

### 10.1 Evidence gap closed

Ran against a disposable scratch database `mms_review_20261104` on the local Docker cluster:

1. `createdb` + `pnpm --filter mms-backend run db:migrate` as `postgres` →
   **`test:db`: 55 files / 219 passed, 1 skipped (220)**. No students-related failure: the new export
   page-fullness rule, restore `.finally()` invalidation, the `age` widget SQL and the bounded contact
   probe all behave correctly against real SQL.
2. `ADMIN_DATABASE_URL=… MMS_DB_PASSWORD=… pnpm --filter mms-backend exec tsx src/scripts/provisionRlsRole.ts`
   (the same recipe as CI's `test-backend-rls`) → `mms_app` owns the database with
   `NOSUPERUSER NOBYPASSRLS`; migrated **as `mms_app`** with `MMS_DB_ROLE_ENFORCEMENT=strict`, then:
   **`test:rls`: 5 tests passed**. The runtime log line `[rls] runtime role is subject to row-level
   security` confirms the suite ran under a role where `FORCE RLS` is actually enforced — not a
   green-under-superuser false positive.

The scratch database and role are local-only; no repository artifact was added.

### 10.2 Deferred items closed

| Item | Change | Guard |
| --- | --- | --- |
| Import broadcast storm | `CreateStudentOptions.deferBroadcast`; the CSV importer defers the per-row live push and broadcasts once per chunk | `studentWriteUseCases.test.ts` (suppression), `studentsImportJob.test.ts` (201 rows → 2 broadcasts, not 201) |
| GR backfill atomicity | `migrateStudentsMissingGrNumbers` fetches `CHUNK + 1` candidates, writes the chunk in **one** `repo.bulkSave`, and reports exact `hasMore` | `studentUseCases.test.ts` (one `bulkSave`, no per-row `save`; 101 candidates → 100 updated, `hasMore: true`) |
| Dead props | Removed `sessions` from the list components / `StudentsListContent` (and the now-unused `useSessionsCollection()` call) and the unused `studentStatusOptions` from `StudentsBulkActionBar`; the filters menu keeps its copy | frontend typecheck + `features/students` suite (63/202) |
| TDD spec naming | `studentsWidgetFieldSql.test.ts` → `studentRepositoryWidgetsSql.test.ts`; `studentWriteCacheInvalidation.test.ts` → `studentWriteUseCases.test.ts` | `check:tdd-pairing` advisory shrinks by one file; residual documented above |

Per-row **transaction** isolation in the importer is deliberately kept: a bad row must not abort the
batch, and the import reports failures by position.

### 10.3 Still out of scope

Playwright/axe (needs the dev servers and seeded browser state; the changed frontend behaviour is
unit-covered) and production-volume `EXPLAIN` benchmarking (a local seeded tenant cannot represent
production cardinality).
