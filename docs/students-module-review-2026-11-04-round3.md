# MMS Students Module Re-Review — 2026-11-04 (Round 3)

Independent, read-only review of the students domain at `main` HEAD `60245210a` (working tree clean at
review time), **re-verifying** the 2026-11-03 / #269 and 2026-11-04 / #275 rounds and auditing the
surfaces those rounds did not cover. Line numbers are from the tree as reviewed.

Scope: `apps/backend/src/routes/tenant/students/**`, `apps/backend/src/students/**`,
`apps/backend/src/db/repositories/student*`, `apps/backend/src/db/schema/students.ts` +
`studentSetupTables.ts`, `apps/backend/src/services/student{Validation,Export}Service.ts`,
`packages/shared/src/students/**`, `packages/shared/src/schemas/students.dto.ts`,
`packages/shared/src/contracts/students*.ts`, `apps/frontend/src/tenant/features/students/**`, the
students manifest, route registration, the module-access route table, and the students DB/e2e specs.
Contacts, enrollments, examinations, finance, hasanat and the document-template route were inspected
only where students calls them.

Method: static audit through the production path (registered route → module gate → handler
permission → use case → repository/mapper → SQL), `git show --stat 7079f0b37`, and
`git log --oneline 7079f0b37..HEAD -- <students paths>`. **No students-path changes since #275**:
the only two commits since (`44871c86c` faculty, `60245210a` messaging) touch
`moduleRouteActions.ts` additively and never a students file, so #275 is the live students state.
The prior-round documents (`docs/students-module-review-2026-11-03.md`,
`docs/students-module-review-2026-11-04.md`) were read first; fixed items are not re-reported.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, backend, frontend) | green at the #275 baseline — carried, not re-run (read-only pass) |
| `check:code-norms` | 0 `any`, semantic tokens only, no students file >300 LOC |
| `check:work-directory` | 0 offenders |
| `check:db-projections` | 0 `SELECT *` |
| `check:frontend-structure` / `check:shared-ui` | 0 offenders |
| `check:backend-boundaries` | 0 offenders |
| faculty-domain ratchet | 0 offenders (students declares no retired legacy surface) |
| `moduleAccessCoverage.test.ts` | 1/1 passing (`EXPECTED_MODULE_ROUTE_ACTIONS` pinning delete/setupWrite) |
| `routeAccess.test.ts` | 11/11 passing |
| This pass | **static only** — no DB suite, no Playwright/axe, no formatter, no test run |

Ratchets are green because the students paths are byte-identical to #275; the findings below are
therefore not ratchet-visible regressions but execution-completeness gaps on paths the checks do not
model.

## 2. Verdict

**No new Critical. 4 Major, 9 Minor.** The #275 fixes hold on the production path for export
paging, `createdAt` stripping, the delete/setupWrite route actions, contract-error logging, the
selection scope key, the `age` widget SQL, settings-loaded-once, the `customFields` round-trip, the
restore→409 race, and the filter-independent KPI. Three #275 claims are only **partially** true:
bulk-restore timestamps/audit (m7), import row numbering (m3), and post-commit cache invalidation
(M2 — the code is correct, but the students cache has no production reader *or* writer, and the
import path still evicts pre-commit).

The uncovered risk is concentrated where unit tests mock the boundary: **import idempotency under
BullMQ retry** (M1), **cross-module authorization of `bulk-enroll`** (M2), **fail-open blueprint
validation when the settings read fails** (M3), and **restore audit/outbox rows for rows the
database did not restore** (M4). Merge-time contact/student uniqueness and `_blueprintId`
persistence complete the minor set.

## 3. #275 fix verification

| #275 item | Holds? | Evidence |
| --- | --- | --- |
| C1 export pagination completeness | **Yes** | `studentRepositoryListPage.ts:98-99` `hasMore = isCursorPaging \|\| query.skipCount ? rows.length === limit : page * limit < total`; the pager is driven with `skipCount: true` (`studentsExportService.ts:63-76`) through `createModuleExportService.ts:60-69` → `generateCsvStreamChunks` (`csvExportStreamFactory.ts:63-95`) and `loadAllExportRows` (`createModuleExportService.ts:96-112`, 250/page). Both walks now stop only on a short page. |
| Server-owned `createdAt` stripping on create | **Yes** | `students.dto.ts:50` still accepts it, but `studentNormalizeUseCases.ts:112-116` applies `stripStudentServerOwnedAuditFields` (`studentSoftDelete.ts:16-33`) before persist; that function is the only path into `repo.save` (`studentWriteUseCases.ts:139,257`; `studentRestoreUseCases.ts:73`). The update set omits the column (`studentRepositoryPersist.ts:128-138`), attribution is re-stamped from the session (`studentWriteUseCases.ts:150-154`). |
| Post-commit cache invalidation | **Structurally yes, effect nil** | `.finally(invalidateStudentsCache)` on all five write paths (`studentWriteUseCases.ts:221,296`; `studentRestoreUseCases.ts:104,263`; helper `studentCacheInvalidation.ts:9-15`). But `getOrSetMultiTier`/`getCached` have **no production caller** (only `__tests__/multiTierCache.test.ts`), so no students key is ever populated — and the import path still evicts pre-commit (Minor 3). |
| Selection scope key | **Yes** | `useStudentsDirectoryFilters.ts:46-53`; `filterKey` (`:33`) carries search/status/gender/quickFilter/trash/sort, so any view change clears `selectedIds` during render. |
| `age` widget SQL | **Yes** | `studentRepositoryWidgetsSql.ts:68-79` `GREATEST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, <dob>))::int, 0)::text`; `age` is in the contact-join set (`:9,15-24`); `sum/avg` take the numeric branch via the digit regex (`studentRepositoryWidgetsAggregate.ts:63-66,104-107`). |
| delete / setupWrite route actions | **Yes** | `moduleRouteActions.ts:26-43`; pinned by `moduleAccessCoverage.test.ts:324-328` with a stale-rule check (`:390-393`). Handlers re-check (`studentCrudRoutes.ts:223`, `studentOperationRoutes.ts:185`). |
| Contract-error logging | **Yes** | `contractError.ts:32-35` logs `{ err, url }`, `:49-60` maps FK→409, `:64-72` preserves domain statuses. Wired at `studentCrudRoutes.ts:107,208,255` and `studentOperationRoutes.ts:58,95,200`; `create` logs directly (`studentCrudRoutes.ts:158`). One un-logged 500 remains off-contract (Minor 3). |
| Import row offsets | **Partial** | `importPipelineRunner.ts:101-105` passes the chunk offset and `studentImportUseCases.ts:107` adds it — but `transformed` is the **filtered** `valid` array (`:83,96`), so a validation-rejected row shifts every later report (Minor 1). |
| Settings loaded once | **Yes** | `studentWriteValidation.ts:97` loads, `:120` passes them; `studentValidationService.ts:91` reuses the preload (`preloadedSettings ?? load…`). |
| `customFields` round-trip | **Yes** | `students.dto.ts:64-68` accepts the nested map; `studentNormalizeUseCases.ts:108-111` deletes it before persist while `extractStudentCustomFields` keeps the flattened keys (`studentRepositoryPersist.ts:46-58`); the strict allowlist still gates those keys (`students.dto.ts:83-96`). |
| Restore 409 race | **Yes** | `studentNormalizeUseCases.ts:143-156` (`statusCode 409`, `type conflict`) → `crudSingleDeleteRestoreRoutes.ts:133-136` → `sendIfHttpDomainError` (`httpErrors.ts:28-50`). Pre-validated conflicts stay 400 (`studentSoftDeleteRoutes.ts:19-31`). Field classification is string-sniffed (Minor 7). |
| Bulk restore counts | **Partial** | The DB count drives the result (`studentRestoreUseCases.ts:219-239`), but `bulkRestoreStudentsSql` stamps its own `now` (`studentRepositorySoftDelete.ts:65-72`), so `batchRestoredAt` never reaches the rows and audit rows are written for all `toSave` regardless of `written` (`:217-250`) — see M4. |
| Filter-independent KPIs | **Yes** | `useStudentsPageController.ts:70-74` `enabled: true`; `useStudentsPageWorkQuery.ts:63-74` feeds `shownCount` from the server `total` on every tier. |

## 4. Findings detail

### M1 — Major — Import job is not idempotent under BullMQ retry

**Evidence**

- `apps/backend/src/worker/queues/queueConfig.ts:90-97` — `DEFAULT_JOB_OPTIONS: { attempts: 3, backoff: { type: "exponential", delay: 1000 } … }`.
- `packages/shared/src/dataTransfer/import/importPipelineRunner.ts:94-109` re-runs the whole `transformed` array on every attempt; nothing is keyed or checkpointed.
- `apps/backend/src/students/use-cases/studentImportUseCases.ts:47-56` — contact reuse happens **only** by phone/email:
  ```ts
  if (phone || email) {
    const matches = await findContactsMatchingUniqueValues({ phoneDigits: …, emails: … });
  ```
- `studentImportUseCases.ts:48-49` — otherwise `const contact: Contact = { id: randomUUID(), … }`.
- `studentNormalizeUseCases.ts:46-54` — `resolveStudentRowId` returns `` `st-${randomUUID()}` `` when the client sends no id, and `generateNextGrNumber` (`studentWriteUseCases.ts:187-203`) mints a fresh GR, so no unique index stops the second insert.

**Production path** `POST /api/students/import` → `registerModuleCsvImportRoutes` (`studentExportRoutes.ts:33-40`) → worker `students:import` → `studentsImportService.ts:12-17` → `importStudentRows` (`studentImportUseCases.ts:96-141`). Writes are per-row transactions by design (`:126-134`), so a mid-run throw (progress update, `broadcastCollection`, worker eviction) leaves committed rows behind a retryable job.

**Consequence** Rows carrying a phone/email come back as `23505` contact conflicts (`throwGrUniqueConflict`, `studentNormalizeUseCases.ts:20-31`) and are reported as failures — the operator is told rows failed that in fact succeeded. Rows without phone/email produce **duplicate contacts and duplicate student records** (new ids, new GRs), inflating counts/reports and creating duplicate guardians, permanently.

**Proposed fix** Thread an import idempotency key into the runner (`students:import:<file+row digest>`) and resolve each row by `studentId | grNumber | contact phone/email` before create; report already-imported rows as `unchanged` rather than `failed`; never mint a fresh contact when a name+DOB match exists. Pin with a re-delivery test asserting `imported` is unchanged and no row count grows.

### M2 — Major — `bulk-enroll` bypasses the enrollment module's own gate

**Evidence**

- `studentOperationRoutes.ts:72-77` — the only guard is `if (!canWriteCollection(user, "students")) return { status: 403 … }`.
- `students.ts:19-20` — the plugin registers `registerModuleAccess(fastify, "students")` only, so `/api/students/bulk-enroll` resolves to the **students** module + `write`.
- `studentOperationUseCases.ts:230-236` → `enrollmentBulkEnroll.ts:31-47` (`remove`: `repo.cancelStudentEnrollmentsInSession(…)`) and `:49-76` (`add`: `repo.bulkSaveEnrollments(…)`) contain no `enrollments.*` check and no module check.
- The enrollments module is separately gated and permissioned: `routes/tenant/enrollments.ts:30` `registerModuleAccess(fastify, "enrollment")`; `enrollmentContractRouter.ts:113` `if (!canWriteCollection(user, ENROLLMENTS_COLLECTION))`; `enrollmentsModuleManifest.ts:166-167` declares `write/delete: "enrollments.write"`.
- The frontend mirrors the wrong capability: `StudentsBulkActionBar.tsx:93` `{canWrite && onBulkEnroll && (…)}`, where `canWrite` is `students.write`.

**Production path** `POST /api/students/bulk-enroll` (`studentOperationsContract.bulkEnroll`) → module gate (students/write) → handler `canWriteCollection(students)` → `bulkEnrollStudentsIntoClass` → enrollment create/cancel.

**Consequence** A custom role holding `students.write` without `enrollments.write` — or any workspace where the enrollment module is disabled while students is enabled — can create and cancel enrollments, release seats and drive the withdrawal/settlement pipeline through the students surface. `mode: "remove"` is a destructive enrollment operation performed without `enrollments.write`/`delete`.

**Proposed fix** Gate the handler on the target module: `canWriteCollection(user, "enrollments")` plus an enrollment module-access check before dispatch, keeping `students.write` for the student side; gate the frontend button on `enrollments.write` too. Add a 403 test for a students-write-only role.

### M3 — Major — Blueprint validation fails open when the settings read fails

**Evidence**

- `studentWriteValidation.ts:97` — `const settings = await loadStudentsSettingsCombined().catch(() => null);` (the error is swallowed, not logged).
- `studentWriteValidation.ts:98` — `buildStudentWriteSchema(collectStudentWriteExtraFieldKeys(settings))`, i.e. the strict allowlist is compiled **without** the tenant's custom keys when `settings` is null.
- `studentWriteValidation.ts:117-126` — `if (settings) { … collectStudentDynamicIssues(tenant, data, lang, settings) … }`; when null the entire dynamic layer is skipped.
- `studentWriteValidation.ts:106` — the version lock compares `_blueprintId` against `settings?.version ?? 0`, so the stale-form lock is skipped when the client omits the token.

**Production path** `POST/PUT /api/students` → `studentCrudRoutes.ts:131,184` `validateStudentWrite(request, body)` → the above. #275 closed the *tenant-less* fail-open (`:111-116`); the *read-failure* fail-open is the same shape and is still open.

**Consequence** A transient settings/DB failure turns a validation boundary off: required tabs/fields, field types and the blueprint-version lock are not enforced, and a row that violates the workspace configuration is persisted. In the same state, a legitimate write carrying custom fields is rejected with `Unknown field "<key>"` (a confusing 400) — both failure modes are wrong, in opposite directions.

**Proposed fix** Distinguish "no configuration" from "configuration read failed": log and propagate the read error as 503 (retryable), or rethrow as a `StudentWriteValidationError`; never make the dynamic layer conditional on a write path. Pin with a spec that rejects on the settings read and asserts the write is refused.

### M4 — Major — Bulk restore audits rows it did not restore; three `restoredAt` values

**Evidence**

- `studentRestoreUseCases.ts:216-239`:
  ```ts
  let written = toSave.length;
  … if (writeResult && typeof writeResult.succeeded === "number") { written = writeResult.succeeded; }
  succeeded = Math.min(succeeded, written);
  ```
- `studentRestoreUseCases.ts:248-250` — written independently of `written`:
  ```ts
  for (const s of toSave) { await recordRestoreEvents(tenant, s, batchRestoredAt, userId); }
  ```
- `studentRepositorySoftDelete.ts:62-72` — the restoring UPDATE stamps its own clock (`const now = new Date(); … restoredAt: now`), discarding the caller's `restoredRow.restoredAt = batchRestoredAt` (`studentRestoreUseCases.ts:205-209`).
- The enrollment cascade uses the caller's value (`studentRestoreUseCases.ts:241-247`), as do the audit rows and their outbox events (`:249`).

**Production path** `POST /api/students/bulk-restore` → `registerSoftDeletableBulkTrashRoutes` (`studentSoftDeleteRoutes.ts:55-62`) → `studentUseCases.bulkRestoreStudents` → `repo.bulkRestore` (`studentRepositorySoftDelete.ts:57-87`).

**Consequence** (a) When a concurrent restore/delete wins between the candidate read (`:127`) and the UPDATE, `written < succeeded`, yet the service still emits one `entity.restored` outbox row and one `RESTORE` audit row — and cascade-restores enrollments — for every candidate: the audit chain claims restores that never happened, and the reported `failed` count has no matching `conflicts[]` entry. (b) The documented m7 "one `batchRestoredAt` for rows + enrollment cascade" is not what the SQL does: the student row, its enrollments and its audit row carry three distinct instants, so a multi-second 500-row restore leaves inconsistent provenance across three tables.

**Proposed fix** Pass `batchRestoredAt` into `bulkRestoreStudentsSql` as an explicit parameter and drive the cascade/audit loop from the UPDATE's `returning({ id })`; emit audit/outbox only for returned ids and reconcile `failed` from the repository result plus the conflict list.

## 5. Minor findings

| # | Area | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | Import offsets (m3 residual) | Offsets are chunk positions in the **valid** array, not the file: one validation-rejected row shifts every later row error by one | `importPipelineRunner.ts:83,96,101-105`; `studentImportUseCases.ts:107` |
| 2 | Client-writable server field | `_blueprintId` is an accepted write key but is absent from `KNOWN_STUDENT_KEYS`, so `extractStudentCustomFields` persists it into the `custom_fields` JSONB on every create/update — a transient server token becomes client-controlled row content | `students.dto.ts:50`; `studentValidation.ts:16`; `studentRepositoryPersist.ts:11-58`; `studentNormalizeUseCases.ts:94-116` |
| 3 | 500 without logging | `/api/students/linked-contact-ids` (and the metrics/count siblings) swallow the cause: `catch { return sendDatabaseError(reply, …) }` with no `cause`, and `sendDatabaseError` logs only when given a cause | `crudQueryRoutes.ts:211-216`, `:63-64`; `httpErrors.ts:53-63`; mounted at `studentAggregateRoutes.ts:43-47` |
| 4 | Contacts↔students seam | Merging two contacts that each back an **active** student violates `students_workspace_contact_active_uidx`: the reparent re-points `contact_id` unconditionally and the merge use case has only `assertContactUniqueFields` | `students.ts:99-101`; `contactRepositoryDuplicateReparent.ts:84-90`; `contactBulkWriteUseCases.ts:80-122` |
| 5 | List/export contract | `skipCount` is a public list query flag, so `GET /api/students?skipCount=true` answers `total: 0` in a body whose contract promises a real total | `studentCrudRoutes.ts:42,55-63`; `studentRepositoryListPage.ts:49-68,103-110` |
| 6 | GR sequence atomicity | `migrate-gr-numbers` reserves the batch in its own transaction and writes rows in a second one, so a failed `bulkSave` burns that block of numbers | `studentOperationUseCases.ts:211-223`; `studentRepositorySequence.ts:40-48` |
| 7 | Fragile race classification | The concurrent-restore field is derived by sniffing the message instead of the constraint name, although `getPgConstraint` exists two functions above | `studentRestoreUseCases.ts:83-84` vs `studentNormalizeUseCases.ts:10-31` |
| 8 | Drill-down | The "New this period" tile fires `notify.message(t("students.drillDownApplied"))` and routes to Work, but `applyDrillDown` only maps `status`, so the view is unfiltered while the toast claims a filter | `studentReportMetrics.ts:87-92`; `useStudentsDirectoryFilters.ts:55-62` |
| 9 | Bulk-restore counts | When `written < succeeded`, `failed = uniqueIds.length - succeeded` counts rows with no `conflicts[]` entry, so the UI shows a failure count with no reason | `studentRestoreUseCases.ts:238-262` |

## 6. Test gaps

- **Import re-delivery** — `studentsImportJob.test.ts` pins offsets and one-broadcast-per-chunk but never re-runs the same payload; M1 is unpinned.
- **Cross-module authorization** — `moduleAccessCoverage.test.ts:324-329` pins the students action per route, never that a students-only role is refused by `bulk-enroll`; no 403 spec for `enrollments.write` on that path (M2).
- **Settings-read failure** — `studentWriteValidation.test.ts` covers the tenant-less fail-open only; no spec makes `loadStudentsSettingsCombined` reject (M3).
- **Bulk-restore provenance** — `studentUseCases.test.ts` asserts counts and one `bulkSave`, not that rows, cascade enrollments and audit share one `restoredAt`, nor that audit rows are limited to restored ids (M4).
- **Merge vs students uniqueness** — no spec merges two contacts that each back an active student.
- **a11y / E2E** — axe and Playwright for the students Work tier were not run (`untested`), as in the prior round.

## 7. Verified-clean surfaces

- Server-owned audit fields on create/update/restore-on-create; the update set omits `createdAt`/`createdBy` (`studentRepositoryPersist.ts:128-138`).
- Restore 409 race, pre-validated 400 conflicts, and the route-level mapping (`crudSingleDeleteRestoreRoutes.ts:121-139`).
- Contract handlers log and preserve domain statuses (`ZodError`→400, FK→409) (`contractError.ts:32-72`).
- Selection and page resets on any filter/search/sort/trash change (`useStudentsDirectoryFilters.ts:33-53`).
- `age` widget expression and its numeric aggregate path (`studentRepositoryWidgetsSql.ts:68-79`; `studentRepositoryWidgetsAggregate.ts:63-66`).
- Students CRUD/trash action matrix with a stale-rule guard (`moduleRouteActions.ts:26-43`; `moduleAccessCoverage.test.ts:390-393`).
- `customFields` echo accepted-and-dropped; flattened keys remain the write surface.
- Realtime: `enrollments` broadcasts invalidate students queries, and `students` invalidates contacts for the tag reconcile (`invalidateModuleQueries.ts:65-70`; `invalidateStudentsQueries.ts:24-30`).
- Contact merge reparents **all four** student contact columns (`contactRepositoryDuplicateReparent.ts:84-90`).
- Trash visibility requires `students.delete` on list and get (`studentCrudRoutes.ts:43-51,83-91`).
- Per-row import transactions are atomic per row: the contact and the student commit or roll back together (`studentImportUseCases.ts:126-134`).

## 8. Adversarial audit

**Edge cases.** An export of exactly `N × limit` rows ends without an extra empty page (final page is short) and `skipCount` walks terminate on page fullness; a soft-deleted student selected for export is dropped by `loadStudentsByIds` (`studentLoadEntityUseCases.ts:63-66`), matching `exportsIncludeDeleted: false`. A `customFields` echo cannot mass-assign (dropped before persist) and an unknown top-level key still 400s. A missing DOB groups `age` as "Unknown" and a future DOB clamps to 0. Import errors from any chunk carry the chunk offset — but drift by the number of validation failures that precede them (Minor 1).

**Failure modes.** A rolled-back create/update/restore still evicts the students cache, so no pre-commit row can be served. `handleContractError` logs the cause and still answers the intentional 403/400/409. The restore race answers 409 while a pre-validated conflict stays 400. A failed bulk delete/restore/enroll resolves `false` so the dialog stays open and the selection survives. A settings-read failure silently disables blueprint validation (M3) and an import retry silently duplicates rows (M1) — both are silent, which is why they are Majors.

**Security / multi-tenancy.** Every students query remains tenant-predicated on both sides of the subqueries, and `withTenant`/`runInTransaction` fail closed on an unbound tenant. `createdAt`/`createdBy` can no longer be forged and attribution is session-stamped. The declared gate now demands the action each handler needs (delete / setupWrite) with handlers still re-checking. The hole is cross-module: `bulk-enroll` writes enrollment state under `students.write` alone (M2), and `_blueprintId` remains a client-writable token that lands in stored JSONB (Minor 2). Contact archive is still blocked by `guardContactSoftDeleteDependents` when an active student links the contact.

**Concurrency.** Restore distinguishes the pre-validated conflict (400) from a concurrent unique-index winner (409), and bulk restore reports the database's count — but its audit/cascade fan-out is not limited to the rows the database actually restored (M4). GR allocation keeps `SELECT … FOR UPDATE` serialization and year resolution is timezone-independent by construction; the Setup backfill, however, reserves and writes in two transactions, so a failed write burns a block of numbers (Minor 6). The import pipeline has no execution-level idempotency key, so BullMQ's three attempts are three imports (M1).

## 9. Resolution plan

**Tier 1 — close before the next students change** (small, high-severity, no schema work):

1. **M2** enrollment gate: add `canWriteCollection(user, "enrollments")` + enrollment module-access to `bulkEnroll`, and gate the frontend bulk-enroll button on `enrollments.write`; add the 403 spec.
2. **M3** fail-closed settings: propagate/log the `loadStudentsSettingsCombined` failure instead of `.catch(() => null)`, and make the dynamic layer unconditional on a write path; add the rejection spec.

**Tier 2 — schedule with the module's next patch** (behavioural, needs new tests):

3. **M1** import idempotency: stable per-row key, resolve-before-create, `unchanged` accounting, re-delivery spec.
4. **M4** restore provenance: explicit `restoredAt` parameter, drive cascade/audit from `returning({ id })`, reconcile `failed` with `conflicts[]`.
5. Minors 1, 2, 3, 5, 6, 7, 9 as a batch (each is a few lines + one pinning assertion); Minor 4 needs a contacts-side pre-check; Minor 8 is frontend copy/behaviour.

**Hypotheses — measure, do not patch yet:** search/sort query plans on production cardinality (`EXPLAIN` first), merge-conflict message quality, and the real frequency of import re-delivery and restore races.

## 10. Hypotheses not proven

- **Merge 409 UX (Minor 4)** — that users see an opaque "unique identifier" conflict rather than a students-specific message; depends on the contacts delete-route mapper, not read here.
- **Import retry frequency (M1)** — that mid-run throws or worker evictions occur in production; the retry policy and the non-idempotent code are proven, the trigger rate is not.
- **Restore race frequency (M4)** — how often `written < succeeded` occurs in practice.
- **No students cache reader** — `getOrSetMultiTier`/`getCached`/`setCached` were grepped across `apps/backend/src` and found only in tests and the cache libs; a reader outside that tree is not excluded.
- **`skipCount` consumers (Minor 5)** — whether any client other than the export pager sends it; the answer is wrong regardless.
- **Search/sort performance** — `%LIKE%` over `contact_phones.number`/`contact_emails.address` and the `age`/dob correlated subquery need a production-volume `EXPLAIN`; a local seeded tenant cannot represent that cardinality.
- **a11y** — touch targets/ARIA on the bulk bar and desktop table were read only (`min-h-11` present at `StudentsBulkActionBar.tsx:97-105`), never axe-verified.

## 11. Implementation status (2026-11-04)

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| M2 | **Fixed** | `bulk-enroll` now requires `enrollments.write` and the enrollment module gate in addition to `students.write`; the bulk-enroll control is gated on the same permission | route guard + `StudentsBulkActionBar` |
| M3 | **Fixed** | A settings-read failure is rethrown (500/503) instead of disabling the dynamic blueprint; the write is refused rather than persisted unvalidated | `studentWriteValidation.test.ts` |

Still open (Tier 2): M1 import idempotency, M4 bulk-restore provenance, and the minors in §5.
