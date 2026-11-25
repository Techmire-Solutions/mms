---
name: mms-contacts
description: Governs the Contacts person-directory domain (person SSOT, contactId linking, dedup, system tags, outbox). Use when contacts tables, directory/drawers, dedup, or /api/contacts. Do NOT use for students/enrollments (use mms-student-lifecycle), faculty staff (use mms-faculty-domain), or form layout (use mms-form-architecture).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-25
---

# MMS Contacts Domain

**Rules (norms SSOT):** `mms-data-layer.mdc` §1 (person SSOT + `contactId` linking) · `mms-module-architecture.mdc` §7 (gold-standard parity) · `mms-form-architecture.mdc` (person forms).

## When to use

- Modifying the contacts person directory, drawers, dedup, or the `/api/contacts` router
- Working on contact profile fields, `contactId` linking from students/faculty/guardians, or system tags
- Aligning a module directory to the Contacts gold standard

## 1. Person SSOT & linking

- `contacts` is the SSOT for personal identity. `students`, `faculty`, and guardians reference it via `contactId` and must **not** persist contact profile fields on their own tables when `contactId` is set (`mms-data-layer.mdc` "Person Modules").
- Person filtering must join `contacts`; never filter on JSONB copies of profile fields.
- Dedup and role-derived system tags reconcile idempotently per contact (advisory-locked, run once after a batch).

## 2. Implementation Map

| Concern | Path |
|---|---|
| Tenant router | `packages/modules/contacts/src/backend/tenant.router.ts` |
| Platform router | `packages/modules/contacts/src/backend/platform.router.ts` |
| Service | `packages/modules/contacts/src/backend/contacts.service.ts` |
| Shared types/errors | `packages/modules/contacts/src/shared/types.ts` · `packages/modules/contacts/src/shared/errors.ts` |
| System tags | `packages/modules/contacts/src/backend/systemTags/contactSystemTagFacultyCompute.ts` · `packages/modules/contacts/src/backend/systemTags/contactSystemTagReconcile.ts` |
| Frontend tenant | `packages/modules/contacts/src/frontend/tenant/` (components, hooks, lib) |
| Frontend platform | `packages/modules/contacts/src/frontend/platform/` |

## 3. Verification

```bash
pnpm --filter @mms/mod-contacts build && pnpm --filter @mms/mod-contacts test
pnpm --filter mms-api test:db contacts
pnpm --filter mms-tenant-web test apps/tenant-web/src/tenant/features/contacts
```

## Related skills

`mms-module-page`, `mms-module-work`, `mms-form-architecture`, `mms-student-lifecycle`, `mms-faculty-domain`.
