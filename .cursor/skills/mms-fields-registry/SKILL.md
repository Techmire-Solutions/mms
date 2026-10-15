---
name: mms-fields-registry
description: Adds or changes field/tab registries, module Setup Fields UI, and field configuration per mms-fields.mdc. Use when working with custom fields, system tabs, field types, column registries, field delete guards, or getSortedFields. Do NOT use for core entity Drizzle database migrations (use mms-schema-migrate) or generic form modal layouts (use mms-form-architecture).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Field & Tab Registry

**Rules (norms SSOT):** `mms-fields.mdc` · `mms-module-architecture.mdc` §4 · `mms-data-layer.mdc`.

## When to use

- Adding/changing field or tab registry contracts for a module
- Wiring Setup → Fields persistence and delete guards
- Aligning form/drawer/directory columns with registry enablement

## 1. Field & Tab Contracts

- **Field Schema**: `{ key, label, labelKey?, type, enabled, order, options, permissions, defaultValue, required?, unique? }`.
- **Tab Schema**: `{ key, label, labelKey?, icon, enabled, order, permissions, description, color, isSystem }`.
- **Metadata Rule**: `isSystem` is informative metadata only; never branch core rendering or domain behaviour on it.
- **Sorted fields**: Use `getSortedFields` from `packages/shared/src/settings/moduleFieldSchema.ts` (not a hook named `useSortedFields`).

## 2. Field Persistence Gate

Every new or modified field must complete:
`@shared type → DEFAULT_* + merge → typed REST read → typed REST write → UI binding → seeds (if default)`
- **Lookups**: Typed lookup endpoints (e.g., `/api/contacts/lookups`) — never `saveCollection`.
- **Registry Configs**: Typed `{module}_field_configs` via `registerModuleSetupConfigRoutes` — never `saveObject`.
- **Tabs**: Persist via the same setup field-config routes — no separate custom-tabs API.

## 3. Implementation map

| Concern | Path / symbol |
|---------|----------------|
| Sort helper | `packages/shared/src/settings/moduleFieldSchema.ts` (`getSortedFields`) |
| Removal guards | `packages/shared/src/contacts/contactFieldDependencies.ts` (`getContactFieldRemovalIssues`), faculty/student siblings, `createFieldRemovalIssuesChecker` |
| Setup routes | `apps/backend/src/lib/registerModuleSetupConfigRoutes.ts` |
| Column layout | `useModuleColumnLayout` |
| Descriptors | `createEntityDescriptorFromFieldConfig` |

## 4. Delete Guards & UI Parity

- Pre-check dependencies before delete; block seed fields, active column keys, and in-use duplicate-detection fields.
- Every enabled registry field needs a FormModal control and a detail-drawer read row.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-frontend lint
```

## Related skills

`mms-module-setup`, `mms-form-architecture`, `mms-schema-migrate`, `mms-shared-package`.
