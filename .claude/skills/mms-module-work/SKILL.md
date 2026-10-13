---
name: mms-module-work
description: Implements or reviews MMS module command centres and Work tabs — metrics, directories, drawers, bulk actions, soft-delete trash, column prefs. Use when changing PageHeader command centre, Work directory, trash/restore, bulk actions, detail drawers, filters, or mobile cards. Do NOT use for top-level 3-tier module shells (use mms-module-page), module preferences configuration (use mms-module-setup), or analytical report charts (use mms-reports-export).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-04
---

# MMS Module Work Workflow

**Rules (norms SSOT):** `mms-module-architecture.md` §2–§3, §6–§7 · `mms-data-layer.md` §6 · `mms-ui-ux-design.md` §4, §8 · `mms-performance.md`. Soft-delete lifecycle detail → `mms-soft-delete`.

## When to use

- Changing Work-tier directories, filters, drawers, bulk bars, or command metrics
- Wiring trash/restore UX on a module Work tab
- Aligning table/card chrome to `DataTable` / `WorkBatchTable` / column layout hooks

## 1. Work Architecture & Command Center

- **Scope Boundary**: Work tier contains directories, CRUD, drawers, filters, and bulk actions. Zero analytical charts (belong in Reports).
- **PageHeader & Metrics**: Keep `PageHeader` visible; render command metrics using `ModuleCommandMetricsGrid`.
- **Dual IO (header + panel)**: Keep Create/Import/Export on `PageHeader` actions. Mount `ModuleEntityIoToolbar` as a separate row above Work directory chrome on every operational Work/peer-entity tab. Omit on Reports/Setup; hide in trash. Do not also put Add in `ModuleWorkToolbar.primaryAction`.
- **Filters SSOT**: Single filter menu via `ModuleFilterDropdown` / `ModuleFiltersMenuButton`. Active state indicated by count badge + Clear CTA; never duplicate active filters in a permanent pill bar.
- **Selection SSOT**: Page controller owns row selection via `useWorkSelection`; list-local selection state is banned.
- **Virtualization**: Mandatory `@tanstack/react-virtual` row virtualization whenever collection items > 30.
- **Data Transfer & Import/Export**: Form module CSV import dialogs wrap `ModuleImportDialog` via `useModuleCsvImportActions` consuming the module's SSOT `ModuleTransferSchema` from `@mms/shared`. Exports enforce Field Whitelist metadata stripping and 1:1 bidirectional header symmetry.

## 2. Implementation map

| Concern | Path / symbol |
|---------|----------------|
| Tables | `apps/frontend/src/components/common/data-table/DataTable.tsx`, `.../work/WorkBatchTable.tsx` |
| Column layout | `useModuleColumnLayout` |
| Cards | `DirectoryEntityCard`, `DirectoryCardFooterActions`, `DirectoryCardMetaGrid` |
| Card actions | `useWorkCardAction` |
| Toolbar / trash | `ModuleWorkToolbar`, `ModuleTrashToggle` |
| Panel IO row | `ModuleEntityIoToolbar` (Export / Import / Add; Faculty wraps via `FacultyTabIoToolbar`) |
| Data Transfer / Import | `ModuleImportDialog`, `useModuleCsvImportActions`, `ModuleTransferSchema` (`@mms/shared`) |
| Data Transfer / Export | `useModuleServerCsvExportActions`, `buildExportGrid`, `runGridCsvExportJob` |
| Bulk | `ModuleUniversalBulkActionBar`, `ModuleWorkBulkActionBar`, `BulkSelectionDeleteAction`, `BulkSelectionRestoreAction` |
| Archive chrome | `@/components/app/DetailDrawerArchiveChrome` (`EntityArchivedBanner`, `DetailDrawerArchivedBanner`) |

## 3. Soft-Delete Trash & Bulk Operations

- Bind trash mode to `?view=trash`; preserve filters/search when toggling `ModuleTrashToggle` in `ModuleWorkToolbar`.
- Hide Create/Add and Export in trash mode; guard `Cmd/Ctrl+N`.
- Archived drawers: archive banner + Restore; hide Edit/communication CTAs (full lifecycle → `mms-soft-delete`).
- Two-layer bulk chrome: `ModuleUniversalBulkActionBar` over `ModuleWorkBulkActionBar`. Never fork adapters or duplicate selection hooks.

## 4. Verification

```bash
pnpm --filter mms-frontend typecheck && pnpm --filter mms-frontend lint
# When directory chrome / WorkBatchTable consumers change:
pnpm run check:work-directory
```

## Related skills

`mms-module-page`, `mms-soft-delete`, `mms-query-factories`, `ui-ux-pro-max`.
