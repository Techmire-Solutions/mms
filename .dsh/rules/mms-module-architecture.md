---
trigger: model_decision
description: Universal module architecture, page tabs (operational + required Reports/Setup), manifests, and soft-delete integration
---

# MMS Universal Module Architecture

**Workflow skills:** new page → `mms-module-page` · Work/trash → `mms-module-work` · Setup → `mms-module-setup` · jobs → `mms-background-jobs` · Reports → `mms-reports-export` · write forms → `mms-form-architecture` · design intelligence → `ui-ux-pro-max`.

## 0. Surface triad (page vs form vs directory)
- **Work directory:** `DataTable` / `WorkBatchTable` + cards via `mms-module-work` — list/search/bulk only.
- **Read detail:** `DetailSheet` / `DetailDrawerShell` — inspection, archive, quick actions; never embed edit forms.
- **Write:** `FormModal` (+ form primitives) — create/edit/builder only; repeatable rows and catalog selects follow `mms-form-architecture.md` (control decision table, `FormCollectionShell` / `FormListFieldCard` / `FormCardTypeSelect`).

## 1. Monorepo Manifests & Domain Modeling
- **Single Manifest SSOT:** Declare a single manifest in `packages/shared/src/*ModuleManifest.ts` defining `moduleId`, entity types, collection/REST keys, default filters, searchable/filterable fields, `setupSubTabs`, and `softDelete` policies.
- **Zero Hardcoding:** UI controls, column registries, query keys, layout hooks, and export services import directly from manifest constants; hardcoded entity configurations are banned.

## 2. Page Shell & Tab Layout
- **Required anchors:** Every tenant module page includes **Reports** and **Setup**, gated via `useModulePermissions(manifest)` (`canViewReports` / `canViewSetup` / `canEditSetup`). Unauthorized anchors are omitted from the DOM.
- **Operational tabs:** ≥1 primary operational surface (daily records, search, filters, views, drawers, bulk actions). Modules may add more peer operational tabs for day-to-day entities (Faculty: Faculties | Departments | Designations). Ban charts and KPI dashboards on operational tabs.
- **Primary tab label:** Module name via `nav.{moduleId}` (or a dedicated entity tab key such as `faculty.tabs.faculties`) — never the generic `module.work` product label, and never industry `staffSingular` for the tab.
- **Internal id:** Standard single-ops modules keep persisted id `"work"` for URL/prefs compat; multi-ops modules use entity ids and migrate legacy `"work"` on read.
- **Order:** operational tab(s) → Reports → Setup.
- **Shell wiring:** `PageHeader` command centre + `useFilteredModuleTierTabs({ canViewSetup, canViewReports, workLabelKey })` for standard modules; multi-ops pages build peer tabs explicitly (Faculty pattern).
- **Dual IO placement:** Keep Create/Import/Export on `PageHeader` actions. Also mount `ModuleEntityIoToolbar` (Export / Import / Add) as a **separate row** at the top of every **operational** Work or peer-entity tab panel. Omit the IO row on Reports and Setup. Hide the entire IO row in trash (`viewingDeleted`). Capability-shape buttons (`canExport`/`canWrite` + handlers). Do not put Create/Add in `ModuleWorkToolbar.primaryAction` when the IO row already owns Add.
- **Setup content:** Fields customizer, Preferences, and other `setupSubTabs` only — not day-to-day peer catalogs unless they are truly rare lookups.

## 3. Work Directory & Detail Drawer
- **Filters UI SSOT:** Single Filters dropdown owns Work dimensions (presets, status, sort). Duplicate preset pill bars are banned (`ContactsFilterMenuButton` gold standard). `FilterChips` render active removable selections only.
- **Directory View Mode SSOT:** Single `viewMode` (`table` | `cards`) via `useWorkDirectoryViewMode`. Person directories mandate `directoryViews: ['table','cards']` (never `list`). Default cards `< md`, table `md+`. Dual-rendering via CSS display utilities is banned.
- **Pagination & Virtualization:** Cards and table share identical server pagination. Virtualize DOM rows via `@tanstack/react-virtual` when rendered items > 30 (`mms-performance.md`). Command KPIs load via `/metrics` endpoint; never compute via client reduction.
- **Column Layout SSOT:** `useModuleColumnLayout` manages visibility and width. Persist via PUT `/column-preferences` and `localStorage` (`mms_{moduleId}_columns_{userId}`). Local device widths take precedence; debounce server updates. Pass `isColumnVisible` into table/cards; boolean flag bags (`show*`) are banned.
- **Detail Drawer:** `DetailDrawerShell` renders entity fields in tab/field registry order with enabled custom fields. In trash mode: display `WarningCallout` archive banner + Restore; hide Edit and communication CTAs. Touch targets enforce `min-h-11 min-w-11`.
- **Selection SSOT:** Selection state is owned by the page controller via shared `useWorkSelection`; list-local selection state is banned. Directory rows, select-all controls, bulk bars, and shortcuts bind to controller selection.
- **Two-Layer Bulk Chrome:** Presentational `ModuleWorkBulkActionBar` dock with manifest/i18n adapter `ModuleUniversalBulkActionBar`. Mount floating or inline. Escape key clears selection. Never place bulk actions inline with toolbar filters.
- **Work UX invariants:** List failures render `ErrorState` with retry and the `loadFailedHint` description (never a bare title); empty directories use `EmptyState` with a required `title`; `Cmd/Ctrl+N` opens the create flow when `canWrite`; desktop tables use `WorkBatchTable`; cards use `DirectoryCard` + `useWorkCardAction` (DirectoryCard SSOT); `isColumnVisible` gates every column/card field.

## 4. Setup & Module Preferences
- **Dirty-Gated Persistence:** Draft preferences in local editor state; persist only on explicit Save when dirty. Do not mount Save button enabled by default.
- **Access Control:** Gate editing and Save mutations with `canEditSetup`; render read-only fallback when view-only.

## 5. Background Jobs & Processing
- **BullMQ Sandboxed Processing:** Long tasks (CSV import/export, bulk messaging, dedup scans, complex reports) offload to BullMQ worker process (`apps/backend/src/worker/index.ts`). Never run in the API request path.
- **Live Progress Tray:** Stream execution status via global `BackgroundJobsTray` (`running | completed | failed`, percentage progress, error counts, download artifacts).
- **Worker Job Contracts:** Jobs require idempotency keys, bounded retries with exponential backoff, execution-time tenant/user verification, and concurrency isolation. Auto-retrying message broadcasts or charging payments is banned.
- **Data Transfer Standard:** Module CSV imports and exports must use unified `@mms/shared` transfer schemas (`createModuleTransferSchema`, `ModuleImportDialog`, `useModuleCsvImportActions`, `useModuleServerCsvExportActions`). Field Whitelist stripping of system metadata (`id`, `tenantId`, `createdAt`, etc.) and 1:1 bidirectional header symmetry are strictly required.

## 6. Security Boundaries & Soft-Delete Standards
- **RLS & RBAC:** Enforce transaction-scoped RLS (`SET LOCAL app.current_tenant`) and `can('module.action')`. Omit unauthorized actions from DOM.
- **Manifest Soft-Delete Contract:** Declare `softDelete` configuration (`workExcludesDeleted`, `reportsIncludeDeleted`, `exportsIncludeDeleted`, `captureDeletionReason`, `retentionDays`).
- **Work Trash UX:** Archived records return 404 on active lookups. Synchronize trash mode via URL param `?view=trash` (`ModuleTrashToggle` in toolbar). Preserve active search and faceted filters. In trash: hide Create/Add, bulk delete, and communication CTAs; display Restore.
- **Optimistic Recovery:** Single-record deletions trigger optimistic cache hide + 5–10s Undo toast calling `POST /:id/restore`. Trap PostgreSQL 23505 unique constraint conflicts upon restore. Emit outbox CDC events (`entity.soft_deleted`, `entity.restored`).

## 7. Gold-standard parity (REST tenant modules and platform pages)
Align modules with **Contacts, Students, and Faculty**. Each area is owned by the cited section — verify the module against it instead of re-deriving the norm here:
- **Bulk PUT:** `mms-api-interface.md` §5.
- **Soft-delete lifecycle:** §6 · `mms-data-layer.md` §6 · `mms-api-interface.md` §7.
- **Mutations & modal close:** `mms-form-architecture.md` §2.
- **Setup tier:** §4.
- **Work UX (directory, drawer, IO row, view mode, selection, virtualization, column layout):** §2, §3, §8.
- **Manifest constants & permissions:** §1, §6.
- **i18n & RBAC:** `mms-settings-i18n.md` §4 · `mms-auth-security.md` §3.

## 8. Work Directory Governance
- **Work Directory Standards:** Enforce controller-owned selection (`useWorkSelection`), unified bulk bar (`ModuleUniversalBulkActionBar`), and single resolved `viewMode`. CI enforces zero regressions via `pnpm run check:work-directory`.
