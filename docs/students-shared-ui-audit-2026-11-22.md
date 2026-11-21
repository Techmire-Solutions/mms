# Students Shared-UI DRY & SSOT Audit — 2026-11-22

Read-only audit of every shared UI surface the Students module consumes, verifying **DRY** (no
students-local reimplementation of a shared primitive/composite) and **SSOT** (primitives imported from the
canonical `@shared/ui` source, `@/components/ui/*` facades are pure re-exports, style/status logic reuses
tokens). Working tree at `HEAD 2d3820dad` plus the uncommitted students remediation batches; the concurrent
contacts changes are out of scope.

**Verdict: compliant.** The governance gate is clean, no shared primitive is duplicated inside the Students
feature, and every module composite composes a shared component rather than reimplementing it. One cosmetic
stylistic note (§3) is reported, not fixed.

## 0. Scope, method, gate

| Check | Result |
| --- | --- |
| `node scripts/check-shared-ui.mjs` | **Clean** — 0 duplicate primitive files, 0 JSX in `components/ui/` facades, 0 orphaned imports, single table engine |
| Enumerated import paths | `tenant/features/students/**`, `lib/students`, `tenant/hooks/collections/students.ts` |
| Local-redefinition scan | grep for `function StatCard/EmptyState/DataTable/FormModal/DetailDrawerShell/BulkSelectionBar` under `tenant/features/students` → **0 hits** |

Consumption rules (Tenant console, per `mms-shared-ui` §2): import primitives from `@shared/ui` **or** via
`@/components/ui/*`; never from `@/platform/*`. Students complies.

## 1. Complete shared-component list

### 1.1 `@shared/ui` primitives (direct)

| Component | Files | DRY | SSOT |
| --- | --- | --- | --- |
| `Badge`, `CompactSegmentedControl`, `SectionCard`, `ToggleRow` | `StudentsRequiredFieldsSection.tsx` | ✓ (single import) | ✓ (canonical package) |

### 1.2 `@/components/ui/*` facades (re-export only)

| Facade | Import count | DRY | SSOT |
| --- | --- | --- | --- |
| `button` (`Button`) | 11 | ✓ | ✓ (typed re-export of `@shared/ui`) |
| `badge` (`Badge`) | 7 | ✓ | ✓ |
| `skeleton` | 1 | ✓ | ✓ |
| `formStyles` (theme tokens, non-component) | 1 | ✓ | ✓ (`packages/ui/src/theme`) |

### 1.3 `@/components/app/*` composites (≈50)

All are module-agnostic Tenant composites; each Students consumer composes them (see §2 map). Every row is
**DRY ✓ / SSOT ✓** unless noted.

`Alert`, `BulkSelectionBar`, `CompactSegmentedControl`, `ConfirmAlertDialog`, `ContactAction`,
`DetailAttributeRow`, `DetailDrawerArchiveChrome`, `DetailDrawerShell`, `DetailNotesBlock`,
`DetailSectionCard`, `DirectoryCardFooterActions`, `DirectoryCardMetadata`, `DirectoryEntityCard`,
`DrawerUpdatedStamp`, `EmptyState`, `EntityCard`, `entityCardChrome`, `EntityMessagingActions`,
`EntityNotesFormSection`, `ErrorBoundary`, `ErrorState`, `FilterChips`, `FormFooterChip`, `FormModal`,
`FormPrimitives`, `FormSelect`, `GenderIcon`, `LeadingIconInput`, `Modal`, `ModuleCommandMetricsGrid`,
`ModuleDirectoryCards`, `ModuleFiltersMenuButton`, `ModuleOverlayLoadingChrome`,
`ModulePanelSuspenseFallback`, `ModuleRowActionsMenu`, `ModuleSetupContent`, `ModuleSetupSaveFooter`,
`ModuleTableFooterCount`, `ModuleTierMotion`, `ModuleTierPage`, `ModuleTrashConfirmDialogs`,
`ModuleWorkDirectoryEmpty`, `ModuleWorkListStateShell`, `PersonDetailHeroCard`, `PersonIdentityMeta`,
`PersonMessagingRowActionsExtras`, `RegistryCustomFieldsGrid`, `SectionCard`, `SectionLabel`,
`SetupReadOnlyMessage`, `StandardModuleCsvImportDialog`, `StatusBadge`, `SubTabBar`, `TemplateEditor`,
`UserAvatar`.

### 1.4 `@/components/common/*` work/table plumbing

| Module | Import count | DRY | SSOT |
| --- | --- | --- | --- |
| `WorkBatchTable` (`@/components/common/work/WorkBatchTable`) | 1 | ✓ | ✓ (single sanctioned table engine) |
| `work` (directory index) | 1 | ✓ | ✓ |
| `useStaticEntityDescriptor` | 1 | ✓ | ✓ |
| `useDescriptorFilterChips` | 1 | ✓ | ✓ |
| `entityRegistry` / `entityRegistryTypes` | 1 + 3 | ✓ | ✓ |

## 2. Module-composite reuse map (evidence of DRY)

| Students file | Composes (shared) |
| --- | --- |
| `StudentsBulkActionBar.tsx` | `BulkSelectionBar`, `Button` |
| `StudentsRowActions.tsx` | `ModuleRowActionsMenu`, `PersonMessagingRowActionsExtras` |
| `StudentsListDesktopTable.tsx` | `WorkBatchTable`, `ModuleTableFooterCount` |
| `StudentsListCards.tsx` | `ModuleDirectoryCards` |
| `StudentsCsvImportDialog.tsx` | `StandardModuleCsvImportDialog` |
| `StudentIdCardModal.tsx` | `Modal`, `Button` |
| `StudentDetail.tsx` | `DetailDrawerShell`, `DrawerUpdatedStamp`, `DetailNotesBlock` |
| `StudentDetailHeroCard.tsx` | `PersonDetailHeroCard` |
| `StudentsCommandMetrics.tsx` | `ModuleCommandMetricsGrid`, `Button` |
| `StudentsFiltersMenuButton.tsx` | `ModuleFiltersMenuButton`, `GenderIcon` |
| `StudentsRequiredFieldsSection.tsx` | `Badge`, `CompactSegmentedControl`, `SectionCard`, `ToggleRow` (`@shared/ui`) |
| `lib/students/studentStatusUi.ts` | `createModuleStatusUi` + `SEMANTIC_BADGE` tokens (`resolveStudentStatuses` from `@mms/shared`) |

Status styling is the clearest SSOT proof: `studentStatusUi.ts` is a 30-line config over the shared
`createModuleStatusUi` factory and semantic badge tones — no status colours or labels are re-declared in the
feature.

## 3. Findings

1. **Cosmetic (no fix required):** `StudentsRequiredFieldsSection.tsx` imports primitives directly from
   `@shared/ui`, while every other Students file goes through the `@/components/ui/*` facade. Both are legal
   for Tenant; the mixed style is the only inconsistency in the module.
2. **No duplicates to remove:** no Students-local reimplementation of any shared primitive/composite; no
   orphaned UI import; the single sanctioned `WorkBatchTable` engine is used (no local `DataTable`).
3. **No SSOT violation:** facades are re-export only (gate-enforced), and `@/components/ui/formStyles` is
   the canonical theme source.

## 4. Verification

- `node scripts/check-shared-ui.mjs` → all checks pass.
- `pnpm --filter mms-frontend test src/tenant/features/students` → 72 files / 239 tests pass.
- `pnpm --filter mms-frontend typecheck` (cold) → pass.
- `check:frontend-structure`, `check:docs` → pass.
- No DB/E2E (no stack) — static audit only.

No production code was changed; this document and its `docs/README.md` index row are the only writes.
