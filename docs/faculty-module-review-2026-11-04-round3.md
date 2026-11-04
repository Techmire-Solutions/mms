# MMS Faculty Module Review — 2026-11-04 (Round 3, backend)

Independent backend review of the Faculty module at `main` HEAD `a51ae8bd5` (tree clean at review
start). Round 2 (`docs/faculty-module-review-2026-11-04-round2.md`) closed the role-escalation, session-
guard and module-action findings; this round re-verifies those and audits surfaces no earlier round
reached, then closes the new P1/P2 defects in the same change.

Scope (backend only): `apps/backend/src/routes/tenant/faculty/**`, `apps/backend/src/faculty/**`,
`apps/backend/src/db/repositories/faculty*`, `apps/backend/src/db/schema/faculty*.ts`,
`packages/shared/src/{faculty,schemas,contracts}/faculty*`, the faculty manifest / module-action table /
registrars it depends on (`lib/registerModuleCsvImportRoutes.ts`, `lib/registerModuleCsvExportRoutes.ts`,
`lib/registerModuleLookupRoutes.ts`, `lib/moduleRouteActions.ts`), plus the faculty frontend plumbing that
the export-audit contract change reaches.

Method: `read`/`grep`/`glob`, `vitest run faculty`, `vitest run <spec>` per finding (red → green),
`tsc --noEmit`, and the structural ratchets. Every "broken" claim was reproduced on the path production
runs (route → guard → use case → repository/SQL); unproven concerns are marked **hypothesis**, missing
coverage **untested**.

## 1. Baseline evidence

| Gate | At review start | After this change |
|---|---|---|
| Faculty backend suite | 38 files / 248 tests pass | **44 files / 279 tests pass** |
| `pnpm --filter mms-backend typecheck` | pass | pass for every touched file |
| `check:faculty-domain` | pass | pass |
| `check:code-norms` / `check:backend-boundaries` / `check:backend-structure` | pass (baselines held) | pass |
| Faculty frontend suite | 66 files / 214 tests pass | 66 files / 214 tests pass |
| `pnpm --filter mms-frontend typecheck` | pass | pass |

Static + unit-level run: no database, no RLS suite, no E2E (`test:db` not executed here — the new
DB-level assertions land in the CI `test:db` shard). Unproven items are labelled accordingly.

## 2. Verdict

**Was not ready to close as-is; the two data-integrity lies and the missing import audit trail are now
closed in this change.** Three P1s survived round 2:

1. **Faculty CSV imports wrote no audit row at all.** Member import was hand-rolled instead of the shared
   registrar every other module uses, and the code comment claiming a queue-level `faculty.import` row
   was false — `faculty.import` existed only inside that comment.
2. **Archiving the primary appointment silently destroyed the faculty's primary SSOT** (Work projection,
   exports, task delegation, contact role tags) with no guard and no 409.
3. **`reassignSubordinatesTo` still returned 200 while doing nothing** (round-2 M1): the only
   "successful" delete path with subordinates archived the supervisor and orphaned them.

Secondary: the client-forgeable `/export-audit` endpoint (C-09) was still registered for faculty, and the
employee-ID backfill wrote row-by-row outside any transaction with no audit row.

## 3. Round-2 status re-verification

| # | Round-2 finding | Status at `a51ae8bd5` | Evidence |
|---|---|---|---|
| C1 | Faculty save rewrites the linked user's RBAC role without an actor check | **Closed** | `facultyLinkedUserRoleSync.ts:52-63` actor gate (`admin`/`users.manage`); covered by `facultyRoleUnionAssert.test.ts` |
| C2 | Soft-delete session guards compare a user id to a faculty id | **Closed** | `middleware/authenticate.ts:163-174` → `facultyRepository.isDeletedByUserId`; role-name gate dropped |
| C3 | Faculty delete/restore routes resolve a `write` module action | **Closed** | `lib/moduleRouteActions.ts:44-83`; pinned in `moduleAccessCoverage.test.ts:335-351` for all three prefixes |
| M1 | `reassignSubordinatesTo` accepted, returns 200, does nothing | **Open → closed here (F4)** | `facultySoftDeleteGuards.ts` refuses with a typed 409; no-op call removed |
| M2 | CSV import bypasses the implicit-restore delete gate | **Closed** | `facultyImportJobUseCases.ts:71-78` resolves `canRestore` from the actor's grants |
| M3 | "Workspace-local day" is the server day | **Closed** | `facultyWriteHelpers.ts:43` + `lib/workspaceDay.ts` |
| M4 | Workload pill / class-count column have no producer | **Deferred** (product) | `docs/open-items.md` Faculty Tier 2 |
| M5 | Reporting-hierarchy write path stripped; assignment hierarchy stubs | **Deferred** (product model) | `facultyAssignmentHierarchyRepository.ts:6-23`; `docs/open-items.md` |
| M6 | Client-supplied `userId` persisted as the linked account | **Closed** | `schemas/faculty.dto.ts:244-254` strips `userId` |
| m1 | Catalog catches swallow without logging; infra errors become 400 | **Open → closed here (F8)** | `facultyCatalogErrorResponse.ts` |
| m2 | `handleDeleteAssignment` maps typed 404/409 to 500 | **Open → closed here (F6)** | `facultyAssignmentRouteHandlers.ts:230-245` |
| m10 | Missing tenant returns 500/undefined scope instead of 403 | **Open → closed here (F11)** | guards in `facultyCrudRoutes.ts`, `facultyBulkRouteHandlers.ts`, `facultyRouteHelpers.ts` |
| m12 | Bulk specialization records no `updated_by` while bulk status does | **Open** (P3, see §5) | `facultyRepositoryListOps.ts:111-133` |

## 4. Findings detail (new this round)

### F1 — P1 — Faculty CSV imports produced no audit trail

**Evidence.** `routes/tenant/faculty/facultyImportRoutes.ts` (pre-fix) hand-rolled the same enqueue logic
that `lib/registerModuleCsvImportRoutes.ts:89-105` provides — and that helper is the one that appends the
queue-level `<entity>.import` audit row used by students, users, tasks, attendance, finance, messaging and
the rest. Department/designation imports (`facultyCatalogIoRoutes.ts`, pre-fix `:77-147`) had the identical
hole. Batch writes deliberately skip per-row audit (`faculty/use-cases/facultyWriteUseCases.ts:148,171`),
and their comment claims "CSV import records one queue-level `faculty.import` aggregate row instead" —
`grep -rn "faculty.import" apps/backend/src packages/shared/src` returned **only those two comments**.

**Production path / consequence.** `POST /api/faculty/import` → job → `runFacultyMembersImportJob` →
`createFaculty/updateFacultyById({ batch })`. Bulk creation/update of people records left zero audit rows:
no queue row, no per-row row. Same for catalog imports. This breaks `mms-data-layer.md` §5.4 (authoritative
audit row per mutation) for the one path that writes the most records.

**Fix.** Both routes now use `registerModuleCsvImportRoutes` with `queueAuditAction` `faculty.import`,
`faculty.departments.import`, `faculty.designations.import`. Payload shape is byte-identical
(`rows/label/viewerRole/language`), so the jobs are unchanged; `canWrite` keeps the previous gates
(`canWriteCollection("faculty")` for members, `canSetupWrite` for the catalog).

**Test.** `__tests__/facultyImportRoutes.test.ts` — asserts one `faculty.import` row with actor + row count,
no second row on idempotent replay, no row on a queue failure, and the 403 gate preserved; catalog variants
assert their own action names.

### F2 — P2 — `/api/faculty/export-audit` was client-forgeable and double-counted

**Evidence.** `facultyExportRoutes.ts` registered the shared export routes without `registerExportAudit:
false`, so the legacy client-reportable endpoint stayed live next to the authoritative queue row
(`registerModuleCsvExportRoutes.ts:63-105` writes `faculty.export.queue`, `:109-135` accepted a
client-supplied `count`/`scope` as `faculty.export`). The contract also declared it
(`faculty.contract.ts:199-208`) and the frontend called it (`useFacultyMutations.ts:24,37-39`). Students and
contacts had already applied the C-09 fix; faculty had not.

**Consequence.** Any reader could forge export volume in the audit trail, and every export produced two
rows, one of them unverifiable.

**Fix.** `registerExportAudit: false`; `exportAudit` removed from the contract; the now-dead frontend
plumbing removed (`useFacultyTsrMutations`, `useFacultyMutations`, `useFacultyPageController`,
`useFacultyWorkTierState`, `useFacultyExportActions`) exactly as students/contacts did. The queue-time
`faculty.export.queue` row remains authoritative.

**Test.** `__tests__/facultyExportRoutes.test.ts` — `/export-audit` is 404 and writes nothing;
`/export/csv` still writes `faculty.export.queue`. `facultyContractRouteParity.test.ts` pins that the
contract no longer declares it. Faculty frontend suite stays green (214 tests).

### F3 — P1 — Archiving the primary appointment silently destroyed the primary SSOT

**Evidence.** `db/repositories/facultyAssignmentWriteRepository.ts` `softDeleteFacultyAssignment` (pre-fix
`:83-118`) set `deleted_at` on any row without calling `validateFacultyAssignment` and without a primary
guard — while saves and closes do validate (`facultyAssignmentValidation.ts:45-54`). The primary row is
what `findPrimaryFacultyAssignment` (`facultyAssignmentRepository.ts:86-110`) and the Work projection
(`facultyPrimaryAppointmentSql.ts`) resolve.

**Consequence.** `DELETE /api/faculty/:facultyId/assignments/:id` on the primary row returned 200 and every
downstream surface lost the member's designation/department: Work list/sort/filter, CSV export, task
delegation, contact role tags. No error, no audit of the consequence.

**Fix.** New `assertFacultyAssignmentDeletable(row, onDate)` in `facultyAssignmentValidation.ts:20-38`
blocks archiving the period that currently backs the primary appointment (a 409 telling the caller to close
it with an end date); historical/future secondary or ended periods stay archivable. Wired into
`softDeleteFacultyAssignment` under the same advisory lock, using the workspace-local day.

**Test.** `facultyAssignmentValidation.test.ts` ("Faculty assignment delete guard", 5 cases) and a DB case
in `db-integration/facultyAppointmentsDb.integration.test.ts` proving the refused delete leaves the row
live and an ended period still archives.

### F4 — P1 — `reassignSubordinatesTo` reported success and did nothing

**Evidence.** `facultySoftDeleteGuards.ts:26-42` verified the target, called `repo.reassignSubordinates(…)`
and continued without checking the result; `facultyRepositorySubordinateCounts.ts:71-84` is
`const execute = async (_tx) => 0` ("Organization positions removed — reassignment is a no-op"). No frontend
call site exists (`grep -rn "reassignSubordinatesTo" apps/frontend/src` is empty).

**Consequence.** The only delete path that succeeded for a supervisor with subordinates was the silent one:
the supervisor was archived, subordinates kept pointing at a deleted chain, and the response was 200 with an
audit row claiming a delete.

**Fix.** `guardSubordinatesOnDelete` now throws a typed `SubordinateReassignmentUnavailableError` (409,
"automatic reassignment is unavailable — reassign them manually") instead of calling the no-op. The org
model itself stays deferred (M1/M5). Specs that pinned the old behaviour were rewritten
(`facultySoftDeleteGuards.test.ts`, `facultyHierarchy.integration.test.ts`, `facultySafetyAndRbac.test.ts`).

### F5 — P2 — Employee-ID backfill was non-atomic and unaudited

**Evidence.** `facultyOperationUseCases.ts` `migrateFacultyMissingEmployeeIds` (pre-fix): one `repo.save`
per row outside any transaction, no advisory lock, no audit row; reachable via
`POST /api/faculty/migrate-employee-ids` (Setup write).

**Consequence.** A mid-loop failure left a half-migrated workspace, two concurrent admins could mint the same
sequence, and a Setup write over many records produced no audit trail.

**Fix.** The batch now runs inside one tenant transaction under `lockFacultyHierarchy`, and appends one
`faculty.employee_id_backfill` row with the count and the acting user (passed explicitly from the route).

**Test.** `__tests__/facultyOperationUseCases.test.ts` — one transaction, one audit row with the actor, no
audit/broadcast on failure, no-op path untouched.

### F8 — P2 — Catalog catches turned infrastructure failures into 400s

**Evidence.** `facultyDesignationRouteHandlers.ts` restore/save/delete and
`facultyDepartmentRouteHandlers.ts` restore/save (pre-fix `:70-75,104-109,151-158` / `:67-72,94-99`) mapped
**any** non-conflict throw to `400 validation_error` with no log. A deadlock, statement timeout or pool
exhaustion reached the client as "your input is invalid" and nothing reached the logs.

**Fix.** New `facultyCatalogErrorResponse.ts` keeps typed domain failures (`400`/`404`/`409`, including
`isCatalogConflict`) and routes everything else to a **logged 500**. To keep genuine domain rejections as
400s, the catalog validators now throw `ValidationError` instead of bare `Error`
(`facultyDepartmentValidation.ts`, `facultyDesignationValidation.ts`, `facultyHierarchySql.ts`).

**Test.** `__tests__/facultyCatalogErrorMapping.test.ts` (6 cases: infra → 500 + logged, typed → 400,
conflict → 409, both catalogs) plus the rewritten `facultyDepartments.test.ts` case.

### F10 — P2 — 15 of 41 contract endpoints were silently unregistered; one had no route at all

**Evidence.** `@ts-rest/fastify` registers only the endpoints present in the implementation object
(`recursivelyRegisterRouter`), so the 15 contract endpoints served by generic registrars (`restore`,
`bulkDelete`, `bulkRestore`, `resolve`, `linkedContactIds`, `widgetAggregates`, the 8 Setup endpoints) are
"fine by luck", and the `as unknown as RouterImplementation` cast in `facultyCrudRoutes.ts` hides any drift
from the type checker. The new parity test found a real one: **`GET /api/faculty/lookups/:kind` was declared
by the contract but served by nobody** — `registerModuleLookupRoutes` only registered `GET /lookups` and
`PUT /lookups/:kind` (the same declaration exists in the contacts and students contracts, and their typed
clients would 404 too).

**Fix.** `registerModuleLookupRoutes` now serves `GET /lookups/:kind` (read-gated, 404 on an unknown kind),
which fixes faculty/contacts/students at once; new `__tests__/facultyContractRouteParity.test.ts` boots the
real app and requires **every** faculty contract endpoint to resolve to a registered route.

## 5. Minor findings

| # | Finding | Status |
|---|---|---|
| m12 | Bulk specialization updates `updated_at` but never `updated_by` (bulk status does) — `facultyRepositoryListOps.ts:111-133` | Open (P3) |
| m13 | Bulk status/specialization emit only an out-of-transaction summary audit row and no per-record row (project-wide pattern; students identical) — `facultyBulkRouteHandlers.ts` + `createCollectionAuditHelper` | Open (P3, project-wide) |
| m14 | Employee-ID rollover uses the **server** year and coerces `yearFormat: "NONE"` to `YYYY` (`facultyEmployeeIdGenerator.ts:18,106-115`; `facultyEmployeeIdPreview.ts:45-54`) while appointments use the workspace day | Open (P3) |
| m15 | `revokeFacultySessions` still only logs on failure and runs inside the archive transaction — no outbox retry/metric — `facultySoftDeleteSessions.ts:38-58` | Open (P3) |
| m16 | Assignment hierarchy endpoints answer `200 {tree: []}` / `{chain: []}` from hard-coded stubs (`facultyAssignmentHierarchyRepository.ts:6-23`) — deferred with the org model | Deferred (M5) |
| F6 | `handleDeleteAssignment` mapped typed 404/409 to 500 | **Fixed** (`facultyAssignmentRouteHandlers.ts:230-245`, logged 500 only for infra) |
| F7 | An inserted assignment was audited as `UPDATE` | **Fixed** (pre-read → `CREATE`/`UPDATE`; DB assertion added) |
| F11 | `String(request.tenant?.id)` reached `withTenant` unguarded → a transaction scoped to the literal workspace `"undefined"` | **Fixed** (403 guards in `facultyCrudRoutes.ts`, `facultyBulkRouteHandlers.ts`, `facultyRouteHelpers.ts`) |

## 6. Test gaps remaining

1. No faculty E2E spec (unchanged from round 2); a11y/responsive/ops-flow still untested in the browser.
2. No cross-transaction concurrency test for the primary-appointment advisory lock under two overlapping
   `saveFacultyAssignment` calls beyond the existing serialized-save case.
3. Catalog import jobs (departments/designations) have no per-row failure-shape test (only the member job).
4. `docs/open-items.md` M4 (workload producer) and M5 (reporting-hierarchy model) remain product decisions
   with no test.

## 7. Verified-clean surfaces

- **Module gating.** All three prefixes (`/api/faculty`, `/api/tenant/faculty`, `/api/v1/tenant/faculty`)
  are stamped by `registerModuleAccess`; delete/restore/bulk resolve the `delete` action on every prefix and
  are pinned in `moduleAccessCoverage.test.ts`.
- **Tenant isolation.** Every faculty SQL path filters `workspace_subdomain` explicitly in addition to RLS;
  `withTenant` fails closed on an empty tenant (`tenantScopeGuard.ts`), and the new guards make a missing
  request tenant a 403 instead of an `"undefined"` scope.
- **Optimistic concurrency.** `PUT /api/faculty/:id` honours `x-expected-updated-at` →
  `saveIfVersionMatches` → 409 (`facultyWriteUseCases.ts:211-224`).
- **Appointment integrity.** Advisory-locked overlap validation, typed 400/409, assignment hijack blocked by
  the `facultyId` mismatch check, and now a primary-appointment delete guard.
- **Server-owned fields.** `userId`, `reportingFacultyId`, `department*`, `designation*` stripped
  (`schemas/faculty.dto.ts:244-254`); viewer sanitisation on list/get/resolve.
- **Audit.** create/update/soft-delete/bulk-delete/restore-cascade append in-transaction; assignments audit
  in-transaction with `CREATE`/`UPDATE` discrimination; imports and the backfill now audit at queue/batch
  level.
- **Soft delete.** Cascade to assignments/employments/employ-designations, outbox tombstones, subordinate
  guard, session revocation, restore uniqueness (23505 → 409).

## 8. Adversarial audit

**Edge cases.** Deleting an already-archived assignment stays an idempotent no-op; an ended primary period
remains archivable; a future-dated primary is archivable; a secondary appointment of any period is
archivable; import replay with the same idempotency key writes exactly one queue audit row; catalog imports
of an unknown department still fail per row without aborting the batch.

**Failure modes.** Queue unavailable → 202 never sent and no audit row (both import paths). Backfill failure
→ whole batch rolls back, no audit row, no broadcast. Catalog DB failure → logged 500 (previously an
unlogged 400). Missing tenant → 403 (previously `"undefined"` scope).

**Security / multi-tenancy.** F2 removed an audit-forgery surface. F1 closed the audit blind spot on the
highest-volume write path. F3/F4 removed "success with no effect" paths that silently degraded data. No
change weakened a gate: the import refactor keeps `canWriteCollection`/`canSetupWrite`, the lookup-kind
route is read-gated, and the parity test adds no permissions.

**Concurrency.** Backfill is serialized by the faculty advisory lock; appointment delete now takes the same
lock before reading the row `FOR UPDATE`; import audit is written after enqueue, so a lost race on the
idempotency key returns the existing job without a second row.

## 9. Change set

Source: `routes/tenant/faculty/{facultyImportRoutes,facultyCatalogIoRoutes,facultyExportRoutes,
facultyAssignmentRouteHandlers,facultyDesignationRouteHandlers,facultyDepartmentRouteHandlers,
facultyCrudRoutes,facultyBulkRouteHandlers,facultyRouteHelpers}.ts`, new `facultyCatalogErrorResponse.ts`,
`faculty/use-cases/{facultyOperationUseCases,facultySoftDeleteGuards,facultySoftDeleteUseCases,
facultyUseCases}.ts`, `db/repositories/{facultyAssignmentValidation,facultyAssignmentWriteRepository,
facultyDepartmentValidation,facultyDesignationValidation,facultyHierarchySql}.ts`,
`lib/registerModuleLookupRoutes.ts`, `packages/shared/src/contracts/faculty.contract.ts`,
`apps/frontend/src/tenant/features/faculty/hooks/{useFacultyTsrMutations,useFacultyMutations,
useFacultyPageController,useFacultyWorkTierState,useFacultyExportActions}.ts`.

Tests added: `facultyImportRoutes.test.ts`, `facultyExportRoutes.test.ts`, `facultyOperationUseCases.test.ts`,
`facultyCatalogErrorMapping.test.ts`, `facultyContractRouteParity.test.ts`, `facultyTenantGuards.test.ts`;
DB assertions in `db-integration/facultyAppointmentsDb.integration.test.ts`. Rewritten to the new intent:
`facultySoftDeleteGuards.test.ts`, `facultyHierarchy.integration.test.ts`, `facultySafetyAndRbac.test.ts`,
`facultyDepartments.test.ts`, `facultyAssignmentSoftDelete`-adjacent `facultyAssignmentSoftStop.test.ts`
fixture, `facultyAssignmentRoutes.test.ts`.

Gates: `pnpm --filter mms-backend typecheck` · `pnpm --filter mms-backend exec vitest run faculty`
(44/279) · `pnpm --filter mms-frontend typecheck` · `pnpm --filter mms-frontend exec vitest run
src/tenant/features/faculty` (66/214) · `node scripts/check-faculty-domain.mjs` · `check:code-norms` ·
`check:backend-boundaries` · `check:backend-structure` · `check:docs`.
