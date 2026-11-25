# `@mms/mod-accounting`

Accounting vertical module: ledger, chart of accounts, journal entries, fiscal
years, posting periods, voucher numbering, banking, FX, hedges, IAS 29, reports,
accounting jobs and platform consolidation.

## Public API

| Subpath                                 | Audience         | Contents                                             |
| --------------------------------------- | ---------------- | ---------------------------------------------------- |
| `@mms/mod-accounting/shared`            | FE + BE          | contracts re-exports, accounting policy/state guards |
| `@mms/mod-accounting/backend/tenant`    | API only         | `tenantAccountingRoutes`, `createAccountingService`  |
| `@mms/mod-accounting/backend/platform`  | API only         | `platformAccountingRoutes` (consolidation)           |
| `@mms/mod-accounting/frontend/tenant`   | tenant console   | accounting data/types, pure libs, page/widgets       |
| `@mms/mod-accounting/frontend/platform` | platform console | consolidation page/widgets                           |

No root export; backend/shared are Node ESM `dist`, frontend subpaths are source.

## Current slice

The module currently owns the accounting shared policy, the pure accounting
frontend data/lib layer, module backend service/ports and route plugins for the
core account/entry/period/report/consolidation paths. The legacy
`apps/api/src/accounting/**` and `apps/frontend/src/tenant/features/accounting/**`
surfaces remain the active app implementation while the full repository/route/UI
extraction is completed in follow-up waves. App consumers use
`@mms/mod-accounting/frontend/tenant` for the moved pure helpers.

## Verification

```bash
pnpm --filter @mms/mod-accounting build typecheck lint test
pnpm turbo build typecheck lint test --filter=@mms/mod-accounting...
pnpm run check:module-boundaries
node --test scripts/ci/module-audience-boundaries.test.mjs
```

## Migration status

- Accounting repository family (47 `db/repositories/accounting*` files plus their generic repository/cache helpers) now lives in `src/backend/repository`. The app files at the old paths are temporary re-export facades; consumers will be switched to the module APIs before those shims are removed.
- `accountingVoucherPeriod` and its test moved with the repository family.
- Accounting use-cases and ledger-posting orchestration now live in `src/backend/use-cases` and `src/backend/ledgerPosting`; app files at the old paths are temporary re-export facades.
- Accounting routes, job runners, the tenant feature UI and the platform consolidation feature still live in the app.
- Cross-domain use-cases (`processSpecializedEntryUseCase`, `accountingReportPdfUseCases`, obligation posting) and app-only obligation ledger helpers remain app-side until their ports are introduced.

## Platform consolidation

The consolidation repository, use-case and `/api/platform/consolidation/*` route now live in the module (`src/backend/repository/platformConsolidation*`, `src/backend/use-cases/consolidationUseCases.ts`, `src/backend/routes/platformConsolidation.ts`). The app mounts the module route behind `authenticatePlatform` + `workspaces` permission. Platform consolidation UI still lives in the app.

## Service layer

`accountingService`, `accountingConfigService` and `accountingPreferencesService` now live in `src/backend/services`; app files are re-export facades. Export streaming and background-job runner registration still depend on app job infrastructure and remain app-side.

## Contract and report routes

The ts-rest accounting contract router, report-PDF/ledger-export handlers and the queue enqueue helpers now live in `src/backend/routes`. Background queue access is injected through `configureAccountingJobEnqueuer`, wired by the app accounting aggregator to the existing worker service. The setup/export routes and specialized-entry route remain app-side.

## Export service

`accountingExportService` and the generic CSV/XLSX export helpers now live in `src/backend/services` and `@mms/be-core/jobs/exports`. Background-job runner registration and artifact persistence remain app-side.

## Background runners

Chart import/export and report-PDF runner registration plus the import implementation now live in `src/backend/jobs`. The app supplies queue/artifact/PDF worker dependencies through `configureAccountingRunnerDeps`; `apps/api/src/services/backgroundJobAccountingRunners.ts` is the composition wrapper.

## Setup and specialized routes

The accounting setup field-config/preferences route, specialized-entry route and report-PDF use-case now live in the module. The app finance service is injected through `configureAccountingFinancePort`; the queue/PDF dependencies through `configureAccountingRunnerDeps`. Only the CSV export/import route and the app route aggregator remain app-side.

## Route completeness

All accounting tenant routes are module-owned now: the aggregator, setup config, contract/report docs, CSV export/import and specialized-entry routes live in `src/backend/routes`. The app only composes finance/queue/export-registrar ports and mounts `tenantAccountingRoutes` behind tenant auth + module access. The platform consolidation route is also module-owned.

## DB-integration tests

The 29 accounting DB-integration suites now live in `src/backend/__tests__/db-integration` with a module `test:db` script. DB manifest/hygiene gates scan both the app and module roots. Running the suite requires a reachable PostgreSQL; without one it fails loudly by design.

## Frontend foundation

`@mms/fe-core/i18n` now owns the translation context, provider and `useTranslation` hook, with the app computing and supplying the value. Ten accounting-shared components (page header actions, FX guide step, payment voucher print, simple-transaction header/footer/steps/amount input/tag selector, journal tags section, chart type counts) and the journal-list shared helpers now live in `src/frontend/tenant`; the rest of the tenant accounting feature still lives in the app. Accounting feature imports of already-shared UI primitives were rewritten to `@mms/ui` / `@mms/ui/app/*`. All legacy app accounting route facade files were deleted.

## Frontend hooks

The voucher-numbering query/mutation hook, accounting query-key registry and accounting-navigation context/hook implementations moved into `src/frontend/tenant/hooks`; the app files at the legacy paths are thin re-export facades so existing consumers and test mocks keep working. `useVoucherNumberingSettings` remains app-side because its tests depend on the app hook seam.

## Fe import cleanup

Accounting feature imports of translation, notification, API client, query, form helpers, work-directory view mode, UI primitives and form-style tokens now point at `@mms/fe-core/*` or `@mms/ui`. Only app-specific composites (`components/app`, `components/common`, reports, currency/auth contexts) remain app-bound.

## Shared wrappers

`FormSelect`, `StatusBadge`, `ErrorState` and `ConfirmAlertDialog` implementations moved to `@mms/fe-core/components/*`; app paths are facades. `StatGrid` moved to `@mms/ui/app/StatGrid`. Accounting now imports these shared implementations directly.

## Form primitives

`FormSelectWithQuickCreate` moved to `@mms/fe-core/components`; `FormCollectionShell` and `FormAddAnotherButton` moved to `@mms/ui/app`. Accounting no longer imports the app `FormPrimitives` barrel, and the barrel remains for other app consumers. `DatePicker` remains app-side for its test/context seam.

## Module shell components

`ModuleSetupSaveFooter` and `useUnsavedChangesGuard` moved to `@mms/fe-core`; `ModuleFiltersMenuButton` and `moduleFilterGroups` moved to `@mms/ui/app`. Legacy app paths remain facades.

## Additional shared moves

`FormListFieldCard` moved to `@mms/fe-core/components`; the semantic tone/avatar/card accent token modules moved to `@mms/fe-core/ui/*`; `ListPagination` moved to `@mms/fe-core/components`. Legacy app paths remain facades.

## Tabs and scroll hooks

`SubTabBar`, its badge/variant/accordion implementations, `useDragScroll`, `useScrollSurfaceOnChange` and `scrollDocumentToTop` moved to `@mms/ui/app`. `useReducedMotion` moved to `@mms/ui/app`, with fe-core re-exporting it. Legacy app paths remain facades.

## Stat cards

`StatCard`, `StatCardTrend`, `statCardAccent` and `ModuleCommandMetricsGrid` moved to `@mms/fe-core/components`; app paths remain facades. They use fe-core semantic tokens and the shared UI sparkline.

## Modal stack

`FormModal`, `Modal`, `OverlayShell`, modal header/tabs/footer/error/progress, `useFormModalLayout` and `useDomFormProgress` moved to `@mms/fe-core/components`. Overlay behavior/focus-trap/scroll-lock hooks and the overlay stack moved to `@mms/fe-core/hooks`. App paths remain facades.

## Small shared components

`ModuleTierMotion` moved to `@mms/ui/app`; `ModulePanelSuspenseFallback`, `ErrorBoundary`, `DetailAttributeRow` and `FilterChips` moved to `@mms/fe-core/components`. App paths remain facades.

## Directory cards

`ModuleDirectoryCards`, `DirectoryCardsSelectAllBar`, the shared motion variants and `DirectoryCardMetaTile` moved to `@mms/fe-core/components` / `@mms/ui/app`. App paths remain facades.

## Table and detail primitives

`ResizableTableHead`, `ModuleTableHeaderCell`, `DetailSectionCard` and the directory-card stack moved to `@mms/fe-core/components`; `DetailSectionTitle` moved to `@mms/ui/app`. Their tests moved with the Resizable/TableHeader implementations.

## Final small moves

`DocumentCurrencyFields` and `ModuleTrashConfirmDialogs` moved to `@mms/fe-core/components`; `ModuleSetupContent` moved to `@mms/ui/app`. App paths remain facades.

## Tenant component batch

Fifteen previously app-bound tenant components plus `useJournalLineAssist` and the journal controller handlers moved into `src/frontend/tenant` once their shared dependencies were available: dashboard, date/filter bars, advanced filters, hedge modals, settings posting/rules/templates sections, mobile line editor, line row, recent-entry card, simple-transaction account legs/posting cards, and journal controller selection.

## Dashboard widgets

`AccountingDashboardCharts` and `AccountingDashboardSnapshots` moved into `src/frontend/tenant`; the dashboard chart test moved with them. Their local breakdown/balance-sheet types now live in the module.

## Hook and filter moves

`useDebounce` moved to `@mms/fe-core/hooks`; `useAccountQuickCreate`, `useJournalEntriesFilterBridge`, `useJournalEntriesUiState`, `useJournalReverseDialogState`, `useSimpleTransactionDraft` and the journal-controller filter helpers moved into the module. App paths remain facades.

## Entity card foundation

`BiDiText`, `DirectoryCardMetaGrid`, `DirectoryCardViewButton`, `DirectoryCardHeader`, `UserAvatar`, `genderUi` and `EntityCard` moved to `@mms/ui/app` / `@mms/fe-core/components`. Header/meta-grid tests moved to UI; app paths remain facades.

## Platform consolidation start

`ConsolidationMemberRow` moved to `src/frontend/platform/components` with a module-local member draft type; it uses shared Field/FormSelect components. `EntityCard` and its header/meta/avatar foundation moved to shared fe-core/UI packages.

## Platform draft hook

`useConsolidationGroupDraft` and its `MemberDraft` type moved into `src/frontend/platform/hooks`; `ConsolidationMemberRow` now imports that type. The app hook path is a facade.

## File drop zone

`DashedFileDropZone` moved to `@mms/ui/app`; the app path is a facade. Bulk-selection and module-import-dialog moves were attempted and reverted after their translation/test seams proved app-coupled.

## Import dialog

`ModuleImportDialog` moved to `@mms/fe-core/components`; 9 CSV-dialog test suites now mock the fe-core i18n seam alongside the app one. `DashedFileDropZone` remains a shared UI dependency.

## Work-card action hook

`useWorkCardAction` moved to `@mms/fe-core/hooks`; its 21 tests pass against the app facade. A detail-drawer family move was attempted and reverted after fe-core self-import resolution issues; the app implementation/tests were restored.

## Entity-card metadata

Entity descriptor types, module-column customizer types, `DirectoryCardFooterActions` and `DirectoryCardMetadata` moved to `@mms/fe-core/components`. A configurable `entityDescriptorResolver` lets fe-core metadata resolve app-registered descriptors without importing the app entity registry. Legacy app paths remain facades; accounting type imports now point at fe-core.

## Entity card and contact actions

Contact action components, contact-phone helpers, `DirectoryCardInfoPills`, `DirectoryEntityCard`, entity/column-customizer types, `DirectoryCardFooterActions` and `DirectoryCardMetadata` moved to `@mms/fe-core/components`. The app entity registry registers an fe-core descriptor resolver. `ChartOfAccountsTreeRows` and `JournalEntryCard` then moved into the accounting module.

## Editable multi-select

The `EditableMultiSelect` family (main component, add bar, parts, option item, search bar) moved to `@mms/fe-core/components`; `contactOptionI18n` moved alongside it. App paths remain facades and accounting now uses the fe-core component.

## Responsive tabs

`ResponsiveAccordionTabs`, its desktop/trigger variants and types moved to `@mms/fe-core/components`; `useSafeViewTransition` moved to fe-core hooks. Fe-core now depends on react-router-dom for the tab links, and its tests moved with the components.

## CSV import infrastructure

The background CSV job chain (store, polling, server start, import actions) and `StandardModuleCsvImportDialog` moved to `@mms/fe-core`. Fe-core vitest aliases now cover the client/download/notify and background-job subpaths. All 15 module CSV-dialog suites were updated to mock the shared seams.

## Bulk actions and ledger table

`BulkActionDock`, `ModuleWorkBulkActionBar`, `BulkSelectionBar`, `BulkSelectionActions` and `BulkSelectionStatusAction` moved to shared fe-core/UI, with tests moved alongside. `FinancialLedgerTable` was rewritten on shared UI table primitives and moved to fe-core, removing its WorkBatchTable dependency.

## Report export

`reportExportCore`, `reportExportPdf`, CSV job runners, `ExportToolbar`, `ExportToolbarCompact`, `ExportPdfSettingsPopover` and `exportToolbarUtils` moved to `@mms/fe-core` (reporting/backgroundJobs/components). Fe-core gained the report export test and the required xlsx/jspdf dependencies.

## Shell and toolbar

`AppPageShell`, `ModuleScaffold`, `ModulePageShell`, `ModuleColumnCustomizer`, `ModuleColumnCustomizerList`, `SearchBar`, `WorkViewModeToggle`, `ModuleWorkToolbar`, `ModuleClearFiltersButton` and `ModuleTrashToggle` moved to shared fe-core/UI packages with their tests. Accounting now has a single remaining app-component import: `DocumentTemplateEditor`.

## Report/voucher libs

`financialReportsExportHelpers`, `paymentVoucherKind`, `journalEntriesTypes` and `paymentVoucherModel` moved into the module lib; app paths are facades.

## Accounting data hooks

The query/mutation layer moved into the module: list fetch, accounting queries, module invalidator, mutations, general-ledger, FX/hedges hooks, and the public `useAccountingApi` barrel. Shared query helpers and `useServerMetrics` moved to fe-core. Accounting bulk actions, CSV import, chart filters, posting table and transaction review are module-owned; `DocumentTemplateEditor` is the last app component import.

## Shared contexts

Accounting production code now imports `TranslationContext`/`TranslationFunction` from `@mms/fe-core/i18n` and `AuthContext` from `@mms/fe-core/auth/AuthContext`; accounting tests mock those shared modules. Setup-config API, ledger operations and journal reversal hooks moved into the module.

## Currency and setup hooks

`useAccountingCurrency`, `useAccountingSetupConfig`, `GeneralLedgerAccountSummary`, `AccountingSettingsCurrencySection`, `AccountingCommandMetrics` and `AccountingSettingsPostingSection` moved into the module. `createModuleSetupConfigHooks` moved to fe-core. App accounting production imports resolve currency through the app facade; moved sections import the module root.

## Shared WorkTable stack

The full `WorkBatchTable` stack, table header/selection cells, sticky styling, report-money cards and their hooks moved to `@mms/fe-core`/`@mms/ui`, keeping app paths as facades. `GeneralLedgerCardsView` moved into the module and accounting report imports now consume the shared report-money components directly.

## Report and ledger views

`FinancialReportSection`, `CashFlowStatementPanel`, `FinancialStatementPanels`, `GeneralLedgerEntries`, `TrialBalance`, `TrialBalanceTypeGroup`, `JournalEntryDetail`, `JournalEntryDetailLines` and `JournalQuickActionsPanel` moved into the module with their tests. They consume the shared WorkBatchTable/report-money primitives and module-local currency hook.

## Shared blockers (batch 1)

Moved to fe-core: `formatDirectoryPageCountLabel`, `useWorkSelection`, `useModuleSetupSubTabs`, `useTemplateDraftGuard`, `useModuleColumnLayout`, `FinancialDebitCreditTableChrome`, `RouteStatusFallback`, `TranslatedFormMessage` (with app facades).
