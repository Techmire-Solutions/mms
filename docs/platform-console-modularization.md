# Platform Console Modularization Review

Date: 2026-11-23 · Scope: `apps/frontend/src/platform` (frontend only).

## Verdict

The platform console had feature-shaped pockets (`components/workspace`, `components/settings`, …) but no
module boundaries: 35 components, 53 hooks, and 30 lib files sat flat beside the grouped folders, while pages
lived in a single `pages/` tree. Feature ownership was only discoverable by reading imports.

The console now mirrors the tenant module shape: every feature has one folder containing its page,
components, hooks, and feature-local lib, with a shared shell/auth layer and a small cross-feature hooks set.

## Findings

| # | Finding | Resolution |
|---|---|---|
| 1 | Flat root `components/` mixed shell chrome (`PlatformPageShell`, sidebar, command palette, boot gates) with feature components (dashboard, reports, workspace dialogs, admin dialogs). | Moved to `features/shell`, `features/auth`, or the owning feature. |
| 2 | Flat `pages/` mixed auth, onboarding, account, dashboard, workspaces, users, settings, reports, consolidation, activity logs, ERD, and design-system entry points. | Pages now live at `features/{feature}/{Feature}Page.tsx`; auth/onboarding/account subdirs preserve their internal structure under the feature. |
| 3 | Feature hooks were centralised in `platform/hooks/` and reachable by any feature, hiding ownership. | Feature hooks moved to `features/{feature}/hooks/`; only cross-feature hooks (`usePlatformPermissions`, `usePlatformDensity`, `usePlatformNotificationAck`) remain in `platform/hooks/`. |
| 4 | Feature libs were centralised in `platform/lib/` (auth context, nav, query keys, permission config, settings nav, design-system registry, recent workspaces, metrics, validation). | Moved to the owning feature's `lib/`; shell holds nav/query-keys/contexts/notification/validation; auth holds the auth context/errors/types. |
| 5 | Shell/auth infrastructure (boot gates, page shell, sidebar/header, command palette, session watcher) was indistinguishable from feature UI. | Both are named features (`features/shell`, `features/auth`) so the dependency direction is explicit. |
| 6 | Tests that read source files by literal path (`readFileSync("src/platform/components/…")`) broke on reorganization and are a recurring refactor tax. | Paths updated; future moves must update source-path assertions in the same change. |
| 7 | `components/tiers/` split report and user tier surfaces across one folder. | `PlatformReportsTier` moved to `features/reports`, `PlatformUsersTier` to `features/users`. |

## Target layout

```
platform/
├─ features/
│  ├─ shell/        # PageShell, page header, sidebar, header, command palette, contexts, nav, query keys
│  ├─ auth/         # login/setup/2FA/forgot, ApexHome, workspace gate, boot gates, auth context, session watcher
│  ├─ onboarding/   # provisioning wizard (steps/, controller)
│  ├─ account/      # profile, password, migrate/restart, sessions
│  ├─ dashboard/    # page + dashboard cards/telemetry/charts
│  ├─ workspaces/   # directory, dialogs, table/cards, registry, workspace hooks/lib
│  ├─ users/        # users/admins pages, admin dialogs, permissions matrix, admin metrics
│  ├─ reports/      # reports page, charts, CSV export, operator/module adoption
│  ├─ consolidation/
│  ├─ activity-logs/
│  ├─ settings/     # 6-tab settings page/components, settings/branding/modules/LLM/backup hooks/lib
│  ├─ system/       # system maintenance, telemetry/database cards
│  ├─ erd/
│  ├─ design-system/
│  └─ ai/           # Platform AI diagnostics
├─ hooks/           # cross-feature hooks only (permissions, density, notification acks)
├─ routes/          # ApexRoutes + route registry
└─ platformUiArchitecture.test.ts
```

Each feature follows the tenant rule: `{Feature}Page.tsx` at the feature root, `components/` for UI only,
`hooks/`/`lib/` for logic. Cross-feature imports are explicit absolute paths; there are no platform barrels.

## Migration summary

| Feature | Files |
|---|---:|
| account | 10 |
| activity-logs | 12 |
| ai | 6 |
| auth | 35 |
| consolidation | 7 |
| dashboard | 16 |
| design-system | 6 |
| erd | 9 |
| onboarding | 16 |
| reports | 18 |
| settings | 34 |
| shell | 43 |
| system | 9 |
| users | 47 |
| workspaces | 54 |
| **total** | **333** |

## Boundary rules

- A feature may import `@shared/ui`, `@/components/*`, `@/hooks/*`, `@/lib/*`, its own files, shared shell
  surfaces, cross-feature hooks in `@/platform/hooks/`, and existing feature hooks/lib that act as de-facto
  public façades.
- New cross-feature UI should be promoted to `features/shell/components` (shared platform composite such as
  `PlatformModuleSelectCard`) or `@/components/*` rather than imported from another feature's `components/`.
  Existing cross-feature edges are listed below and are follow-up candidates, not new coupling.
- `features/shell` owns chrome (page shell, header, sidebar, command palette, navigation registries, query keys,
  contexts) plus cross-feature console composites; it must not import feature pages.
- `features/auth` owns session/auth chrome and must not import feature pages.
- `platform/hooks/` is limited to cross-feature session/UI capabilities; new feature hooks belong to the feature.

Known existing cross-feature edges (pre-existing, unchanged by the move):

- `shell` consumes feature hooks for header/sidebar summaries (branding, health, workspaces, system).
- `auth` (workspace gate/layout) consumes workspace and branding hooks.
- `dashboard` consumes report/system/workspace summary components and hooks.
- `onboarding` and `account` consume settings hooks; `reports`/`consolidation` consume workspace summaries.
- `account` exposes `PlatformMigrateRestartCard`, which `system` consumes.

These edges are stable public surfaces today. Promoting them into a shared platform `components/`/`hooks/` core
is the next decoupling step; the move deliberately did not change behaviour or rewrite those dependencies.

## 3-tier module conversion (2026-11-24)

The platform console now applies the tenant universal module architecture: every platform **module** renders
`ModulePageShell` tabs **Work (labeled with the module name) · Reports · Setup** via the shared
`useModuleTierTabs`/`usePlatformModuleTabs` scaffolding (promoted `useModuleTierTabs` to `@/hooks/`).

| Module | Route | Work | Reports | Setup | Permission |
|---|---|---|---|---|---|
| Workspaces | `/platform/workspaces` | workspace directory | fleet/adoption analytics | provisioning defaults | `workspaces` |
| Users | `/platform/users` | admins directory | operator metrics | permissions matrix | `admins` |
| Consolidation | `/platform/consolidation` | groups | consolidated report | preferences | `workspaces` |
| Contacts (new) | `/platform/contacts` | contact directory | reachability metrics | preferences | `contacts` |
| Messaging (new) | `/platform/messaging` | broadcast log + composer | volume metrics | templates | `messaging` |

- `/platform/reports` now redirects to `/platform/workspaces?tab=reports`; the standalone Reports page/nav entry was removed.
- New platform capabilities `contacts` and `messaging` were added to `PLATFORM_ADMIN_PERMISSION_KEYS`
  (migration `0273` also widens the `platform_user_permissions` CHECK and creates `platform_contacts`,
  `platform_messages`, `platform_message_templates`).
- Backend: `routes/platform/platformContacts.ts` + `platformMessaging.ts`, repositories/adapters/use-cases,
  `contracts/platformContacts.contract.ts` + `platformMessaging.contract.ts`.

## Gold-standard convergence (§0–§8)

Every platform module now applies the tenant universal-module norms (`mms-module-architecture`):

- **Manifest + permission hook** — `platformModuleManifest.ts` + `usePlatformModulePermissions` (5 manifests: workspaces, users, consolidation, contacts, messaging).
- **Command metrics** — each page renders a `ModuleCommandMetricsGrid` strip via `metricsStrip`.
- **Work directories** — Contacts/Messaging/Consolidation use the shared `DataTable` (table + cards, single filter menu, persisted column layout via `tableId`, selection + `BulkSelectionBar`, row-click `DetailDrawerShell`). Workspaces/Users keep their bespoke provisioning/permission directories (specialized admin surfaces predating the shared DataTable).
- **Data transfer** — CSV export (workspaces/users/contacts/messaging/consolidation) + CSV import (contacts via `ContactImportDialog`).
- **Soft-delete** — Contacts + Messaging trash/restore (`?view=trash`, `ModuleTrashToggle`, restore routes).
- **Setup tiers** — dirty-gated preferences for Workspaces (provisioning defaults), Consolidation (`consolidation_prefs`), Contacts (`contact_prefs`); Users permissions matrix; Messaging templates. Persisted via `platform_settings` (migrations `0274` consolidation_prefs, `0275` contact_prefs).
- **Reports tiers** — KPI StatCards everywhere; Recharts pie charts (contacts by kind, messaging by channel); Consolidation report builder + CSV export.
- **Form lifecycle** — shared `FormModal` with dirty guard + server-error mapping; extracted `ContactFormModal`, `MessagingComposeModal`, `ContactImportDialog`.

## Verification

- `pnpm --filter mms-frontend typecheck` ✅
- `pnpm --filter mms-frontend test` ✅ (1390 files / 5279 tests)
- `pnpm --filter mms-frontend lint` ✅
- `pnpm run check:shared-ui`, `check:code-norms`, `check:frontend-structure`, `check:form-architecture`, `check:work-directory` ✅
- `pnpm ci:local` ✅ (backend 630 files / 4414 tests; shared 311 / 2623)
- `pnpm --filter mms-frontend build` + bundle/PWA budgets ✅
- `E2E_TARGET=local playwright test tests/platform/platform-settings.spec.ts` ✅ (2/2, after restarting the dev server to clear stale HMR)
- `bash .agent/scripts/sync-all.sh` + `node scripts/verify-rules-integrity.mjs` ✅
