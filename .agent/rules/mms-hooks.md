---
trigger: model_decision
description: Frontend React hooks standards, TanStack Query factories, page controllers, and view mode state
---

# MMS Hooks

**Workflow skills:** Query `queryOptions` / optimistic policy → `mms-query-factories` · page controllers / FE shell → `mms-frontend` · Work layout → `mms-module-work`.

## 1. Server State (TanStack Query)
- **Query Factories & Toast:** Wrap colocated `queryOptions` / `mutationOptions` factories (`@/lib/query/*`). Toast via `notify.*` + `t()` at call site after `mutateAsync`; ban global `MutationCache` toast buses.
- **Cross-Module Facades:** Hook implementations stay in `tenant/features/{module}/hooks/`. Cross-feature imports must use `@/tenant/hooks/collections/{module}` facades. Platform hooks colocate in `@/platform/hooks/` and must not cross tenant boundaries.

## 2. Legacy Data Layer (`useLiveCollection` Ban)
- **Hard Ban on REST Entities:** `useLiveCollection` and `getCollection` are banned for REST-migrated entities (Contacts, Students, Faculty, Finance). Restricted solely to non-migrated settings singletons (`branding`, `global_settings`).

## 3. Lookups, Settings & Module Config
- **Lookups:** Use feature hooks (`useObligationLookups`, `useWorkspaceRoles`). Form fields consume `getSortedFields(defaultDefs, fieldOrder, fieldsConfig, customFields)` from `@mms/shared` (`moduleFieldSchema.ts`) rather than hardcoded lists.
- **Settings & Branding:** Use `useGlobalSettings`, `useBranding`, and draft hooks (`useSettingsDraft`) (`mms-settings-i18n.md`).
- **Standard Module Config:** Modules build on `useStandardModuleConfig` (`createStandardModuleConfigHook`). Contacts uses `useContactConfigProviderValue` mounted once via `ContactConfigContext`.

## 4. RBAC & Viewer Permissions
- Use `useModulePermissions(manifest)` / `can()` for module action gates. Introducing new `role ===` write gates on tenant modules is banned.

## 5. UI Shell & Modals
- Sanctioned shell hooks: `useFilteredModuleTierTabs`, `useConfigSubTabs`, `useTranslation`, `useSessionTimeout`, `useDebounce`, `useMediaQuery`. Use `useBodyScrollLock`; never set `document.body.style.overflow` manually.

## 6. Page & Panel Controllers
- **Decomposition:** Keep JSX shells thin. Decompose into `use{Module}PageController` (state, tabs, permissions), `use{Thing}Draft` (form state), and `use{Thing}Actions` (save, bulk, restore handlers).
- **Soft-Delete URL Sync:** Synchronize `viewingDeleted` with URL via `useDirectoryTrashState` (`?view=trash`). Toggling trash must preserve active search and filter state (`mms-soft-delete`).
- **Single Soft-Delete Optimistic Pattern:** Eligible non-financial single deletions trigger instant Query cache hide + 5–10s Undo toast that executes `POST /:id/restore` on click without view change.
- **Memoization:** Memoize non-trivial calculations (`useMemo`) and callbacks (`useCallback`) passed to children to prevent render cascades (`mms-performance.md`).

## 7. Work Directory Layout
- Directory view mode: `useWorkDirectoryViewMode` (`table` | `cards`).
- Layout & metrics: `useModuleColumnLayout` for column widths/visibility; `use*Metrics` for command-centre KPIs (ban client-reducing full lists for KPI cards).

## 8. New Hooks Checklist
- Pass `signal` to `apiFetch`; set `enabled: isAuthenticated` (or `isPlatformAuthenticated`).
- Zero ad-hoc polling loops (use WebSockets or documented `refetchInterval`).
- Enforce the 300-line hard cap per hook file (prefer ≤220).

## 9. Workflow & Output Speed Rules
- **Zero Output Bloat:** Output surgical diffs or targeted snippets only. Never rewrite entire files unless creating a new file from scratch. Omit conversational filler.
- **Verification Gates:** Verify with `pnpm typecheck` and scoped tests before marking tasks done. If standards are modified, execute `bash .agent/scripts/sync-all.sh` and verify with `node scripts/verify-rules-integrity.mjs`.
