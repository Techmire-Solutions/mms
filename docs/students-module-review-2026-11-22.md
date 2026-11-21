# MMS Students Module Review — 2026-11-22

Fifth dedicated review of the Students domain, at `main` HEAD `2d3820dad` (students paths clean at review
time; the 23 dirty files in the tree are a concurrent **contacts** workstream and are out of scope). It
re-verifies every finding left open by the [2026-11-05 whole-module review](students-whole-module-review-2026-11-05.md),
the [2026-11-04 UI/UX pass](students-ui-ux-review-2026-11-04.md) and the student rows of the
[2026-11-16 forms audit](forms-audit-2026-11-16.md), then audits the surfaces that changed since:
**#347** (contracts, security scoping, export safety), **#428** (Setup required fields) and **#429** (GR
label), under the form/table standards that landed in between (#379/#386, #415/#291/#295).

**Scope.** `packages/shared/src/students/**` + `contracts/students.contract*.ts` + students auth entries;
`apps/backend/src/routes/tenant/students/**`, `students/**` (incl. `repository/studentScopingRepository`,
`studentsBulkStatusService`, `studentsImportService`), `db/repositories/student*.ts`,
`services/studentValidationService.ts`, `integrations/edtech/**`, worker/queue wiring;
`apps/frontend/src/tenant/features/students/**`, `tenant/hooks/collections/students.ts`,
`features/reports/hooks/studentReportExport.ts`, `lib/config/routeAccess.ts`.

**Method.** Read-only trace along the path production runs — route → module gate/permission → handler → use
case → repository/SQL/DDL → shared DTO. Findings cite `file:line` at `2d3820dad` and quote the offending
code. “Untested” is a test gap (§7), never a defect; non-provable concerns are hypotheses (§10). No code was
changed by this review.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (turbo) | Pass — 6/6 tasks |
| Cold `tsc --noEmit` (frontend, backend) | **Pass** (both exit 0, no incremental cache) |
| Backend students suites (`pnpm --filter mms-backend test student`) | **39 files / 319 tests passed** |
| Frontend students suite | **71 files / 238 tests passed** |
| `pnpm run check:forms` | **Clean** — 0 hard violations, 0 inventory drift; 52 advisory `synchronousGuardMissing` entries, none student-specific |
| `check:contracts` / `check:backend-boundaries` / `check:code-norms` / `check:work-directory` / `check:i18n` | Pass (code-norms scanned 7,803 files; Work Directory 4,259) |
| DB-integration specs | **Not executed** (no live DB) — read-only verified |
| E2E/axe | Not run (no stack) |

## 2. Verdict

**The module is materially hardened since 11-05 — the contracts are tighter, the viewer sanitizer is now
applied on every read/write response, export/import have anti-forgery and CNIC matching, and the new
required-field Setup is enforced server-side with a cache-correctness fix — but the newly introduced
section-scoping control is incomplete and fails open, and four write-path defects from 11-05 remain.**

Concretely: `resolveStudentAccessScope` is wired only into list/get/resolve, so a section-scoped teacher
(role `teacher` has `students: read, update`) can export the full roster, bulk-change any student’s status,
bulk-enroll out-of-section students, and probe duplicates outside their sections; and both the resolver and
the membership check return **allow** on error. Separately, the new import checkpoint is keyed per job but
indexed per chunk, so retries of files larger than one 200-row batch re-import up to two chunks and report
persisted rows as failures. The carried defects (bulk-delete audit/count fiction, bulk-status pre-read
audit/withdrawals, unguarded report-export page-walk) are unchanged.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| A1 | **Major** | Authorization | Section scope is enforced only on list/get/resolve: export, import, bulk status, bulk enroll, duplicate-check, count, metrics and widget aggregates are tenant-wide |
| A2 | **Critical** | Authorization (fail-open) | `resolveStudentAccessScope` returns `{isUnrestricted:true}` on **any** lookup error, and `isStudentInAssignedSections` returns `true` — authorization fails open instead of closed |
| A3 | Minor | Authorization | Scope is keyed on three exact role strings; tenant custom roles bypass it entirely. Scope membership ignores enrollment `status`/dates, so withdrawn/past students stay visible |
| B1 | **Major** | Import | Checkpoint key is job-scoped but stores a **chunk-local** index; files >200 rows re-import up to two chunks on retry and report already-persisted rows as failures |
| B2 | **Major** | Soft delete | Bulk delete still counts/cascades/audits the pre-read set and discards the `UPDATE … RETURNING` result (carried C2) |
| B3 | **Major** | Bulk status | Transitions, audit rows and enrollment withdrawals are still derived from the pre-read snapshot while the SQL returns only a count (carried C3) |
| B4 | **Major** | Reports export | `fetchAllStudentsForQuery` still spreads an unchecked `response.body` and claims a 100,000-row cap that is actually 20,000 (carried C1) |
| B5 | Minor | Dead code / latent authz | `students:bulk-status` runner is registered but nothing enqueues it, and it fabricates `{role:"admin", permissions:["students.write"]}` from the job payload |
| B6 | Minor | API | A malformed `x-expected-updated-at` header becomes a 409 “stale write” instead of 400 |
| B7 | Minor | API | `POST /api/students/duplicate-check` is an unscoped existence oracle for out-of-section students |
| C1 | Minor | Performance | Every students write invalidates the students cache twice (`invalidateStudentsQueries` → contacts invalidator → students again) |
| C2 | Minor | Performance | `tenantRegistry` is rebuilt in an IIFE on every render (`useStudentColumnLayout`), defeating memoised column layout |
| C3 | Minor | Dead code | 12 unreferenced exports (2 new), the entire `integrations/edtech` surface is unwired, and 16 test-only shadow helpers remain |
| C4 | Minor | Data integrity | Contact-archive guard still checks only the student link columns that `normalizeStoredStudent` strips on every write; relationship-graph guardians remain unprotected (carried R8) |
| D1 | Minor | Consistency | Backend sort allowlist duplicates the shared list and includes `studentId`, which the shared list/UI allowlist lacks |

## 4. Findings detail

### A1 — Major — section scoping stops at the read/write boundary
**Evidence.** `resolveStudentAccessScope`/`isStudentInAssignedSections` appear in exactly three handlers:
`studentCrudRoutes.ts:57` (list), `:117` (get) and `studentAggregateRoutes.ts:42` (resolve). The other
families gate on capability only:
- export — `studentExportRoutes.ts:20` `canRead: (user) => canReadCollection(user, "students")`;
- import — `:34` `canWrite: …`, no scope;
- bulk status/enroll — `studentOperationRoutes.ts:27,69` `canWriteCollection(...)`, no scope;
- duplicate-check — `:176` `canReadCollection(...)`, no scope;
- count/metrics/widgets — `studentAggregateRoutes.ts:19-33`, no scope.

`resolveStudentAccessScope` derives the teacher scope from `sectionStaffAssignments` and the list SQL adds
`EXISTS (… enrollments … e.section_id IN (…))` (`studentRepositoryListQuery.ts:226-242`), which is the right
shape — it is simply not applied to the adjacent endpoints.
**Impact.** `teacher` holds `students: ["read","update"]` (`packages/shared/src/auth/userRbacDefaultRoles.ts:96-98`),
so a section-scoped teacher can export the full roster and change the status of any student in the tenant —
the control the scope was introduced for is bypassed by the next endpoint over. Count/metrics also disclose
tenant-wide totals to a scoped teacher.
**Fix sketch.** Resolve the scope once per request in a shared pre-handler/helper and pass
`scopedSectionIds` into export, bulk status/enroll, count/metrics/widgets and duplicate-check (export:
intersect the requested filter with the scope, or reject `students.export` for scoped roles until the export
service accepts a section predicate). Pinning tests: scoped teacher → export excludes out-of-section rows;
bulk status on an out-of-section id returns `failed: 1`/no audit; metrics equal the scoped list total.

### A2 — Critical — authorization fails open on error
**Evidence.** `studentScopingRepository.ts:90-93`:
```ts
} catch {
  // Fallback safely if tenant DB context is uninitialized (e.g. fastify mock integration tests)
  return { isUnrestricted: true, assignedSectionIds: [] };
}
```
and `:123-125`: `} catch { return true; }`.
**Impact.** Any failure of the faculty/assignment lookup — tenant-context misconfiguration, RLS denial, a
transient DB error, a timeout — converts a section-scoped teacher into a tenant-wide reader, and any
membership-query failure into “this student is in my section”. The mock-test motivation is not a reason to
weaken production authorization; tests should stub the repository port instead.
**Fix sketch.** Fail closed (`{isUnrestricted:false, assignedSectionIds:[]}` and `false`) and log the error;
if the pre-tenant mock path must keep working, inject the scope repository in the test instead. Pinning
tests: forced read error → list returns empty/500, never the roster; membership error → 403/404, never 200.
This is the only finding I would block a release on for the new scoping feature.

### A3 — Minor — role-string keying and stale enrollment membership
**Evidence.** `studentScopingRepository.ts:30-36` scopes only `teacher`, `assistant_teacher`, `staff`;
every other role — including tenant custom roles and any renamed variant — hits
`return { isUnrestricted: true }` at `:47-52`. Scope membership (`:99-121`) and the list SQL filter only
`e.deleted_at IS NULL`; `enrollments.status` (`db/schema/enrollments.ts:61`) and end dates are ignored.
**Impact.** A tenant-created “class teacher” role gets the full directory; a student who withdrew last term
stays visible to the teacher forever.
**Fix sketch.** Derive scope from the faculty profile/assignment for **any** role that has a faculty link,
and fall back to role allowlist only as a last resort; add `status IN ('active','pending')` (or an
end-date predicate) to both membership check and list SQL. Hypothesis-level until confirmed against tenant
role data (§10).

### B1 — Major — import checkpoint is chunk-local on a job-scoped key
**Evidence.** The import job carries the whole file (`registerModuleCsvImportJobRunner.ts:4-9` `rows:
TRow[]`), while the pipeline persists it in batches of 200 (`studentsImportService.ts:15`
`maxBatch: 200`; `importPipelineRunner.ts:112-120` calls `persist` once per chunk with the **same**
`ctx.jobId`). The checkpoint stores the **local** loop index:
```ts
const checkpointKey = ctx.jobId ? `mms:${ctx.tenant}:import-checkpoint:${ctx.jobId}` : null;
…
const saved = await redisGet(checkpointKey);
startOffset = Math.min(Number(saved), rows.length);
…
for (let index = startOffset; index < rows.length; index += 1) { … }
…
if (checkpointKey && (index + 1) % 20 === 0) await redisSet(checkpointKey, String(index + 1), 86400);
```
(`studentImportUseCases.ts:106-122,159-161`), and each persist call deletes the key at the end (`:177-183`).
**Impact.** File of 500 rows, crash in the third batch at local index 180: checkpoint “180” is left behind.
On retry, batch 1 reads it and skips its first 180 rows (already persisted — harmless), re-imports its last
20 (already persisted → contact/GR collisions, or duplicate name-only students), then deletes the key;
batch 2 then re-processes all 200 rows, 180 of which were already persisted. Net: up to 200 duplicate
attempts, false row failures, `imported` under-counted by the skipped rows, and job progress/failed totals
wrong (`failed = total - imported` in `importPipelineRunner.ts`). The spec that “pins” this only uses a
4-row single chunk (`studentsBackgroundWorkersSync.test.ts:80-116`), so it cannot catch the bug.
**Fix sketch.** Make the checkpoint **absolute**: pass `ctx.offset` into the key or store
`ctx.offset + index`; read/update/delete it only in the first and last chunk, or (simpler) drop the
checkpoint and rely on a dedupe key per row (student ID/GR/contact) — the latter also fixes the residual
duplicate window for rows without an identifier. Pinning test: 450 rows in 3 chunks, simulate crash after
chunk 2 at row 380, retry → every row persisted exactly once, `imported` equals the persisted count.

### B2 — Major — bulk soft-delete reports and audits rows it may not have written
**Evidence.** `studentSoftDeleteUseCases.ts:46-62` builds `toSave` and increments `succeeded` from the
pre-read; `:64-71` calls `repo.bulkSoftDelete(...)` and ignores its `{succeeded,failed}`; `:84-104` then
cascades enrollments and writes DELETE audit/outbox rows for **every** pre-read row.
**Impact.** Same as the 11-05 C2: a concurrent delete/restore yields audit rows and outbox events for rows
this request did not write, and counts can disagree with the database.
**Fix sketch.** Keep the 11-05 diff: have the repository return `RETURNING` ids, restrict
cascade/audit/outbox to those ids, and recompute `succeeded/failed` from the write.

### B3 — Major — bulk status audits/withdraws rows the UPDATE skipped
**Evidence.** `studentOperationUseCases.ts:131` pre-reads `affected`; `:135-137` calls
`bulkUpdateStatusSql` expecting a number; `:139-155` derives transitions from `affected`, withdraws
enrollments and writes `student.status_change` audit rows for them. The SQL filters `deleted_at IS NULL`
and returns only a count (`studentRepositoryListOps.ts`).
**Impact.** A student deleted between read and update still gets a status-change audit row and an enrollment
withdrawal; concurrent status changes are mis-audited.
**Fix sketch.** The 11-05 C3 diff: return `{succeeded, updatedIds}`, filter transitions by `updatedIds`.

### B4 — Major — report export page-walk crashes on error and mislabels its cap
**Evidence.** `useStudentsListQueries.ts:27-39`:
```ts
const response = await apiContract.students.list({ query: listQuery });
const studentsPage = response.body as StudentsListPageResult;
all.push(...(studentsPage.students as StudentRecord[]));
…
if (page >= 200) throw new Error("Student export exceeds the 100,000-record safety limit; …");
```
called by `features/reports/hooks/studentReportExport.ts:65` for CSV/Excel/PDF export.
**Impact.** A 403/500 makes `students` undefined → `TypeError` instead of the server message; the cap is
`200 × maxPageSize(100)` = 20,000, and the message is English-only. (Also still a client-side full-roster
walk with a `COUNT(*)` per page — the R4 performance item.)
**Fix sketch.** The 11-05 C1 diff (`assertContractOk`, `?? []`, constant-derived message); longer term,
route report export through the queued server export.

### B5 — Minor — unreachable bulk-status worker with fabricated authority
**Evidence.** `studentsBulkStatusService.ts:7-33` registers `students:bulk-status` and builds
```ts
const user = { id: ctx.userId, role: "admin", permissions: ["students.write"] } as unknown as User;
```
then calls `bulkUpdateStudentStatus`. Nothing enqueues the job: no producer for `"students:bulk-status"`
exists outside the runner and its timeout test (`studentsBackgroundWorkersSync.test.ts:59`).
**Impact.** Dead code today (also gives the queue a 10-minute `STUDENTS_IMPORT_TIMEOUT_MS` budget for an
unused kind); if a generic enqueue path is ever pointed at it, the permission check is fabricated rather
than derived from the enqueuing principal.
**Fix sketch.** Delete the runner + its timeout entry, or rebuild it as a real async path that receives and
re-checks the actor (`ctx.userId` → authoritative permissions) and is enqueued by the bulk-status route.

### B6 — Minor — malformed OCC token becomes a conflict, not a validation error
**Evidence.** `studentCrudRoutes.ts:219` passes the raw header; `saveStudentIfVersionMatches`
(`studentRepositoryPersist.ts`) does `new Date(expectedUpdatedAt)` and returns `false` on `NaN`, which
`studentWriteUseCases.ts:198-210` maps to `ConflictError(STUDENT_VERSION_CONFLICT)` → 409.
**Impact.** A client bug (bad header format) is reported as a concurrent edit, pushing users to reload and
retry instead of fixing the request.
**Fix sketch.** Validate the header in the route (ISO-8601) → 400 `validation_error`, and keep 409 for a
well-formed but stale token.

### B7 — Minor — duplicate-check is an unscoped existence oracle
**Evidence.** `studentOperationRoutes.ts:169-200` gates on `canReadCollection("students")` only; the
contract returns `{reason}` (`students.contract.routes.ts:212-225`) and the probe accepts name/dob/email/
GR/contact (`studentsDuplicateCheckBodySchema`).
**Impact.** A section-scoped teacher can confirm whether an out-of-section student exists (and by which
key), without ever reading the row.
**Fix sketch.** Apply the same section predicate to the duplicate probe, or return `null` when the matched
student is outside scope (same response shape, no oracle).

### C1 — Minor — double students invalidation per write
**Evidence.** `invalidateStudentsQueries.ts:30-33` calls `invalidateContactsQueries`, whose implementation
(`features/contacts/hooks/invalidateContactsQueries.ts:38-42`) invalidates `STUDENTS_QUERY_KEY` and
`STUDENTS_METRICS_QUERY_KEY` again.
**Impact.** Two invalidations of the same keys per mutation; with `cancelRefetch` the second cancels and
restarts the refetch.
**Fix sketch.** Add `{ includeStudents?: boolean }` to the contacts invalidator and pass `false` from the
students path.

### C2 — Minor — column registry rebuilt every render
**Evidence.** `useStudentColumnLayout.ts:12-24` builds `tenantRegistry` in an IIFE; the array identity
changes every render, so downstream memos (column layout, customizer) never hit.
**Fix sketch.** `useMemo(() => buildStudentWorkColumnRegistry(settings, labels), [settings, t])`.

### C3 — Minor — dead-code drift
- 12 exports have zero references in this repository: `StudentDirectoryColumnKey`, `StudentWorkColumnKey`,
  `studentWorkColumnLabelsFrom`, `isStudentSortField`, `isStudentSeedFieldKey`, `StudentLookupStringKind`,
  `StudentGuardianRelationshipRole` (new), `StudentsNextGrNumberQuery`, `StudentDrawer`,
  `getStudentSettingsMemoryFallback`, `studentDetailQueryKey` (new), `StudentCardFieldDefinition`.
- 16 exports are test-only, including the shadow `studentRegistrationUtils` trio and
  `computeStudentsWidgetAggregate` (the 11-05 list still stands).
- **`apps/backend/src/integrations/edtech/**` is entirely unwired**: `verifyEdtechWebhookSignature`,
  `calculateExponentialBackoff`, `isTokenExpired` and the sync DTOs/types have no caller outside their
  integration tests. Either wire the webhook/sync or remove the surface. (If wired later: the verifier skips
  freshness entirely when `timestamp` is absent, so replay protection is conditional — document it.)

### C4 — Minor — contact-archive guard still misses relationship-graph guardians
**Evidence.** `findContactDeleteBlockers` (`db/repositories/studentDeleteGuard.ts:95-115`) checks
`s.contact_id, s.father_contact_id, s.mother_contact_id, s.guardian_contact_id`; `normalizeStoredStudent`
strips those guardian columns on every write (`shared/src/students/studentUtils.ts:37-47`), so for current
data those four checks reduce to the primary `contact_id`. Relationship-graph guardians live in
`contact_relationships.related_contact_id` and are not checked.
**Fix sketch.** Add the `contact_relationships` branch from the 11-05 R8 snippet before relying on column
deprecation.

### D1 — Minor — sort allowlists drift
**Evidence.** Backend `studentRepositoryListQuery.ts:20-29` defines its own set
(`name, grNumber, status, gender, registeredDate, dob, studentId, updatedAt`); shared
`studentDirectoryColumns.ts:249-257` omits `studentId`, and the frontend allowlist is built from the shared
list (`studentsListVisibleColumns.ts:10`). The backend file imports the same-named set from its local
module, not `@mms/shared`.
**Fix sketch.** Add `studentId` to the shared list and import `STUDENT_SORT_FIELD_SET`.

## 5. Prior-finding reconciliation

| Prior ID | Status at `2d3820dad` | Evidence |
| --- | --- | --- |
| 11-05 C1 export guard | **Open** (§B4) | `useStudentsListQueries.ts:27-39` unchanged |
| 11-05 C2 soft-delete audit/count | **Open** (§B2) | `studentSoftDeleteUseCases.ts:46-104` |
| 11-05 C3 bulk status pre-read | **Open** (§B3) | `studentOperationUseCases.ts:131-155` |
| 11-05 C4 import idempotency | **Partially addressed** — job-level Redis checkpoint added (#347), but the multi-chunk defect remains (§B1) | `studentImportUseCases.ts:106-183` |
| 11-05 R1 cross-module `students.read` | Open, now **scoped** on resolve | `studentAggregateRoutes.ts:42-56` |
| 11-05 R2 double invalidation | **Open** (§C1) | contacts invalidator `:38-42` |
| 11-05 R3 memo identity | **Open** (§C2) | `useStudentColumnLayout.ts:12-24` |
| 11-05 R4 client report export | **Open** (§B4 note) | `studentReportExport.ts:65` |
| 11-05 R5 resolve index mismatch | Not re-verified this round (query changed location) — hypothesis §10 | — |
| 11-05 R6 per-row audit loops | **Open** (visible in B2/B3 loops) | `studentSoftDeleteUseCases.ts:84-104` |
| 11-05 R7 sort SSOT | **Open** (§D1) | both sets still exist |
| 11-05 R8 guardian guard gap | **Open** (§C4) | `studentDeleteGuard.ts:95-115` |
| 11-05 R9 date-only TZ shift | Not re-verified this round — hypothesis §10 | — |
| 11-05 R10 GR rollover collision | Not re-verified this round — hypothesis §10 | — |
| 11-05 R11 create-id TOCTOU | Not re-verified this round — hypothesis §10 | — |
| 11-04 M1–M5 / UI/UX fixes | **Hold** — #428/#429 kept the required-field and GR-label work; `gender` sentinel/`notes`/pagination/template-dirty fixes still present | frontend suite 238 pass |
| 11-16 forms audit (student rows) | **Closed** — lifecycle ratchet green; avatar-confirm, banner and in-flight binding present | `check:forms` clean |

## 6. Verified clean

- **Form lifecycle/ratchet**: `check:forms` 0 hard violations; `StudentForm` is registered as an audited
  modal-form surface with no inventory drift (`docs/forms-inventory.md:113`).
- **Required fields (#428)**: Setup writes `fields[].required` through the field-config PUT; the server
  schema builder reads `field.required` (`shared/src/students/studentValidation.ts:157-163`), and the new
  `blueprintDigest` keys the cache on every schema input (`services/studentValidationService.ts:81-118`) —
  the stale-cache bug is genuinely fixed, including the locked/always-required keys.
- **Viewer sanitizer**: list, get, create, update and restore all pass through
  `sanitizeStudentsForUser`/`sanitizeOneStudentForUser` (`studentCrudRoutes.ts:86,143,177,232`;
  `studentSoftDeleteRoutes.ts:50`), using the shared viewer sanitizer with a seeded-defaults fallback.
- **Export safety**: export audit is written by the queue path only (`registerExportAudit: false`), xlsx
  injection tests exist, and the CSV util hardening is in place.
- **Contract minimality**: duplicate-check returns only a reason; list/get/create/update have explicit
  400/403/404/409 branches (`studentCrudRoutes.ts:41-180`).
- **Import hardening (#347)**: CNIC joins the contact-match keys; checkpoint cleanup on success; broadcast
  once per chunk.
- **Scoping on list/get/resolve**: SQL `EXISTS` predicate (`studentRepositoryListQuery.ts:226-242`) and
  membership check are structurally correct (modulo A2/A3).
- **Build/tests**: cold tsc both apps, 319 backend + 238 frontend student tests, i18n complete.

## 7. Test gaps

1. No scoped-role coverage for export, bulk status/enroll, duplicate-check, count/metrics/widgets (A1).
2. No test that forces the scope lookup to throw (A2).
3. Import checkpoint spec covers one 4-row chunk only; no >200-row multi-chunk retry (B1).
4. No multi-row concurrency test for bulk delete/status (B2/B3) — the existing ones use happy-path fakes.
5. No malformed `x-expected-updated-at` case (B6).
6. Edtech verifier is tested, but no route/service consumes it (C3); no replay-with-missing-timestamp case.
7. DB-integration specs for scoping and OCC were not executed (§1).

## 8. Adversarial audit (4 vectors)

- **Edge cases**: last import chunk shorter than checkpoint (B1); scope with zero section assignments
  returns an empty roster (intended) but count/metrics still return totals (A1); withdrawn enrollments keep
  visibility (A3).
- **Failure modes**: scope resolver catch → unrestricted (A2); Redis down at checkpoint read → start at 0
  (safe but duplicate-prone); report export 403 → `TypeError` (B4); malformed OCC → 409 (B6).
- **Security/multi-tenancy**: tenant predicates are present on all scoping SQL (`workspace_subdomain`);
  the gaps are horizontal (section) rather than vertical (tenant). Edtech verifier is unused but, if wired,
  skips freshness when the timestamp header is absent.
- **Concurrency**: delete/status audit fiction (B2/B3) is the residual snapshot-write class; import retry
  duplicates (B1); create-id TOCTOU (11-05 R11) not re-verified.

## 9. Resolution plan

| Priority | Item | Change | Pinning test |
| --- | --- | --- | --- |
| **P0** | A2 | Fail closed in `resolveStudentAccessScope` and `isStudentInAssignedSections`; log the failure; stub the repo in mock tests | forced lookup error → empty/500, membership error → 403 |
| **P0** | A1 | Apply the resolved section scope to export, bulk status/enroll, duplicate-check, count, metrics, widget aggregates | scoped teacher exclusion tests per endpoint |
| **P1** | B1 | Absolute-offset checkpoint (or row-level dedupe key); correct `imported/failed` accounting | 450-row/3-chunk crash-retry spec |
| **P1** | B2/B3 | `RETURNING` ids for bulk delete/status; cascade/audit/withdraw only written rows | repo returns empty ids → no audit/withdrawal |
| **P2** | B4 | `assertContractOk` + `?? []` + derived cap message; then server-side report export | 403 body → server message, not TypeError |
| **P3** | A3/B5/B6/B7/C1-C4/D1 | Role-derived scope + enrollment status filter; delete/rebuild the bulk-status runner; 400 for malformed OCC; scoped duplicate probe; invalidation memo; dead-code cleanup; guardian guard; sort SSOT | per-row specs in the table above |

## 10. Hypotheses (not proven)

- **Custom-role scope bypass** (A3): depends on whether tenants actually create custom roles with
  `students.read`; role data was not inspected.
- **R5 resolve index mismatch**: the identifier-resolution query shape changed since 11-05; a plan-level
  check against the functional indexes is still owed.
- **R9 date-only TZ shift** and **R10 GR rollover collision**: not re-read this round; no new evidence.
- **R11 create-id TOCTOU**: unchanged probe/upsert shape suspected, not re-verified.
- **Section scope for `staff`**: the role is scoped, but default `staff` permissions do not include
  `students.read`, so the path may be dead today.

## 11. Status table

| Item | Status |
| --- | --- |
| A1 section-scope coverage | Open — Major |
| A2 fail-open scope | Open — Critical |
| A3 role keying / stale membership | Open — Minor |
| B1 import checkpoint | Open — Major |
| B2 soft-delete audit fiction | Open — Major |
| B3 bulk-status audit fiction | Open — Major |
| B4 report-export guard | Open — Major |
| B5 bulk-status runner | Open — Minor (dead/latent) |
| B6 malformed OCC header | Open — Minor |
| B7 duplicate-check oracle | Open — Minor |
| C1–C4, D1 | Open — Minor |
| Prior UI/UX + form-contract findings | Closed / holding |
| Code changes made by this review | **None** (review only) |
