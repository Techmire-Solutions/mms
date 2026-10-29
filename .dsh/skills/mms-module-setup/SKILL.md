---
name: mms-module-setup
description: Implements or modifies the module Setup tier per mms-module-architecture.md — the Preferences/setup shell, sub-tab registration, setup audit, and preference cascading. Use when configuring module settings, setup sub-tabs, or module preferences. Do NOT use for the field registry and Setup → Fields field definitions (use mms-fields-registry), global workspace settings under /settings (use mms-settings-i18n), or Work tier tables/drawers (use mms-module-work).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Module Setup Workflow

**Rules (norms SSOT):** `mms-module-architecture.md` §4 · `mms-fields.md` · `mms-settings-i18n.md`. Field definitions → `mms-fields-registry`.

## When to use

- Adding or changing module Setup sub-tabs / Preferences panels
- Wiring dirty-gated setup save + setup audit
- Cascading field visibility from registry into forms/drawers/directories (with `mms-fields-registry`)

## 1. Setup Tier Architecture & Sub-Tabs

- **Tier Structure**: Module Setup (`tierId: 'setup'`) houses Preferences and manifest-declared `setupSubTabs` (e.g. `['preferences', 'fields']`).
- **Shell Standard**: Render via `SubTabBar` + `useModuleSetupSubTabs` (`apps/frontend/src/lib/setup/useModuleSetupSubTabs.ts`).
- **RBAC Gating**: Gate edit with `canEditSetup`; render `SetupReadOnlyMessage` for view-only.
- **Isolation**: Module preferences stay in the module Setup tab — never under global `/settings`.

## 2. Implementation map

| Concern | Path / symbol |
|---------|----------------|
| Sub-tabs | `useModuleSetupSubTabs`, `SubTabBar` |
| Drafts | `useSettingsDraft` |
| Backend routes | `apps/backend/src/lib/registerModuleSetupConfigRoutes.ts` |
| Module panels | `*SetupSaveActions` / `*SetupPanelState` under `apps/frontend/src/tenant/features/*/` |

## 3. Preferences & Drafting

- Draft in memory (`useSettingsDraft`); ban auto-save on every keystroke.
- Save CTA is dirty-gated; await typed REST (`saveSettingsAsync`) before success UI.
- Mutating config logs setup audit (`POST /api/{module}/setup-audit`).

## 4. Field Visibility Cascade

Prefer deactivating fields over erasure. Before delete, run `get*FieldRemovalIssues()` from `@mms/shared`. Disabling a field must remove it from forms, drawers, directory columns/cards, filters, and CustomReportBuilder/export columns.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-frontend lint
# Spot-check Setup save + reload for the module you touched
```

## Related skills

`mms-fields-registry`, `mms-module-page`, `mms-settings-i18n`, `mms-form-architecture`.
