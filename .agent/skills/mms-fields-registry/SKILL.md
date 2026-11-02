---
name: mms-fields-registry
description: Adds or changes field/tab registries, module Setup Fields UI, and field configuration per mms-fields.md. Use when working with custom fields, system tabs, field types, column registries, field delete guards, or getSortedFields. Do NOT use for core entity Drizzle database migrations (use mms-schema-migrate) or generic form modal layouts (use mms-form-architecture).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Field & Tab Registry

**Rules (norms SSOT):** `mms-fields.md` · `mms-module-architecture.md` §4 · `mms-data-layer.md`.

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
- **One tab→property map**: the mapping from list/collection tabs to entity properties (`phones`→`phones`, `relationship`→`relationshipContacts`, `education`/`experience`/`skills`/`bankDetails`→same-named arrays, custom tab→its array) is declared once and consumed by the write DTO allowlist, dynamic validation, unique-field collection, profile completeness, and the response sanitizer/export. Divergent copies silently skip unique checks and leak hidden tabs (`mms-fields.md` §4).
- **Permission enforcement traverses collections**: a hidden/role-restricted tab strips its whole array; a hidden field inside a visible list tab is removed from each row. Deleting a top-level property that only exists inside the array is a no-op — see `contactResponseSanitizer.ts` and assert it with a disabled-tab test.

## 5. System-Managed Projections

- A derived field (e.g. Student/Parent/Guardian and `faculty-<Designation>` tags) is read-only even though it appears in the field surface. Keep it out of editable lookup options, render locked chips outside the control, and submit only the editable field value.
- Expose metadata (`source`, `systemKey`, `archived`) with the display value; the response sanitizer strips the metadata and values together when the owning field is hidden.
- Accept the projection on a strict write DTO only to strip it; bulk/import attempts to edit reserved values return `400`. Server-side reconciler owns inserts/updates/archives (`mms-data-layer.md` §9).
- **Cross-module parity**: every surface that exports contacts (messaging recipients, VCF/CSV export, WhatsApp links) runs `sanitizeContactsForViewer` with the viewer role and a minimal projection. Module access is not field authorization; verify a hidden phone/email/notes field cannot reappear through a borrowing module.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-frontend lint
pnpm --filter mms-backend test:db contactsSystemTagsDb
```

## Related skills

`mms-module-setup`, `mms-form-architecture`, `mms-schema-migrate`, `mms-shared-package`.
