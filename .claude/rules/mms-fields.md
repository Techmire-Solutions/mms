---
description: System vs custom fields registry, field tabs, delete guards, and column registry synchronization
paths:
  - "apps/frontend/src/lib/contacts/useContactConfig*.ts"
  - "apps/frontend/src/lib/contactFields*.ts"
  - "apps/frontend/src/tenant/features/**/*Fields*"
  - "apps/frontend/src/tenant/features/**/*Setup*"
  - "apps/frontend/src/platform/**/*Fields*"
  - "apps/frontend/src/platform/**/*Setup*"
  - "packages/shared/src/**/contactTypes.ts"
  - "packages/shared/src/**/contactEnabledTabs.ts"
  - "packages/shared/src/**/contactColumnRegistrySync.ts"
  - "packages/shared/src/**/contactFieldDependencies.ts"
  - "packages/shared/src/**/*Field*"
---

# MMS Fields & Registry Specification

**Workflow skills:** registry/types → `mms-fields-registry` · Setup Fields/Preferences UI → `mms-module-setup` · FormModal binding → `mms-form-architecture` · Schema migrations → `mms-schema-migrate` · Backend API → `mms-backend-api`.

## 1. System vs Custom Fields
- **System Fields:** Typed in `@mms/shared` + concrete Drizzle columns (core domain attributes in dedicated columns).
- **Custom Fields & Tabs:** Typed in `@mms/shared` + concrete relational tables / typed columns. Dynamic form compilers and untyped JSONB/EAV blobs are banned.
- **Custom Collections:** Tenant-created custom collections persist via child/junction tables. Blank rows strip on save via `cleanContactDraft`; empty arrays are authoritative (`mms-form-architecture.md` §3).
- **Column Preferences:** Visibility and width follow `mms-module-architecture.md` §3 (clamp with `clampModuleColumnWidth`).

## 2. New / Changed Field Checklist
1. **Shared:** Strict type and Zod schema in `@mms/shared` (`FIELD_TYPES_META`, `createFormCustomFieldHelpers`, field configs).
2. **Drizzle:** Dedicated typed column or relational table + forward-only migration via `drizzle-kit generate` (`mms-schema-migrate`).
3. **REST:** Validate via Fastify `parseRequest` Zod; builders driven by registry types (no ad-hoc `typeof` switches).
4. **UI:** Bind via registry/form draft; `labelKey` only (no hardcoded labels).
5. **Removal:** Call `getFieldRemovalIssues()` before delete to check dependency conflicts.
6. **Validation:** Save routes validate via shared Zod schemas (`safeParse`); client validation is UX-only.
7. **Soft-Delete Uniqueness:** Recyclable unique fields (`email`, `phone`, `student_id`) require partial unique indexes `WHERE deleted_at IS NULL` (`mms-soft-delete`).

## 3. Localization
- **i18n Label Keys:** Field definitions mandate `labelKey: AppTranslationKey` resolved via `t(labelKey)`. English fallback strings (`t(key) || 'Label'`) are banned.

## 4. Tab Enablement SSOT (Contacts Reference)
- **Authoritative Flags:** Active `formTabs.enabled` flags govern forms, drawers, exports, and backend validation. Resolve tab IDs via `resolveContactEnabledTabIds` from `@mms/shared` (never blind-union `DEFAULT_ENABLED_TABS`).
- **Stable References:** Pass `CONTACT_LOCKED_ENABLED_TABS` (`basic` only) as a stable, memoized reference to prevent re-render loops.

## 5. Contact-Linked Module Identity (Students & Faculty)
- **Registry Configuration:** Identity fields (contact link, gender, DOB, relationships) are registry configurations; Contacts remains the person data SSOT.
- **Zero Dual-Writes:** Dual-writing person profile keys onto `students` or `faculty` tables when `contactId` is set is banned (`mms-data-layer.md`).

## 6. Form & Drawer Render Parity
- **Full Parity:** Every active system or core field required by validation must have a form control and a read row in the detail drawer. Hardcoded allowlists that return null for active fields are banned.

## 7. Entity Presentation Descriptor Adapter
- **Descriptor Bridge:** Bridge runtime `FieldConfig` into `EntityDescriptor<T>` via `createEntityDescriptorFromFieldConfig` (`@/components/common/entityDescriptorFromFieldConfig`).
- **Layout Fidelity:** Preserves dynamic field ordering, drawer grouping, and visibility. Card metadata components support merge mode (`extraColumns`) to compose descriptor tiles with custom chrome.

