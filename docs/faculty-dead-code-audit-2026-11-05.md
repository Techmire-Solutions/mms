# Faculty module — dead-code & dependency audit (2026-11-05)

Scope: the whole Faculty module — backend (`apps/backend/src/faculty/**`, `routes/tenant/faculty/**`,
`db/repositories/faculty*`, `db/schema/faculty*`, `services/faculty*`), frontend
(`apps/frontend/src/tenant/features/faculty/**` + its cross-module barrel), and `@mms/shared` faculty
sources/contracts. Supersedes the candidate register in
[`faculty-module-review-2026-11-05-cleanup.md`](./faculty-module-review-2026-11-05-cleanup.md) §3.

## Method & safeguards

| Step | Coverage |
|---|---|
| Symbol-reference scan | Every exported declaration in the module vs **every** reference in the repo (apps, packages, e2e, scripts; tests included; `dist` excluded). |
| Import-graph scan | Relative + alias imports with ESM `.js` resolution → files with no importer, and files imported **only** by tests. |
| Contract ↔ consumer map | Endpoints declared in `facultyContract` vs frontend call sites. |
| Barrel analysis | Re-exports in `tenant/hooks/collections/faculty.ts` vs actual `import { … } from` usage. |
| Dependency scan | Declared `dependencies` per app vs bare import specifiers (static + dynamic `import()` + `require`). |
| Asset scan | Every file in `apps/frontend/public` vs HTML/manifest/TS references. |
| Lint sweep | `@typescript-eslint/no-unused-vars` (with the repo's `^_` convention) over the faculty scope — **0 findings** (no unused imports/locals). |
| Safeguard | Each executed/candidate symbol was grepped for dynamic `import()`, string-key access, and reflection before classification; framework entry points (Fastify route registration, lazy page route, seed CLI scripts) were excluded from orphan logic. |

---

## A. Executed removals (dead code deleted this round)

Every item below had **zero references repo-wide**, no dynamic import/string reference, and is not part of a
published package's public surface.

| Target file | Item/import removed | Reason |
|---|---|---|
| `apps/backend/src/db/repositories/facultyRepository.ts` | `countFacultyByWorkspace()` | Zero references; superseded by `countByWorkspace` on the repository port (used by `countFaculty`). It pulled `buildTenantSoftDeleteConditions` + a `COUNT(*)` scan nothing called. |
| `apps/backend/src/db/repositories/facultyRepositoryColumns.ts` | `attachPrimaryAppointmentToFacultyList()` | Zero references; a pass-through wrapper over `attachPrimaryAppointmentFields` (still used by `hydrateFacultyList`). |
| `apps/backend/src/services/facultyExportService.ts` | `FacultyCsvExportOptions`, `FacultyCsvExportResult` type aliases | Zero references; aliases of `FacultyExportOptions`/`FacultyExportResult`, which remain. |
| `apps/backend/src/db/repositories/facultyHierarchySql.ts` | `assignmentHierarchySql()` + now-unused `sql` / `facultyAssignmentSchema` imports | Dead `WHERE FALSE` stub from the removed organization model; zero references. |
| `apps/frontend/.../components/FacultyDetail.tsx` | `export const FacultyDrawer = FacultyDetail` | Zero references; a second name for the same component. |
| `apps/frontend/.../hooks/facultySetupConfigApi.ts` | `setFacultyFieldConfigMemory()`, `getFacultySettingsMemoryFallback()`, `memoryFieldConfig` state + `composeFacultySettings` import | Write-only module state: the getter was its only reader and had zero references, so the cache could never be observed. |
| `apps/frontend/.../hooks/useFacultyLookups.ts` | `useFacultyLookupMutation` | Zero references (setup lookups only read; writes go through the contract mutation helper elsewhere). |
| `apps/frontend/.../hooks/useFacultyTsrMutations.ts` | `useFacultyContractMigrateEmployeeIds()` | Zero references; the migration flow calls `apiContract` through `useEmployeeIdMigration`. |

Representative diffs:

```diff
-export async function countFacultyByWorkspace(
-  tenant: string,
-  options?: ListFacultyOptions,
-): Promise<number> { … }

-export async function attachPrimaryAppointmentToFacultyList(
-  tx: AppDb, subdomain: string, rows: FacultyMember[],
-): Promise<FacultyMember[]> {
-  return attachPrimaryAppointmentFields(tx, subdomain, rows);
-}
```

```diff
-let memoryFieldConfig: FacultySettings | null = null;
-export function setFacultyFieldConfigMemory(config: FacultySettings): void { … }
-
 export async function fetchFacultyFieldConfig(_signal?: AbortSignal) {
   …
-  const merged = normalizeFacultySettings(data?.config ?? null);
-  memoryFieldConfig = merged;
-  return merged;
+  return normalizeFacultySettings(data?.config ?? null);
 }
…
-export function getFacultySettingsMemoryFallback(): FacultySettings {
-  return composeFacultySettings(memoryFieldConfig, api.getSettingsMemoryFallback(), …);
-}
```

**Verification after removal:** backend typecheck clean · backend faculty suite **44 files / 287 tests** ·
frontend typecheck **0 faculty errors** · frontend faculty suite **73 files / 247 tests** · lint clean on all
touched files (`faculty-domain`, `backend-structure`, `code-norms` ratchets unaffected).

---

## B. Candidate files — **not deleted, awaiting confirmation**

| Target file | Why it appears orphaned | Safeguard check |
|---|---|---|
| `apps/backend/src/db/repositories/facultyHierarchySql.ts` | Now holds only `validateHierarchyDepth`, imported **only** by `facultyAssignmentValidation.test.ts`; no production caller remains after the stub removal. | No dynamic import; not a route/registrar; safe to delete **with** its test cases (or keep as the depth guard until the reporting-hierarchy model returns). |
| `apps/frontend/src/tenant/features/faculty/components/FacultyDepartmentSelectField.tsx` | Imported only by `FacultyDynamicSelectFields.test.tsx`; no render path in the form. | No dynamic/alias import elsewhere; not referenced by a route or registry. |
| `apps/frontend/src/tenant/features/faculty/components/FacultyFormAllSections.tsx` | Reachable only from the fallback in `FacultyFormTabContent.tsx` (after the `contact` / `employment` / `designation` branches), and those are the only canonical form tabs. | Static import exists, but the branch is unreachable; remove the component **and** the fallback branch together. |

Adjacent cleanup to do with (2): `FacultyDynamicSelectFields.test.tsx` currently tests only that dead
component — delete the spec with it.

---

## C. Candidate exports / types — **not removed (need your confirmation)**

### C1. `@mms/shared` public package — 21 exports with zero references repo-wide
These are package API, so an external consumer cannot be ruled out from inside this repo:

`defaultFacultyWorkColumnRegistry` · `FacultyAssignmentStatus` · `FacultyAssignmentWrite` ·
`FacultyDesignationAssignmentWrite` · `FacultyDirectoryColumnKey` · `isFacultySeedFieldKey` ·
`findFacultyFieldInMap` · `FacultyBulkSpecializationBody` · `facultyListSchema` · `FacultyModuleTier` ·
`FacultyFieldConfig` · `mergeFacultyFormTabsFromApi` · `FacultyDesignation` · `resolveFacultyDesignations` ·
`FacultyDepartment` · `resolveFacultyDepartments` · `FACULTY_HIERARCHY_RANK_PRESETS` ·
`DEFAULT_FACULTY_HIERARCHY_RANK` · `getFacultyQualification` · `getFacultySpecialization` ·
`computeFacultyWidgetAggregates`.

### C2. `@mms/shared` — zero external references but self-referenced (un-export candidates)
`FacultySpecialization`, `FACULTY_DESIGNATION_VALUES`, `FACULTY_DEPARTMENT_VALUES`, `FacultyHierarchyPreset`.

### C3. Backend — production-dead, but pinned by tests (remove code **and** spec together)
`validateReportingHierarchy` (`facultyHierarchyValidator.ts`, test-only), `findAncestorChain`
(port + `facultyRepositoryAncestors.ts`, only the dead validator uses it), `findFacultyManagerChain`,
`checkAssignmentCycleSafe` (assignment-hierarchy stubs, no callers), `reassignSubordinates` +
`resolveSupervisorPrimaryPositionId` (caller-less after the archive guard), and the schema row-type aliases
in `db/schema/faculty*.ts` that are never imported (`NewFaculty`, `FacultyWithContact`, `*Row`,
`Insert*Row` — 19 aliases).

### C4. Frontend barrel — 22 unconsumed re-exports in `tenant/hooks/collections/faculty.ts`
`FACULTY_QUERY_KEY`, `facultyCommandMetricsQueryOptions`, `facultyWidgetAggregatesQueryOptions`,
`useFacultyMutations`, `FACULTY_PREFERENCES_QUERY_KEY`, `facultyListQueryOptions`, `useFacultyContractGet`,
`useFacultyContractNextEmployeeId`, `useFacultyContractCreate`, `useFacultyContractUpdate`,
`useFacultyContractDelete`, `useFacultyContractBulkStatus`, `useFacultyContractDuplicateCheck`,
`FACULTY_DEPARTMENTS_QUERY_KEY`, `facultyDepartmentsQueryOptions`, `useFacultyDepartments`,
`useSaveFacultyDepartment`, `useDeleteFacultyDepartment`, `departmentEntitiesToNames`,
`FACULTY_DESIGNATIONS_QUERY_KEY`, `facultyDesignationsQueryOptions`, `useFacultyDesignations`.
Their definitions stay (some have other consumers); only the barrel lines would go.

---

## D. Contract endpoints with no client consumer — **not removed (API surface)**

`GET /api/faculty/hierarchy-tree` (also loads up to 1,000 rows + hydration per call) ·
`GET /api/faculty/:facultyId/designations/history` ·
`GET /api/faculty/:facultyId/assignments/:id/subordinates` ·
`GET /api/faculty/:facultyId/assignments/:id/manager-chain` (the latter two return hard-coded `[]`).

Retiring them also removes their route handlers, contract declarations, and the stubs in C3.

---

## E. Dependencies

| App | Finding | Verdict |
|---|---|---|
| `apps/backend` | `@ts-rest/core` is declared but never imported by backend source (`pnpm why` shows it reaches the app via `@ts-rest/fastify`, `@ts-rest/open-api`, and `@mms/shared`). | **Candidate to drop** from `apps/backend/package.json` after a clean-install check (workspace peer resolution). |
| `apps/frontend` | A naive scan flags 10 `@radix-ui/*` packages and `class-variance-authority`, but every one is imported by `packages/ui/src`, which the frontend compiles through its `@shared/ui` alias — they must stay. | **Not unused** (documented false positive). |
| `@mms/shared` / `@mms/ui` | No faculty-specific dependency was introduced by the module. | Nothing to remove. |

## F. Orphaned assets & entry points

- **Assets:** none. Every `apps/frontend/public` file is referenced (7 favicon, 2 ico, 3 apple-touch, 1+1
  PWA icons, 2 platform logo, 1 manifest, 4 theme-init). The Faculty module owns no media files.
- **Entry points excluded from orphan logic:** `apps/backend/src/routes/tenant/faculty.ts` (registered in
  `app.ts`), `FacultyPage.tsx` (lazy route), `scripts/seed-20-faculty.ts` / `seed-faculty-setup.ts` (CLI,
  invoked via `tsx`, documented in `docs/a11y-baseline.md`), and `db/migrations/facultyContactIndex.ts` /
  `facultyReportingBackfill.ts` (called by `dbInit` / migration `087`).
- **i18n:** 0 unused `faculty.*` translation keys (the repo-wide unused-key ratchet reports 447, none faculty).

---

## G. How to confirm the candidates

1. **Package API (C1/C2):** confirm no out-of-repo consumer imports `@mms/shared` faculty types; then delete
   the declarations (and their self-references in C2).
2. **Files (B):** say the word per file; (1) also needs its two test cases removed, (3) needs the fallback
   branch in `FacultyFormTabContent`.
3. **Dead-but-tested code (C3):** remove together with the specs that pin it
   (`facultyHierarchy.integration.test.ts` cases, `facultyAssignmentValidation.test.ts` depth case).
4. **Barrel (C4):** trim the 22 re-export lines — no other file imports them.
5. **Endpoints (D):** confirm no API consumer, then drop contract + handler + stub.
6. **Dependency (E):** `pnpm --filter mms-backend remove @ts-rest/core` on a branch and run the backend
   build/test.

## H. Verification (this round)

| Gate | Result |
|---|---|
| Backend `typecheck` | clean |
| Backend faculty suite | 44 files / 287 tests pass |
| Frontend `typecheck` | 0 faculty errors |
| Frontend faculty suite | 73 files / 247 tests pass |
| Lint (touched files) | clean |
| `check:faculty-domain` · `check:backend-structure` · `check:code-norms` · `check:docs` | pass |
| Unused-vars sweep (faculty scope) | 0 findings (no unused imports/locals) |
