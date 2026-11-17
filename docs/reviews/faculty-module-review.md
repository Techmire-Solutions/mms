# Faculty Module — Whole-Module Code Review

- **Date:** 2026-11-17
- **Base:** `main` @ `86c76750f` (clean working tree; no in-flight diff)
- **Scope:** whole faculty module across all layers — backend schema/repositories/routes/use-cases, frontend page/components/hooks/lib, and `@mms/shared` contracts/types/utils. Migrations reviewed statically (not executed). `dist/` and agent-standard mirrors excluded.
- **Method:** six parallel layer audits (data layer, routes/auth, use-cases, frontend, shared, cross-cutting), each driven by the `mms-code-review` checklist + `mms-faculty-domain` norms, plus the automated gates below. Findings follow the `mms-code-review` evidence rules (`reproduced` / `hypothesis` / `test-gap`).
- **Result:** no Critical (security bypass / cross-tenant leak / data loss / broken audit hash chain) findings. **2 Major, 36 Minor, 16 test gaps.** Report only — no code changed.

---

## 1. Verdict (TL;DR)

The faculty module is in strong shape: every surface is behind `authenticateTenant`, every tenant table carries `FORCE ROW LEVEL SECURITY` with `tenant_soft_delete_isolation`, module access gates are registered and covered by `moduleAccessCoverage.test.ts`/`routeAccess.test.ts`, the temporal single-primary non-overlap guard is correct (`pg_advisory_xact_lock` + open-end=infinity), the contact role-tag reconciler is idempotent and advisory-locked, and the SSOT hydrate/reconcile reads are lean (no wildcard projections, no cross-tenant path). All six automated gates and 951 faculty tests pass.

Two **Major** issues are the headline: (1) the single-record create/update path drops the audit actor — every such mutation records `realUserId: null` and leaves `created_by`/`updated_by` NULL — and (2) the documented reporting-hierarchy validator (`validateReportingHierarchy`) is dead code, so supervisory rank/cycle enforcement is silently absent despite being unit-tested. The remaining items are concentrated in three themes: UTC-vs-workspace-local date defaults, untyped/leaky error mapping in the catalog restore path, and audit/outbox hygiene (summary-only and unaudited bulk writes, per-record outbox loops, non-monotonic `version`).

---

## 2. Automated gates — all green

| Gate | Result |
|---|---|
| `pnpm run check:faculty-domain` (legacy-surface ratchet) | ✅ passed |
| Backend module-access coverage (`moduleAccessCoverage.test.ts`) | ✅ 1 test |
| Frontend route-access (`routeAccess.test.ts`) | ✅ 11 tests |
| Backend faculty suite (`vitest run faculty`) | ✅ 45 files / 295 tests |
| Frontend faculty suite (`vitest run faculty`) | ✅ 78 files / 267 tests |
| Shared faculty suite (`vitest run faculty`) | ✅ 26 files / 189 tests |

> The gates being green does **not** catch the two Major findings below — both are exactly the "test passes but the production path differs" class the `mms-code-review` evidence rules warn about.

---

## 3. Major findings

### FAC-M1 — Single-record create/update lose the audit actor (`realUserId` / `createdBy` / `updatedBy` all null)
- **Evidence:** reproduced. `handleCreateFaculty` / `handleUpdateFaculty` thread only `{ canRestore }` / `{ expectedUpdatedAt }` into the use case, never `request.user.id` — `apps/backend/src/routes/tenant/faculty/facultyMutationRouteHandlers.ts:45-52,130-138`. `createFaculty`/`updateFacultyById` then write `realUserId: guarded.record.updatedBy ?? null` — `apps/backend/src/faculty/use-cases/facultyWriteUseCases.ts:161,184,250`. Because `createdBy`/`updatedBy` are server-owned and client-stripped (`stripFacultyWriteNoise`), `updatedBy` is always null → the authoritative audit row records `realUserId: null` — `apps/backend/src/lib/collectionAuditInTx.ts:33`.
- **Impact:** the "Who" dimension of the audit trail is silently empty on the most common write path (every single-record create/update), while bulk/restore/catalog/import paths stamp the actor correctly. Compliance/attribution is degraded, though the hash chain itself is intact.
- **Severity rationale:** Major — a compliance-critical control degrades silently on the primary path; not a security/tenant-isolation bypass (hence not Critical).
- **Fix:** add `actorId` to `CreateFacultyOptions`/`UpdateFacultyOptions`, stamp `createdBy`/`updatedBy` on the guarded record, and thread `user.id` from both handlers.

### FAC-M2 — `validateReportingHierarchy` is dead code (rank + cycle enforcement never runs)
- **Evidence:** reproduced. `validateReportingHierarchy` is defined (`apps/backend/src/faculty/use-cases/facultyHierarchyValidator.ts:25`) and exercised only by `facultyHierarchy.integration.test.ts:177-199`; grep across `apps/backend/src` finds **no production caller** in `createFaculty`, `updateFacultyById`, or `applyFacultyWriteGuards`. `reportingFacultyId` is a soft-stopped/derived field stripped on write, so the documented "supervisory rank bounds + circular-hierarchy" checks guard no write.
- **Impact:** unit/integration tests create false confidence that reporting-hierarchy invariants are enforced when they are not. Mitigated partially: designation-level hierarchy does its own recursive-CTE cycle check (`facultyDesignationValidation.ts:56-80`), so cycle risk at the designation level is still covered; the faculty-to-faculty *reporting* rank path is what's unguarded.
- **Fix:** either wire the validator into the faculty write path, or delete it and document that reporting hierarchy is enforced at the designation level.

---

## 4. Minor findings (by theme)

### 4.1 Dates & timezone — workspace-local day violated by UTC/server-local defaults
- **FAC-m1 (reproduced)** — date-only start-date defaults use `new Date().toISOString().slice(0,10)` (UTC), not `workspaceTodayIso()`: `facultyEmploymentRepository.ts:22-24`, `facultyEmployDesignationRepository.ts:21-23`, `facultyEmployDesignationSync.ts:20-22`, `facultyDesignationAssignmentRepository.ts:96`. Off-by-one for UTC+ workspaces. **Fix:** route all four through the workspace-local helper.
- **FAC-m2 (reproduced)** — employee-ID sequence year uses server-local `new Date().getFullYear()`: `facultyEmployeeIdGenerator.ts:18`, `facultyEmployeeIdPreview.ts:32`, `facultyEmployeeIdService.ts:14,57`. Annual rollover off by a day near midnight. **Fix:** use workspace-local year.

### 4.2 Error taxonomy & HTTP mapping
- **FAC-m3 (reproduced)** — restore/duplicate guards throw plain `Error` → 500 instead of `ValidationError`/`ConflictError`: `facultyCatalogTrashRepository.ts:121,127` ("Restore the department/parent first"), `facultyEmployDesignationSync.ts:43`. **Fix:** throw typed domain errors.
- **FAC-m4 (reproduced)** — `FacultyCatalogConflictError` carries no `statusCode`/`type`, relying on `instanceof`/message-substring matching: `faculty/errors.ts:7-11`, `facultyCatalogRouteAuth.ts:45-48`. **Fix:** extend `ConflictError` (`statusCode=409`).
- **FAC-m5 (reproduced)** — designation name-collision surfaces the raw PG `duplicate key … violates unique constraint` via `message.includes("duplicate key")`: `facultyCatalogRouteAuth.ts:48`, `facultyCatalogErrorResponse.ts:25-36`. **Fix:** map `isUniqueViolation` → clean 409.

### 4.3 Audit-trail completeness
- **FAC-m6 (reproduced)** — single-record create/update audit rows are summary-only (no `oldState`/`newState` snapshot), unlike catalog/assignment/employment repos: `facultyWriteUseCases.ts:178-186,244-252`. **Fix:** pass minimized state deltas.
- **FAC-m7 (reproduced)** — bulk status/specialization are entirely unaudited (direct-SQL writes): `facultyOperationUseCases.ts:41-47,62-66`. **Fix:** emit per-record audit in the same transaction.
- **FAC-m8 (reproduced)** — bulk soft-delete/restore emit outbox rows one-per-record in a loop instead of the batched `emitOutboxEvents`: `facultyEmploymentEntityAudit.ts:38-56,67-83`, `facultyRestoreUseCases.ts:152-161`, `facultySoftDeleteCascade.ts:24-36`. **Fix:** accumulate `OutboxBatchEvent[]` and emit once.
- **FAC-m9 (reproduced)** — outbox CDC `version` is a non-monotonic `Date.now()`/millis stamp despite the "monotonic" contract: `facultySoftDeleteCascade.ts:33`, `facultyRestoreUseCases.ts:69`, `facultyEmploymentEntityAudit.ts:54`. **Fix:** persisted monotonic sequence.

### 4.4 Reporting hierarchy
- **FAC-m10 (hypothesis)** — subordinate counting / ancestor queries filter `deleted_at IS NULL` only, never `status = 'active'` (unlike `validateFacultyDesignationLink` and `contactSystemTagFacultyCompute`): `facultyRepositorySubordinateCounts.ts:39-48`, `facultyRepositoryAncestors.ts:16-35`. **Fix:** confirm intent and add `status='active'` if inactive designations should drop out.

### 4.5 Employee ID
- **FAC-m11 (hypothesis)** — collision probe is `lower(trim(...))`-insensitive but the enforcing partial unique index is case-sensitive: `facultyEmployeeIdGenerator.ts:121` vs `facultyEmploymentTables.ts:56-58`. Probe is stricter than the index; a case-variant duplicate can still be inserted via the explicit-`employeeId` path. **Fix:** align semantics (expression index or accept case-sensitive IDs).
- **FAC-m12 (hypothesis)** — collision loop has no exhaustion guard; after 1000 collisions it returns the still-colliding candidate: `facultyEmployeeIdGenerator.ts:113`. **Fix:** define a failure mode.

### 4.6 Module access gate
- **FAC-m13 (reproduced)** — catalog PUT saves (`PUT /api/faculty/departments/:id`, `designations/:id`) resolve to `write` not `setupWrite`, though the handler requires `canManageFacultySetup`: `moduleRouteActions.ts:33` vs `facultyCatalogRouteAuth.ts:37-39`. No security bypass (handler is stricter), but the gate doesn't fail-fast on the setup permission — the class `moduleAccessCoverage` exists to catch. **Fix:** add a `setupWrite` rule for the two PUT saves and pin them in `EXPECTED_MODULE_ROUTE_ACTIONS`.

### 4.7 Soft-delete
- **FAC-m14 (reproduced)** — `saveFacultyDepartment` upsert lacks `setWhere: isNull(deletedAt)` (unlike designation), so an upsert against a trashed id mutates the soft-deleted row then 500s: `facultyDepartmentRepository.ts:173-183`. **Fix:** mirror the designation guard.
- **FAC-m15 (hypothesis)** — `findFacultyById`/`findFacultyByIds` don't filter `deleted_at IS NULL` (unlike list): `facultyRepository.ts:56-69,122-132`. **Fix:** confirm the GET `/:id` route gates archived rows, or add the filter.
- **FAC-m16 (hypothesis)** — session revocation runs inside the write transaction before commit; a later rollback leaves linked-user sessions revoked while the row is not deleted: `facultySoftDeleteCascade.ts:37`, `facultySoftDeleteUseCases.ts:56,122`. **Fix:** move `revokeFacultySessions` to `runAfterCommit`.

### 4.8 Realtime invalidation
- **FAC-m17 (reproduced)** — assignment save/close/delete reconcile contact tags (broadcasts `contacts`) but never `broadcastCollection("faculty")`, so other clients' faculty list/detail (which derive primary designation + subordinate counts from `faculty_assignments`) stay stale: `facultyAssignmentRouteHandlers.ts:135-152,191-195,227-231`. **Fix:** broadcast `faculty` after each assignment write.

### 4.9 Shared package / contract parity
- **FAC-m18 (reproduced)** — contract `facultyWriteSchema` is non-strict `.catchall`, diverging from the `.strict()` dynamic schema that actually validates writes: `facultyModuleManifest.ts:119`, `faculty.dto.ts:289`, `faculty.contract.ts:60,74`. **Fix:** make the contract body strict or reference the dynamic schema.
- **FAC-m19 (hypothesis)** — `employment` is accepted by the core schema but neither accepted nor stripped by the strict write validator, so a read→write round-trip of the read shape could 400: `facultyModuleManifest.ts:98`, `faculty.dto.ts:107-137,262-280`. **Fix:** add `employment` to the strip list.
- **FAC-m20 (reproduced)** — `facultyPreferencesPutBodySchema` is `.passthrough()` unlike its `.strict()` field-config sibling: `facultySetupConfigTypes.ts:49`. **Fix:** use `.strict()`.
- **FAC-m21 (reproduced)** — `bulkDelete`/`bulkRestore` bodies omit the 500-item cap + `.min(1)`: `faculty.contract.ts:192,201`. **Fix:** reuse `bulkIdsBodySchema`.
- **FAC-m22 (reproduced)** — duplicated literal union swallowed by `| string` makes the enum a no-op: `facultyTypes.ts:127`, `facultyModuleManifest.ts:35`. **Fix:** `FacultyIjazahField | (string & {})`.
- **FAC-m23 (hypothesis)** — hardcoded default year `2026` will go stale: `facultyModuleSettings.ts:95`. **Fix:** derive from a current-year provider.
- **FAC-m24 (reproduced)** — `POST /api/faculty/resolve` accepts uncapped `ids` (read-only amplification target): `faculty.contract.ts:205-215`. **Fix:** cap at 500.

### 4.10 i18n (en/ar/ur/fa)
- **FAC-m25 (reproduced)** — hardcoded English workload warnings: `facultyWorkload.ts:97,102,109,115`. **Fix:** return codes/tiers, translate at caller.
- **FAC-m26 (reproduced)** — hardcoded English Zod `.refine` messages: `facultyDesignationTypes.ts:52,77,91`, `facultyDepartmentTypes.ts:136`. **Fix:** use `translateApp`/locale keys.
- **FAC-m27 (reproduced)** — hardcoded English display-name fallback + hierarchy labels: `facultyUtils.ts:159,161`, `facultyTypes.ts:108-117`. **Fix:** `labelKey`s + translate at UI.
- **FAC-m28 (reproduced)** — frontend error fallbacks default to English: `useFacultyQueries.ts:63-65,153,175`, `useFacultyTsrQueries.ts:63`, `useEmployeeIdMigration.ts:56`. **Fix:** localized messages at every call site.

### 4.11 Frontend form lifecycle & DRY
- **FAC-m29 (reproduced)** — create/edit form hand-rolls identity reset + dirty tracking instead of `useIdentityReset`/`useDirtySnapshot`: `useFacultyDraftState.ts:64-96`. **Fix:** reuse the shared helpers.
- **FAC-m30 (reproduced)** — primary save + department/designation submits fire-and-forget with no synchronous re-entry guard (double Enter can enqueue two saves): `FacultyForm.tsx:132`, `FacultyDepartmentFormModal.tsx:123,131`, `FacultyDesignationFormModal.tsx:182,190`. **Fix:** wrap in `useSubmitGuard()`.
- **FAC-m31 (reproduced)** — list queries use deprecated `keepPreviousData` instead of `placeholderData: (prev) => prev`: `useFacultyTsrQueries.ts:65,78` (also repo-wide residual). **Fix:** swap.
- **FAC-m32 (reproduced)** — `FacultyDepartmentsTable`/`FacultyDesignationsTable` duplicate status-config, badge markup, and `rowClassName`. **Fix:** extract a shared catalog badge helper.
- **FAC-m33 (reproduced)** — roster export columns re-declared in `FacultyReportTables.tsx:49-57` though `report.rosterExportColumns` already supplies them (`FacultyReportView.tsx:68`). **Fix:** pass the view-model columns down.
- **FAC-m34 (hypothesis)** — roster/workload tabs nest `ReportDataGridContainer` inside the outer one (two titled toolbars); reads as accepted convention shared with `StudentReportView`.

### 4.12 Performance & legacy surface
- **FAC-m35 (reproduced)** — `bulkSaveFaculty` loops per-item through `persistFacultyTx` (≥3 queries each) plus per-item role sync — an N+1 import path: `facultyRepository.ts:197-214`. **Fix:** batch resolution + single role-sync reconciliation.
- **FAC-m36 (reproduced)** — the legacy `teachers` view is never dropped: `0112:45`, `0113:8-9`, `0121:47-49` re-create it, and `0130:20-29` drops the other `teacher_*` tables but omits `teachers`. **Fix:** forward-only migration dropping the view.

---

## 5. Test gaps (reported separately — "untested" ≠ "broken")

1. No `inject()` test proves `validateReportingHierarchy` is wired into `createFaculty`/`updateFacultyById` (unit tests exercise it in isolation, masking FAC-M2).
2. No test asserts non-null `createdBy`/`updatedBy`/`realUserId` on single-record create/update (why FAC-M1 is uncaught).
3. No `inject()` test for the real `x-expected-updated-at` → 409 OCC wiring (only a mocked unit test).
4. No coverage pin for the catalog PUT-save module-gate action (why FAC-m13 stays green).
5. No test for workspace-local-day defaults against a non-UTC timezone (why FAC-m1 is uncaught).
6. No test for employee-ID annual rollover across a timezone boundary (FAC-m2).
7. No test for the case-insensitive-probe vs case-sensitive-index mismatch (FAC-m11).
8. No test asserting inactive designations are excluded from subordinate counts (FAC-m10).
9. No round-trip test proving the dynamic schema accepts the read mapper's exact output shape (FAC-m19).
10. No spec that designation restore maps trashed-department/parent + name-collision to 4xx (FAC-m3/m5).
11. No spec that assignment save/close/delete broadcast `faculty` (FAC-m17).
12. No spec that bulk soft-delete/restore use batched `emitOutboxEvents` (FAC-m8).
13. No spec that create/update audit rows carry state deltas (FAC-m6).
14. No spec that bulk status/specialization record audit events (FAC-m7).
15. No i18n guard pinning English fallbacks out of error paths (FAC-m28 + FAC-m25/26/27).
16. No double-submit-safety spec on form saves (FAC-m30).

---

## 6. Domain-compliance summary

- **Legacy-surface bans:** `check:faculty-domain` passes; the `/api/teachers` route, `facultyDesignationAssignments` FDA, and `hydrateTeachersSetupFromLegacyObjects` are gone. One residual: the `teachers` DB view still exists (FAC-m36).
- **Temporal non-overlap:** correctly app-enforced — `pg_advisory_xact_lock` + single-primary non-overlap, open-end=infinity, `endDate < startDate` and inactive-link rejection, typed 400/409. The only defect is the UTC-vs-workspace-local default dates (FAC-m1/m2).
- **SSOT:** hydrate/reconcile reads are lean and idempotent; contact tags archive as `Former faculty-…`; no dual write path for the main entity.
- **Module access gates:** registered + covered; one action-resolution mismatch on catalog saves (FAC-m13).

---

## 7. Recommended next actions (prioritized)

- **P0 (do first):**
  1. FAC-M1 — thread the actor into `createFaculty`/`updateFacultyById` and stamp `createdBy`/`updatedBy`.
  2. FAC-M2 — wire `validateReportingHierarchy` into the write path, or delete it and document designation-level enforcement.
- **P1 (correctness/audit):**
  3. FAC-m1/m2 — replace UTC/server-local date defaults with the workspace-local day.
  4. FAC-m13 — add the `setupWrite` module-gate rule for catalog PUT saves (+ coverage pin).
  5. FAC-m17 — broadcast `faculty` on assignment writes.
  6. FAC-m3/m4/m5 — typed errors + clean 409 mapping in the catalog restore path.
  7. FAC-m6/m7 — complete audit state deltas and audit the bulk status/specialization writes.
  8. FAC-m21/m24 — cap `bulkDelete`/`bulkRestore`/`resolve` ids at 500.
- **P2 (hygiene/DRY/i18n):** FAC-m8/m9 (batched + monotonic outbox), FAC-m11/m12 (employee-ID index/loop), FAC-m14/m15/m16 (soft-delete), FAC-m18–m23 (contract parity), FAC-m25–m34 (i18n + form lifecycle + DRY), FAC-m35 (N+1), FAC-m36 (drop `teachers` view).
- **Test-first:** add the 16 specs in §5 alongside each fix — each finding maps to a pinning test on the production path, per `mms-code-review` evidence rules.

---

## 8. Appendix — audit coverage matrix

| Layer | Reviewer | Outcome |
|---|---|---|
| Backend data layer (schema/repos/migrations) | `audit-faculty-data` | 5 Minor + test gaps; no Critical/Major |
| Backend routes & authorization | `audit-faculty-routes` | 1 Major (FAC-M1), 2 Minor + test gaps |
| Backend use-cases & services | `audit-faculty-usecases` | 1 Major (FAC-M2), 7 Minor + test gaps |
| Frontend (page/components/hooks/lib) | `audit-faculty-frontend` | 7 Minor + test gaps |
| Shared package & contracts | `audit-faculty-shared` | 9 Minor + test gaps |
| Cross-cutting (audit/soft-delete/realtime/import) | `audit-faculty-crosscut` | 8 Minor + test gaps |
