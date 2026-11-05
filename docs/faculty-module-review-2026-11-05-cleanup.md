# Faculty module — whole-module review: bugs, optimisation, cleanup (2026-11-05)

Whole-module pass over Faculty at `main` HEAD `a51ae8bd5` + the working tree: backend
(`apps/backend/src/faculty/**`, `routes/tenant/faculty/**`, `db/repositories/faculty*` ≈ 9.7k LOC),
frontend (`apps/frontend/src/tenant/features/faculty/**` ≈ 20.9k LOC) and the shared faculty package
(`packages/shared/src/faculty/**` + contracts ≈ 5.5k LOC).

| Method | What it covered |
|---|---|
| Import-graph + symbol-reference scan (whole repo corpus) | zero-reference exports, files imported only by tests, orphaned modules |
| Contract ↔ consumer map | endpoints the shared contract declares but no frontend calls |
| Barrel-import analysis | re-exports nobody imports (write-only public surface) |
| Targeted unit suites per finding (red → green) | every fix below |
| Limitation | no DB/browser run; dead-code removal **not executed** (candidates only, per request) |

---

## 1. Critical Fixes

### C1 — Archiving faculty rewrote (or 403-blocked) the linked account's role
**Root cause.** `repository.save` / `bulkSave` always ran `syncFacultyLinkedUserRole`
(`db/repositories/facultyRepository.ts:144-147, 205-217`), and `bulkSave` is the **archive** path
(`facultySoftDeleteUseCases.ts:55,121`). Archiving therefore re-derived the linked account's RBAC role from
the designations of a record that is being deleted — and, after the round-2 authorization fix, threw
`FacultyRoleSyncForbiddenError` (403) when the actor lacked `users.manage`.
**Impact.** A `faculty.delete`-only role could not archive a linked faculty member (unrelated privilege
leakage), and an archive could silently rewrite an unrelated account's role. Plus 1–3 reads per archived row.
**Fix.**
```ts
// faculty/repository/facultyRepository.ts
bulkSave(tenant, members, options?: { syncRole?: boolean }): Promise<void>;

// db/repositories/facultyRepository.ts
if (options?.syncRole !== false) await syncFacultyLinkedUserRole(subdomain, item);

// faculty/use-cases/facultySoftDeleteUseCases.ts (both call sites)
await repo.bulkSave(tenant, toSave, { syncRole: false });
```
Restore intentionally keeps the sync (restoring re-grants designations).
**Test.** `facultySafetyAndRbac.test.ts` — archive passes `{ syncRole: false }`, restore keeps the default.

### C2 — Restore was audited after commit (and would otherwise double-audit)
**Root cause.** `restoreFacultyById` / `bulkRestoreFaculty` wrote the row, outbox event and contact tags but
**no** in-transaction audit row; the only row came from the route's post-commit `auditFaculty`. A committed
restore could therefore exist with no audit row (`mms-data-layer §5.4`).
**Impact.** Audit-trail gap on restore (compliance), inconsistent with create/update/delete/bulk-delete.
**Fix.**
```ts
// facultyRestoreUseCases.ts — single + per-member inside the write transaction
await appendCollectionAuditInTx({ tenant, tableName: "faculty", recordId: String(id),
  action: "faculty.restore", summary: `Restored faculty member ${String(id)}`,
  realUserId: userId ?? null, subjectId: String(id) });
// routes/tenant/faculty/facultySoftDeleteRoutes.ts — drop onAfterRestore + onAfterBulkRestore audits
```
**Test.** `facultyUseCases.test.ts` — single + bulk restore append `faculty.restore` with the actor.

### C3 — Employee-ID backfill ran the next-ID computation per row (O(3N) queries)
**Root cause.** `migrateFacultyMissingEmployeeIds` called `computeNextFacultyEmployeeIdForSettings` for each
row, and that helper re-read module preferences, re-ran `COUNT(*)` (`countNextEmployeeId`) and probed
collisions **every time** (`facultyOperationUseCases.ts:162-169`).
**Impact.** A 500-member backfill issued ~1,500 avoidable reads inside one transaction.
**Fix.** One count + local sequence, probing only the candidate:
```ts
const count = await repo.countNextEmployeeId(tenant, { prefix: settings.idPrefix,
  restartAnnually: settings.idRestartAnnually, year });
let seq = Math.max(count + 1, startSeq);
for (const row of missing) {
  let employeeId = formatFacultyEmployeeId(seq, settings, now);
  for (let tries = 0; tries < 10; tries += 1) {
    if ((await repo.findRegistrationConflict(tenant, { employeeId })) !== "employeeId") break;
    seq += 1; employeeId = formatFacultyEmployeeId(seq, settings, now);
  }
  await repo.save(tenant, { ...row, employeeId }); seq += 1;
}
```
**Test.** `facultyOperationUseCases.test.ts` — `countNextEmployeeId` called once for N rows; sequential,
unique IDs.

### C4 — CSV import created faculty with bare UUIDs, breaking the `fac-<uuid>` scheme
**Root cause.** `facultyImportJobUseCases.ts:107` passed `id: randomUUID()`, bypassing `resolveFacultyRowId`
(the resolver that prefixes `fac-`).
**Fix.** Stop supplying the id; the resolver owns it.
```ts
const created = await createFaculty({ contactId, ...patch },
  { batch, canRestore, skipEmployeeIdPreview: true });
```
**Test.** `facultyImportJobUseCases.test.ts` — create payload has no `id`.

### C5 — Batch creates probed the employee-ID preview per row
**Root cause.** `createFaculty` calls `previewNextFacultyEmployeeId(tenant)` whenever an employee ID is
supplied (`facultyWriteUseCases.ts:105-118`). For a CSV every row supplies one, so each import row paid an
extra read for a stale-UI safeguard that a file-driven ID does not need.
**Fix.** `CreateFacultyOptions.skipEmployeeIdPreview?: boolean`, passed by the import job (see C4).
Interactive creates keep the probe.
**Test.** `facultyImportJobUseCases.test.ts` — options include `skipEmployeeIdPreview: true`.

---

## 2. Recommended Refactors

| # | Finding | Status |
|---|---|---|
| **R1** | **Linked-role sync ran on every edit.** Notes/specialization/status edits cannot change the designation-derived role, yet each save paid 1–3 reads (linked user, designations, workspace roles) plus a possible RBAC invalidation + `users` broadcast. Added `facultyRoleFingerprint()` (contact, designation, tenure, status) and pass `{ syncRole: false }` when unchanged (`save` + the OCC `saveIfVersionMatches`). | **Implemented + tested** (`facultyUseCases.test.ts`) |
| **R2** | **Draft dirty-check stringified the whole draft on every render** (`useFacultyDraftState.ts`). Memoised with `useMemo` keyed on the draft object. | **Implemented** (no behaviour change) |
| **R3** | **Fabricated supervisor status.** `FacultyReportingHierarchyCard` rendered an "Active" badge for the supervisor row although no supervisor status exists (and the supervisor block is unreachable while `reportingFacultyId`/`reportingFacultyName` stay write-stripped — deferred M5). Removed the badge; the subordinates block is untouched. | **Implemented + tested** |
| R4 | **Employee-ID concern split across three modules** (`facultyEmployeeIdService`, `…Generator`, `…Preview`) with duplicated fallback defaults and a `NONE` year branch the settings schema cannot produce (`facultySetupConfigTypes.ts:40` allows only YYYY/YY). Consolidate into one module + one config type. | Documented — needs care |
| R5 | **`facultyCatalogUseCases` is a pass-through factory** that re-spreads the whole repository interface (no logic). Collapse to named re-exports. | Documented |
| R6 | **Route guard duplication**: `handleDuplicateCheck` / `handleNextEmployeeId` / `handleMigrateEmployeeIds` repeat tenant-guard + try/catch shapes. Extract one `withFacultyTenant` helper. | Documented |
| R7 | **Widget aggregates issue 2–4 queries per widget** in parallel on one transaction (`facultyRepositoryWidgets.ts:23-103`). Fine today; pre-aggregate if widget counts grow. | Documented — monitor |
| R8 | **Five-layer frontend prop drilling** (`useFacultyPageController → facultyPageWorkTierProps → facultyWorkTierProps → useFacultyWorkPanelProps → FacultyPageView`). Derive view props from a single state type. | Documented — phase 2 |

---

## 3. Unused Code Candidates — **nothing deleted; confirm before removal**

Verification: whole-repo symbol scan (declaration + every reference, tests included), relative/alias import
graph with ESM `.js` resolution, and per-name import search for barrels. Items marked † are exported from
`@mms/shared` — a workspace package API — so an external consumer must be ruled out first.

### 3.1 Files (production-dead)
| File | Why it is a candidate |
|---|---|
| `apps/backend/src/db/repositories/facultyHierarchySql.ts` | Imported only by a test; holds dead `assignmentHierarchySql` (`WHERE FALSE`) and `validateHierarchyDepth`, whose only caller is that dead SQL. |
| `apps/frontend/src/tenant/features/faculty/components/FacultyDepartmentSelectField.tsx` | Imported only by `FacultyDynamicSelectFields.test.tsx`; no render path. |
| `apps/frontend/src/tenant/features/faculty/components/FacultyFormAllSections.tsx` | Reached only from the unreachable fallback in `FacultyFormTabContent.tsx:124-143` (all three canonical tabs — contact/employment/designation — are handled above it). |

### 3.2 Backend symbols (zero production references)
`validateReportingHierarchy` (test-only; the production path never calls it) · `findAncestorChain`
(port + repository; only that dead validator uses it) · `assignmentHierarchySql` · `countFacultyByWorkspace` ·
`attachPrimaryAppointmentToFacultyList` · `reassignSubordinates` (port + adapter + stub — caller-less since the
round-3 archive guard) · `resolveSupervisorPrimaryPositionId` · `findFacultyManagerChain` ·
`checkAssignmentCycleSafe` · `FacultyCsvExportOptions` · `FacultyCsvExportResult`.

### 3.3 Shared `@mms/shared` exports (zero repo references) †

> Updated 2026-11-05: the zero-reference code items in §3.1/§3.2 were removed (see
> [`faculty-dead-code-audit-2026-11-05.md`](./faculty-dead-code-audit-2026-11-05.md) §A). The shared list below
> is 21 zero-reference exports plus 4 that are only self-referenced.
`FacultyDesignation` · `FacultyDepartment` · `resolveFacultyDesignations` · `resolveFacultyDepartments` ·
`FACULTY_DESIGNATION_VALUES` · `FACULTY_DEPARTMENT_VALUES` · `FacultySpecialization` · `FacultyHierarchyPreset` ·
`FACULTY_HIERARCHY_RANK_PRESETS` · `DEFAULT_FACULTY_HIERARCHY_RANK` · `FacultyDirectoryColumnKey` ·
`FacultyAssignmentStatus` · `FacultyAssignmentWrite` · `FacultyDesignationAssignmentWrite` ·
`FacultyModuleTier` · `FacultyFieldConfig` · `FacultyBulkSpecializationBody` · `facultyListSchema` ·
`mergeFacultyFormTabsFromApi` · `isFacultySeedFieldKey` · `findFacultyFieldInMap` · `getFacultyQualification` ·
`getFacultySpecialization` · `computeFacultyWidgetAggregates` · `defaultFacultyWorkColumnRegistry`.

### 3.4 Contract endpoints with no client consumer (verify against API consumers before retiring)
`GET /api/faculty/hierarchy-tree` (also loads up to 1,000 rows + hydration per call) ·
`GET /api/faculty/:facultyId/designations/history` · `GET /api/faculty/:facultyId/assignments/:id/subordinates` ·
`GET /api/faculty/:facultyId/assignments/:id/manager-chain` (both serve hard-coded `[]` stubs).

### 3.5 Frontend exports
Direct: `FacultyDrawer` alias (`FacultyDetail.tsx`), `setFacultyFieldConfigMemory`,
`getFacultySettingsMemoryFallback`, `useFacultyLookupMutation`, `useFacultyContractMigrateEmployeeIds`.

Barrel-only (exported by `tenant/hooks/collections/faculty.ts`, imported by **no** consumer — 22 of 32):
`FACULTY_QUERY_KEY`, `facultyCommandMetricsQueryOptions`, `facultyWidgetAggregatesQueryOptions`,
`useFacultyMutations`, `FACULTY_PREFERENCES_QUERY_KEY`, `facultyListQueryOptions`, `useFacultyContractGet`,
`useFacultyContractNextEmployeeId`, `useFacultyContractCreate`, `useFacultyContractUpdate`,
`useFacultyContractDelete`, `useFacultyContractBulkStatus`, `useFacultyContractDuplicateCheck`,
`FACULTY_DEPARTMENTS_QUERY_KEY`, `facultyDepartmentsQueryOptions`, `useFacultyDepartments`,
`useSaveFacultyDepartment`, `useDeleteFacultyDepartment`, `departmentEntitiesToNames`,
`FACULTY_DESIGNATIONS_QUERY_KEY`, `facultyDesignationsQueryOptions`, `useFacultyDesignations`.

---

## 4. Verification

| Gate | Result |
|---|---|
| Backend faculty suite | **44 files / 287 tests pass** (was 279; +8 new) |
| Frontend faculty suite | **73 files / 247 tests pass** (was 246) |
| `typecheck` | backend clean; **0 faculty frontend errors** |
| `lint` | no new errors in touched files |
| `check:faculty-domain` · `check:backend-structure` · `check:code-norms` · `check:docs` | pass |

Red evidence recorded per fix (e.g. C1's archive test failed with `bulkSave("demo", […])` before the option
existed; C3's `countNextEmployeeId` was called twice for two rows; C5's create options lacked the flag).

**Limitations.** No DB/browser run — the restore audit rows and role-sync skip are unit-verified, with DB
coverage left to the `test:db` shard. The working tree is edited concurrently by another session; two
`vitest` runs lost their Vite dep cache mid-run (`Cannot find module …/.vite/deps/…`, every executed test
passing) and were re-run after clearing `apps/frontend/node_modules/.vite`.
