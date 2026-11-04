# Students Dead-Code, Dependency & Orphan Audit — 2026-11-05

Whole-module audit of the **students** surface (shared contracts/validation, backend routes/use-cases/SQL,
frontend feature/report code) on the current tree (`HEAD a51ae8bd5` plus the uncommitted review fixes). The
deliverable is the **summary table** requested (Target File · Item/Import to Remove · Reason), the applied
within-file cleanup diffs, and the candidate lists that need confirmation. **No file and no export definition
was deleted**; file-level deletions remain proposals.

## 0. Scope, method, and safeguards

| Check | How | Result |
| --- | --- | --- |
| Unused imports/locals/params | `tsc --noUnusedLocals --noUnusedParameters` for frontend, backend, shared; filtered to students paths | 50 findings → **0 remaining** (47 test files + 2 components + 1 parameter cleaned) |
| Exported symbols | `export function/const/class/interface/type/enum` extraction + repo-wide reference counts bucketed into production / test / same-file | 165 files · 443 exports · **101 candidates** (10 unreferenced, 17 test-only, 74 file-local) |
| Orphaned files | Import-graph resolution (`from`, `import()`, `require()`, `vi.mock()`) with alias handling (`@/`, `@mms/shared`, `@shared/ui`), 174 module files | **0 zero-reference files, 0 test-only files** |
| Orphaned assets | Filename reference scan across `apps/`, `packages/`, `e2e/`, `docs/` (8 assets) | **0 orphaned** — `public/icon-512.png` is referenced by `site.webmanifest` + Workbox precache |
| Unused dependencies | Direct deps of `apps/backend`, `apps/frontend`, `packages/shared`, `packages/ui`; quoted specifier scan + config/manifest check | 7 without a textual consumer, **all justified** → **0 actionable** |
| Dynamic-import / reflection safeguards | Verified lazy route loaders, `vi.mock`, worker runners, legacy migration loader, PWA manifest; no variable/reflection imports in the module | No candidate relies on a missed dynamic import (examples in §3) |

Concurrent-process note: unrelated files (dashboards, messaging, contacts, i18n, `index.css`) were being
edited throughout. The students suite was rerun after the cleanup and is green.

## 1. Applied within-file cleanup (safe, verified)

### Summary table

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| 47 students test files (`*.test.tsx` under `tenant/features/students/**`) | `import React from "react";` (42 files) and the unused `React` default in `import React, { act } …` (5 files) | TypeScript `TS6133`: unused under the automatic JSX runtime. Named imports (`act`, etc.) preserved |
| `components/StudentIdCardModal.tsx` | unused `React` default import | `TS6133`; JSX runtime does not need it (`import { useRef, useState, lazy, Suspense, type JSX }` kept) |
| `components/card-template/StudentIdCardPrintControlsBar.tsx` | unused `React` default import | `TS6133`; named `type JSX, useMemo` kept |
| `lib/studentCardPresetBadge.ts` | `branding` parameter renamed to `_branding` | `TS6133` (unused parameter). The value is meaningful to sibling presets, so the shared preset signature is preserved rather than changing the API |

### Representative diffs

```diff
--- a/apps/frontend/src/tenant/features/students/components/StudentArchivedBanner.test.tsx
+++ b/apps/frontend/src/tenant/features/students/components/StudentArchivedBanner.test.tsx
@@
-import React from "react";
 import { describe, expect, it, vi } from "vitest";
```

```diff
--- a/apps/frontend/src/tenant/features/students/hooks/useStudentsQueries.test.tsx
+++ b/apps/frontend/src/tenant/features/students/hooks/useStudentsQueries.test.tsx
@@
-import React, { act } from "react";
+import { act } from "react";
```

```diff
--- a/apps/frontend/src/tenant/features/students/components/StudentIdCardModal.tsx
+++ b/apps/frontend/src/tenant/features/students/components/StudentIdCardModal.tsx
@@
-import React, { useRef, useState, lazy, Suspense, type JSX } from "react";
+import { useRef, useState, lazy, Suspense, type JSX } from "react";
```

```diff
--- a/apps/frontend/src/tenant/features/students/lib/studentCardPresetBadge.ts
+++ b/apps/frontend/src/tenant/features/students/lib/studentCardPresetBadge.ts
@@
 export function getVerticalBadgeTemplate(
-  branding?: BrandingInfo,
+  _branding?: BrandingInfo,
   madrasaName = "Madrasa Management System",
 ): StudentCardTemplate {
```

**Verification after cleanup**

| Check | Result |
| --- | --- |
| `tsc --noUnusedLocals --noUnusedParameters` (frontend, students filter) | **0 findings** |
| Cold `tsc -p apps/frontend/tsconfig.json` | **pass** |
| `pnpm --filter mms-frontend test src/tenant/features/students` | **67 files / 219 tests pass** |
| ESLint on `tenant/features/students` | **0 problems** (a rules-of-hooks error introduced by an earlier test mock was fixed by naming the component) |
| `check-code-norms`, `check-frontend-structure`, `check-shared-ui` | **pass** |

## 2. Orphaned files and assets — candidates for confirmation

**No orphaned file or asset was found.** Details that matter for the “do not delete” safeguard:

| Path | Status | Reason |
| --- | --- | --- |
| `apps/backend/src/db/migrations/009_seed_demo_students.ts`, `014_seed_student_config.ts`, `022_migrate_students_to_tables.ts` | **Not orphaned** | Loaded through **dynamic `import()`** in `db/dataMigrationsBatch1.ts:46,67,102`; a naive import scan would flag them |
| `apps/frontend/src/tenant/features/students/StudentsPage.tsx` | **Not orphaned** | Lazy route loader `lib/routing/moduleRegistry.ts:164` |
| `apps/backend/src/students/studentsImportService.ts` | **Not orphaned** | Worker runner registration (`services/backgroundJobRunnerService.ts`) plus `students:import` job runner |
| `apps/frontend/public/icon-512.png` | **Not orphaned** | Referenced by `public/site.webmanifest` and the Workbox precache manifest; it has no TS import |
| `apps/backend/src/scripts/seed-20-students.ts` | **No code importer** | Manual `tsx` script; referenced only by `docs/a11y-baseline.md`, no npm alias. Candidate: keep and add a `seed:students` script/README note — **not** a deletion candidate |
| `components/StudentFormValidationScroll.test.tsx` | **Not orphaned, misnamed** | The component is gone, but the test still covers `runStudentSaveFlow`; rename candidate (no deletion) |

## 3. Exported-symbol candidates (not removed — need confirmation)

Reference scan: production consumers / tests / same-file only. Barrel re-exports are counted as consumers, so
“test-only” below means **no production code outside the barrel** reaches it.

### 3.1 Unreferenced (0 references anywhere) — 10

| Target File | Item to Remove | Reason |
| --- | --- | --- |
| `packages/shared/src/students/studentDirectoryColumns.ts` | `StudentDirectoryColumnKey`, `StudentWorkColumnKey`, `studentWorkColumnLabelsFrom`, `isStudentSortField` | No reference in any app/package/test. (`isStudentSortField` becomes used if the backend adopts the shared sort SSOT — recommended in the whole-module review R7) |
| `packages/shared/src/students/studentFieldDependencies.ts` | `isStudentSeedFieldKey` | No reference |
| `packages/shared/src/students/studentLookupTypes.ts` | `StudentLookupStringKind` | Obsolete type after the lookup tightening |
| `packages/shared/src/students/studentsListQuery.ts` | `StudentsNextGrNumberQuery` | No reference |
| `apps/frontend/src/tenant/features/students/components/StudentDetail.tsx` | `StudentDrawer` export | Component is consumed through the module’s default export; the named export is unreferenced |
| `apps/frontend/src/tenant/features/students/hooks/studentSetupConfigApi.ts` | `getStudentSettingsMemoryFallback` | No reference |
| `apps/frontend/src/tenant/features/students/lib/studentCardTemplateTypes.ts` | `StudentCardFieldDefinition` | No reference |

### 3.2 Test-only implementations — 17 (shadow-logic risk)

| Group | Symbols | Reason / action |
| --- | --- | --- |
| Shadow domain logic (barrel-exported via `entry/indexDomainsAcademic.ts:78,84,126`) | `studentRegistrationUtils.findStudentRegistrationConflict`, `backfillMissingStudentGrNumbers`, `collectStudentLinkedContactIds`; `studentsWidgetAggregate.computeStudentsWidgetAggregate` | Duplicate the backend SQL/use-case behaviour and are only exercised by their own tests — divergence trap. Confirm no external consumer, then delete implementation + tests |
| Removed-UI leftovers | `studentFieldDependencies.getStudentFieldRemovalIssues`, `studentSetupConfigTypes.mergeStudentsFormTabsFromApi`, `StudentsListDesktopTableSimpleCells.renderStudentSessionsCell` | The Fields/Tabs editing surface they served is not rendered |
| Lookup/validation helpers | `isStudentLookupKind`, `isStudentLookupLegacyCollectionKey`, `listStudentSystemFormFieldKeys`, `isStudentSystemFormField`, `hasResponsibleAdultLink`, `pickPrimaryResponsibleAdult`, `deriveStudentGuardiansFromContact`, `formatStudentNameWithParents`, `studentsModuleManifest.studentListSchema`, backend `studentLookupsService.loadStudentLookupKind` | Only tests reference them; either keep as tested helpers or delete both |

### 3.3 File-local exports — 74 (cosmetic, zero runtime risk)

45 are `*Props` interfaces (`StudentsListProps`, `StudentFormProps`, `StudentDetail*Props`, …); the rest are
internal constants/helpers (`STUDENT_SERVER_OWNED_AUDIT_KEYS`, `STUDENT_GUARDIAN_LINK_FIELDS`,
`computeNextGrNumberBatchForDate`, `studentCreateGuard` types, `resolveStudentErrorTab`,
`useStudentPreferencesQuery`, `StudentsPageTabPanelProps`, `BuildStudentsWorkSourceParams`).
**Action:** drop the `export` keyword where the symbol is truly file-local — do not delete the declarations.

### 3.4 Dead factories / obsolete artifacts

| Target File | Item | Reason |
| --- | --- | --- |
| `hooks/useStudentsQueries.ts` | `studentsListQueryOptions` | Exported through `tenant/hooks/collections/students.ts` and tests only; no runtime caller |
| `hooks/useStudentsAnalyticsQueries.ts` | `studentsCommandMetricsQueryOptions` | Same — `useStudentsMetrics` uses `useServerMetrics` directly |
| `components/StudentFormValidationScroll.test.tsx` | file name | Stale name for a `runStudentSaveFlow` test; rename |

## 4. Unused dependencies — candidates

| Package | Dependency | Verdict | Evidence |
| --- | --- | --- | --- |
| `apps/backend` | `@types/nodemailer`, `@types/pg`, `@types/ws` | **Keep** | Type-only packages resolved by TypeScript, never imported textually |
| `apps/frontend` | `@types/react`, `@types/react-dom` | **Keep** | Type-only |
| `apps/frontend` | `oxc-transform-react` | **Keep** | Vite React-Compiler option and pnpm overrides (`vite.config.ts:30`, `pnpm-workspace.yaml:41-42`); used through the plugin pipeline, not a direct `import` |
| `apps/frontend` | `postcss` | **Keep** | `apps/frontend/postcss.config.js` |

**No actionable unused dependency** in the module’s packages. (A repo-root devDependency reconciliation would
need a separate tool-driven pass and is out of scope here.)

## 5. Confirmation checklist

Nothing below has been deleted; approve each group explicitly if you want the cleanup applied:

1. **Unreferenced exports (§3.1)** — remove the 10 declarations/exports (tests unaffected except types).
2. **Test-only shadow implementations (§3.2)** — delete implementation + its tests, or keep both; the
   shadow-logic group is the higher-value removal.
3. **File-local exports (§3.3)** — allowed to drop `export` keywords across 74 symbols.
4. **Dead factories (§3.4)** — remove `studentsListQueryOptions` / `studentsCommandMetricsQueryOptions` and
   their test expectations; rename the stale test file.
5. **No file/asset deletions** are proposed; the legacy migrations and `icon-512.png` are explicitly
   protected by dynamic imports/manifests.

## 6. Method limits

- Reference counting is textual/identifier-based; dynamic imports, barrel `export *` chains, and external
  consumers are treated as consumers, which biases the result toward **false negatives** (safe).
- No reflection/DI registry was found in the module; if one is added later, re-run the scan.
- axe/Playwright were not run (not relevant to import deletion); the students suite, cold typecheck, eslint
  and structural gates are the evidence for this pass.
