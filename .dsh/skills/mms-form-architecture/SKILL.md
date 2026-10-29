---
name: mms-form-architecture
description: Implements static FormModal forms with shared Zod DTOs, React 19 defaults, decimal-as-string money, tenant RLS saves, and authenticated multipart uploads. Use when building or auditing create/edit forms, FormModal tabs, DatePicker/TimePicker/DateTimePicker/phone fields, or upload flows. Do NOT use for table/card directory views (use mms-module-work), multi-tier module tabs (use mms-module-page), or accessibility audits (use mms-a11y-smoke).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Form Architecture Skill

**Rule (norms SSOT):** `mms-form-architecture.md` · `mms-core.md` · `mms-ui-ux-design.md` §4, §8 · `mms-performance.md` §2.
**Workflows:** `/feature-module` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Building or auditing create/edit FormModal flows
- Wiring DatePicker/TimePicker/phone fields or upload controls

## Accounting forms

Advisory: use [ledger controls](../mms-finance-accounting/references/ledger-controls.md) for exact amount boundaries, posting/replay behavior, and server-owned fields. Distinguish Save draft, Post, Reverse, Reconcile, and Close; a generic form submit is not authority for each transition.

Keep decimal input lossless until validated against the actual shared contract; do not parse formatted currency text with parseFloat. Preserve an idempotency identity across retry, await server confirmation, and surface period/account/conflict errors without discarding the draft. Client totals are a preview; the server validates the posted journal. Posted records expose correction actions rather than in-place financial edits.

## Control decision table (SSOT)

Pick exactly one control family — see rule `mms-form-architecture` §1:

| Need | Control |
|------|---------|
| enum / filter | `FormSelect` |
| string tenant lookup | `EditableSelect` |
| entity catalog FK + create modal | `FormSelectWithQuickCreate` |
| person search | `ContactPicker` / `RegistryPersonSelect` |
| chips | `CategorySelector` / `FormTagsInput` |
| row-header discriminative control | `FormCardTypeSelect` in `FormListFieldCard.typeSelect` |
| repeatable draft rows | `FormCollectionShell` + `FormListFieldCard` + `FormAddAnotherButton` |

Form list cards use default primary stripe/icon — ban per-collection `accentClass` / `iconClass` on form rows.

## Anti-Patterns & Banned Operations

- ❌ **No RSC Server Actions**: MMS writes use client-side `apiClient` / `apiContract` with cookie authentication. Client `useActionState` is allowed under the owning rule when it preserves Query invalidation and the shared form contract.
- ❌ **NEVER use `forwardRef` in newly authored components**: React 19 supports `ref` directly as a component prop.
- ❌ **NEVER block paste on inputs**: Banning paste on password, OTP, or 2FA fields is strictly forbidden (WCAG 2.2 3.3.8).
- ❌ **NEVER display premature validation errors**: Avoid showing red errors on clean, untouched fields while the user types; validate on blur or submit attempt.
- ❌ **NEVER accept client soft-delete fields**: Strip `deletedAt`, `deletedBy`, `deletionReason` on create/update schemas.
- ❌ **NEVER assign soft-deleted foreign keys**: Enforce active foreign key guarding (`deleted_at IS NULL`).
- ❌ **NEVER buffer uploads into memory**: Stream files directly using Fastify `@fastify/multipart`.
- ❌ **NEVER invent per-feature “add another” row chrome**: Use `FormCollectionShell` + `FormListFieldCard` (+ `CardRemoveButton`) + `FormAddAnotherButton` from `FormPrimitives` for every repeatable form collection — contacts, faculty designations, QB matching/ordering/citations, Wakala distribution, journal lines, paper sections, class fee/schedule/budget rows, and future lists. Ban one-off `Button`+`Plus`, custom dashed borders, or `SectionCard` wrapping list cards. `ContactSubListShell` is a thin adapter over `FormCollectionShell`.
- ❌ **NEVER stack duplicate collection titles**: Named FormModal tab → omit shell title. All-sections layout → one plain `FormCollectionShell` title. Row card headers must not repeat the collection noun; wrap the discriminative control in `FormCardTypeSelect` inside `typeSelect` (or a sequence label only when there is no type control).
- ❌ **NEVER invent per-feature FormSelect + Plus chrome for entity catalogs**: Use `FormSelectWithQuickCreate` + the module’s catalog FormModal/mutation, then auto-select the created entity. Required on write-form entity-catalog FKs that already have a create modal (faculty/org/Wakala/obligation/QB books/accounting accounts). Keep `EditableSelect` for string lookups, `ContactPicker`/`RegistryPersonSelect` for person search, `CategorySelector` for chips, plain `FormSelect` for enums/filters, and do not Plus-wrap cross-module heavy creates.
- ❌ **NEVER pass per-collection accent/icon classes on form list cards**: Use `FormListFieldCard` primary defaults.

## Form contract and draft lifecycle

Use `FormModalProps` in `apps/frontend/src/components/app/FormModal.tsx`: `open`, `onSave`, `saving`, `saveDisabled`, and `error`. There are no `isOpen`, `isSubmitting`, or `onSubmit` props. `examples/TemplateFormModal.tsx` points at the shared shell instead of inventing a domain DTO.

Advisory implementation checklist:
1. Import the actual shared write schema; validate before mutation and map errors with existing helpers. Do not cast a partial draft into a write DTO or swallow rejection.
2. Define an edit-session identity. Reset draft/errors when opening a different record; preserve dirty input during background refetch and on save failure. Do not continuously overwrite the draft from Query data.
3. Await the mutation; retain input and show localized error on failure. Decide explicitly whether tabs save: `saveOnTabChange` defaults to true, so set it false for create/draft flows that should save only on explicit submission.
4. Use shared controls with names, labels, stable IDs, `aria-invalid` and connected error descriptions. For number/date inputs normalize null domain values to empty strings.
5. Keep focus on the invalid field (activate its tab first), guard accidental closure while saving, and return focus on close. Verify these behaviors; passing a prop is not proof.

## UI/UX Pro Max Form Intelligence

Advisory: query UI/UX Pro Max before authoring complex forms to align with proven UX guidelines:
```bash
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<form-topic>" --domain ux
```
- **Error Recovery & Prevention**: Validate on blur or submit attempt; highlight invalid fields with clear, actionable copy without punitively clearing valid entries.
- **Input Sizing & Affordances**: Pair form controls with `inputMode`, `enterKeyHint`, and semantic `autoComplete` attributes.
- **Label & Helper Hierarchy**: Form labels are compact, non-duplicative, and paired with `useId()` and `aria-describedby` helper texts.

## Verification Checklist

```
- [ ] FormModal with React 19 ref-as-prop and useId() accessibility pairs
- [ ] Control decision table followed (no parallel chrome)
- [ ] Repeatable rows use FormCollectionShell + FormListFieldCard + FormAddAnotherButton
- [ ] Discriminative row headers use FormCardTypeSelect; form cards use primary stripe defaults
- [ ] Virtual keyboard hints provided (inputMode, enterKeyHint, autoComplete)
- [ ] Paste strictly enabled on all fields including OTP/passwords (WCAG 2.2 3.3.8)
- [ ] Non-punitive validation UX (validate on blur or submit attempt; text-wrap: pretty)
- [ ] Form UX guidelines verified (python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<topic>" --domain ux)
- [ ] Touch targets meet 44×44px floor (min-h-11 min-w-11)
- [ ] Dialog layout works at narrow widths; container queries/subgrid only when useful (advisory)
- [ ] No Server Actions or form action= posts
- [ ] Shared Zod write schema validates inputs strictly (.strict())
- [ ] Dates validated with isoDateSchema / isoDateOrEmptySchema
- [ ] Active foreign keys verified (deleted_at IS NULL)
- [ ] Focus-return restored to opener on dialog close
- [ ] Run: pnpm typecheck && cd apps/frontend && pnpm lint
```

## References

- Form Collection Patterns & Control Recipes: `references/form-collection-patterns.md`

## Related skills

`mms-fields-registry`, `mms-module-page`, `mms-frontend`, `mms-shared-package`.
