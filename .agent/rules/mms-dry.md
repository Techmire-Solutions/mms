---
trigger: model_decision
description: DRY guidelines, duplication thresholds, extraction patterns, and @mms/shared export standards
---

# MMS DRY & Shared Package Policy

**Workflow skills:** `mms-shared-package` (extract/export pure helpers and Zod DTOs) · `mms-shared-ui` (shared UI components & cross-console governance).

## 1. Proactive Search & Duplication Audits
- **Shared Component Architecture SSOT (`@shared/ui`):** All reusable UI primitives live in `@shared/ui` (`packages/ui`). Zero duplicate components across Tenant and Platform consoles; see `mms-shared-ui.md` for the authoritative topology, facade rules, and console boundaries.
- **Search First:** Audit `@mms/shared`, `packages/ui/` (`@shared/ui`), `apps/frontend/src/lib/config/`, `apps/frontend/src/hooks/`, `@/components/ui/`, `@/components/app/`, and `@/components/common/` before creating components, layouts, forms, dialogs, utilities, or DTOs. Extend existing abstractions via optional props rather than duplicating.
- **Consumer Compatibility:** Shared component changes must maintain backward compatibility for existing consumers. Verify consumers, run tests, and check affected pages.
- **Right-Sized Abstractions:** Consolidate identical duplication without changing behavior; do not force unrelated functionality into monolithic abstractions. Compose small primitives when call sites differ.
- **Shared Chrome SSOT:** Enforce central primitives and design tokens:
  - Overlays: `OverlayShell`, `Modal` (`Modal.Header`, `Modal.Tabs`, `Modal.Footer`, `Modal.Error`), `Drawer` (`Drawer.Header`, `Drawer.ArchiveBanner`, `Drawer.RestoreOrEditAction`).
  - Selection Docks: `BulkActionDock` (`BulkActionDock.Action`, `BulkActionDock.Separator`, `BulkActionDock.Delete`, `BulkActionDock.Restore`).
  - Selects & Dropdowns: `DropdownSelectBase` & `useDropdownListbox`.
  - Directory Cards & Grids: `EntityCard`, `EntityCardsGrid`.
  - Entity Messaging: `EntityMessagingActions`.
  - Data Tables: Standard tables use `DataTable` (`@/components/common/data-table`); server-paginated Work directories use `WorkTaskToolbar` + `WorkBatchTable` with `useModuleColumnLayout`. Hand-rolled `<Table>` is restricted to reviewed allowlist in `scripts/check-work-directory.mjs`.
  - Ban duplicating UI markup or overlay chrome across features.
- **Entity Descriptors:** Consume `EntityDescriptor<T>` registries (`@/components/common/entityRegistry`, `mms-ui-ux-design.md` §6). Runtime labels mandate `labelKey: AppTranslationKey`.
- **Node 24 Built-Ins:** Prefer native built-ins over external dependencies (`mms-dependencies.md` §3).
- **Zod DTO SSOT:** Share DTO contracts in `@mms/shared`. Derive variants via `.pick()`, `.omit()`, or `.extend()`.

## 2. Extraction Thresholds & Strategy
- **Trigger Conditions:** Promote logic to shared layers when:
  1. Identical logic appears >= 2 times in separate files.
  2. Logic crosses feature or frontend <-> backend boundaries.
  3. Logic exceeds 15 lines of duplicate implementation.
  4. Dimension, toast width, or z-index appears >= 3 times (promote to `index.css` `@theme`).
- **File Sizing Decomp:** When single files exceed the 300-line cap (`mms-structure-naming.md` §3), decompose by concern within the feature folder without modifying barrel exports.

## 3. Monorepo Layer Boundaries
- **`@mms/shared`:** Pure validation schemas, types, constants, default configs, and formatters. Named exports only; subpath imports banned. Zero React, DOM, Fastify, or DB dependencies.
- **`apps/frontend`:** React hooks, UI primitives, providers, TanStack Query facades. Ban direct cross-feature imports (`featureA` from `featureB`); route via `@/tenant/hooks/collections/*` facades or promote to `components/app` (composites) / `@shared/ui` (`packages/ui`) (primitives).
- **`apps/backend`:** Fastify routes, services, repositories, and Drizzle schemas/queries.

## 4. Quality Bar & Code Cleanup
- **Strict Typing:** Strict TypeScript required. Use `unknown` + narrowing. Explicit `any` is banned (`@typescript-eslint/no-explicit-any`).
- **Documentation & Tests:** JSDoc required on public exports in `packages/shared` only. Pure helpers in `@mms/shared` require unit tests.
- **Dead Code Elimination & Pre-Deletion Checks:** Prune unused imports, dead variables, and legacy shims within change boundary. When deleting or migrating UI components or legacy files, execute the mandatory pre- and post-deletion gates in `mms-shared-ui.md` §4 (`typecheck`, `lint`, `build`, and `check:shared-ui`).
- **Formatting SSOT:** Format all dates and currency via `formatDate` and `formatMoney` from `@mms/shared` (`mms-settings-i18n.md`).
- **Banned Anti-Patterns:** Per-module bulk-bar forks; per-list selection hooks (use `useWorkSelection`); parallel primitive component implementations in Tenant or Platform consoles.

