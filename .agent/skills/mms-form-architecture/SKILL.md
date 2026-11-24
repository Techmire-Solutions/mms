---
name: mms-form-architecture
description: Implements static FormModal forms with shared Zod DTOs, React 19 defaults, decimal-as-string money, tenant RLS saves, authenticated multipart uploads, and the draft-lifecycle contract (identity reset, guarded submit, server-error mapping, dirty guard). Use when building or auditing create/edit forms, FormModal tabs, DatePicker/TimePicker/DateTimePicker/phone fields, upload flows, or running a form inventory/audit. Do NOT use for table/card directory views (use mms-module-work), multi-tier module tabs (use mms-module-page), or accessibility audits (use mms-a11y-smoke).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-16
---

# MMS Form Architecture Skill

**Rule (norms SSOT):** `mms-form-architecture.md` §1–§8 · `mms-core.md` · `mms-ui-ux-design.md` §4, §8 · `mms-performance.md` §2.
**Workflows:** `/feature-module` · `/form-audit` · **Manifest:** `.agent/skills-manifest.json`

## When to use

- Building or auditing create/edit FormModal flows
- Wiring DatePicker/TimePicker/phone fields or upload controls
- Running the form inventory / lifecycle audit (`/form-audit`)
- Fixing stale drafts, double submits, unmapped server errors, or missing cache invalidation in a form

## Form contract and draft lifecycle

`FormModalProps` in `apps/frontend/src/components/app/FormModal.tsx`: `open`, `onClose`,
`onSave`, `saving`, `saveDisabled`, `saved`, `error`, `onSelectError`, `isDirty`, `tabs`,
`activeTab`, `onTabChange`, `saveOnTabChange`, `tall`, `footerStart`, `hideFooter`,
`saveVariant`, and the discard-confirm copy. There is no `isOpen`, `isSubmitting`, or
`onSubmit` prop — bind `saving={mutation.isPending}` (or the hook's `submitting`).

The shared helpers are the contract; a form that re-implements one is the defect:

| Helper | Path | Required when |
|---|---|---|
| `useFormSubmission` | `@/lib/forms/useFormSubmission` | Shell forms: synchronous double-submit guard, `saving` flag, field-error mapping, form-level fallback, await-before-close |
| `useSubmitGuard` | `@/lib/forms/useSubmitGuard` | A form keeps its own submit state and only needs the ref-based re-entry guard |
| `useIdentityReset` | `@/lib/forms/useIdentityReset` | Hand-rolled draft state that must reset when `open`/record identity changes |
| `useZodDraftForm` | `@/lib/forms/useZodDraftForm` | Complex hand-rolled drafts that need schema validation + dirty baseline + save in one machine |
| `useDirtySnapshot` | `@/lib/forms/useDirtySnapshot` | Dirty tracking for the shell's discard confirm (identity-aware, refetch-safe) |
| `useStableRowList` | `@/lib/forms/useStableRowList` | Repeatable rows that add/remove/reorder (stable `key`, no index keys) |
| `mapZodFormErrors` | `@/lib/forms/mapZodFormErrors` | Mapping `ZodError` → field → localized message |
| `mapApiFormError` | `@/lib/forms/serverFormErrors` | Mapping contract/domain field errors + conflict/fallback messages onto fields |
| `Field` / `FieldErrorMessage` | `@/components/app/FormPrimitives` (from `@mms/ui`) | Every control: label, required mark, hint, inline error, `aria-invalid` + `aria-describedby` |
| `FormErrorBanner` | rendered by `Modal` from the `error` prop | Never render a second banner inside the body |

Advisory implementation checklist:
1. Import the actual shared write schema; validate on submit and map issues with `mapZodFormErrors`. Do not cast a partial draft into a write DTO or swallow rejection.
2. Define the edit-session identity (`${open}:${recordId ?? "new"}`) and reset draft/errors from it. Never continuously overwrite the draft from Query data; preserve dirty input during refetch and on save failure.
3. Await the mutation; retain input and show localized field/banner errors on failure. Decide explicitly whether tabs save: `saveOnTabChange` defaults to true, so set it false for create/draft flows that save only on explicit submission.
4. Use shared controls with names, labels, stable IDs, `aria-invalid` and connected error descriptions. For number/date inputs normalize null domain values to empty strings.
5. Keep focus on the invalid field (activate its tab first), guard accidental closure while saving, and return focus on close. Verify these behaviours; passing a prop is not proof.
6. Close only after `mutateAsync` resolved and the mutation's `onSuccess` invalidators ran (list, detail, widget, lookup, report roots).

## Audit, inventory & ratchet

```bash
pnpm run forms:inventory      # regenerate docs/forms-inventory.md (never hand-write it)
pnpm run check:forms          # inventory freshness + lifecycle baselines (may only decrease)
node scripts/check-form-architecture.mjs --json    # measured counts for a fix wave
node scripts/check-form-architecture.mjs --ratchet # fails if a BASELINE was padded upward
```

`/form-audit` (`.agent/workflows/form-audit.md`) is the procedure: inventory → lifecycle →
collections → shared UI → i18n/BiDi/a11y → domain sweeps (6A–6D) → regression gate. Findings
go in `docs/forms-audit-2026-11-16.md` using the format and severity rubric in
[form-audit-checklist.md](./references/form-audit-checklist.md); a finding is closed only when
its spec exists.

Three static vitest guards already fail the frontend suite, and scanning them is faster than
re-deriving their rules:
`apps/frontend/src/lib/forms/formContractArchitecture.test.ts` (no `void mutate(`, no removed
props, no legacy store), `formUiPrimitives.test.ts` (no raw controls / literal copy / physical
direction classes), `formCollectionKeys.test.ts` (no index keys).

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
- ❌ **NEVER render system-managed values as editable controls**: Derived tags/status/provenance are locked read-only chrome; the draft may carry the read projection but the write DTO strips it.
- ❌ **NEVER assign soft-deleted foreign keys**: Enforce active foreign key guarding (`deleted_at IS NULL`).
- ❌ **NEVER buffer uploads into memory**: Stream files directly using Fastify `@fastify/multipart`.
- ❌ **NEVER fire a save with `void …mutate(`** or close the modal before `mutateAsync` resolves.
- ❌ **NEVER invent an `isSubmitting`/`onSubmit` prop or a second error banner**: `saving` + `error` are the shell contract.
- ❌ **NEVER use an array index as a React key** in repeatable form rows.
- ❌ **NEVER invent per-feature “add another” row chrome**: Use `FormCollectionShell` + `FormListFieldCard` (+ `CardRemoveButton`) + `FormAddAnotherButton` from `FormPrimitives` for every repeatable form collection. Ban one-off `Button`+`Plus`, custom dashed borders, or `SectionCard` wrapping list cards. `ContactSubListShell` is a thin adapter over `FormCollectionShell`.
- ❌ **NEVER stack duplicate collection titles**: Named FormModal tab → omit shell title. All-sections layout → one plain `FormCollectionShell` title. Row card headers must not repeat the collection noun; wrap the discriminative control in `FormCardTypeSelect` inside `typeSelect`.
- ❌ **NEVER invent per-feature FormSelect + Plus chrome for entity catalogs**: Use `FormSelectWithQuickCreate` + the module’s catalog FormModal/mutation, then auto-select the created entity.
- ❌ **NEVER pass per-collection accent/icon classes on form list cards**: Use `FormListFieldCard` primary defaults.

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
- [ ] FormModal props follow the shell contract (saving / saveDisabled / error / isDirty — no isSubmitting/onSubmit)
- [ ] Identity-based reset proven by a create→edit→create spec (no stale draft)
- [ ] Double-submit guard in place (useFormSubmission / useSubmitGuard) and await-before-close
- [ ] Server field errors mapped onto the same keys as Zod errors; non-field failure in the banner; draft retained
- [ ] Mutation onSuccess invalidates list/detail/widget/lookup/report keys before close
- [ ] isDirty / discard confirm wired for mutating forms (exemption recorded with a reason)
- [ ] Control decision table followed (no parallel chrome)
- [ ] Repeatable rows use FormCollectionShell + FormListFieldCard + FormAddAnotherButton with stable keys
- [ ] Discriminative row headers use FormCardTypeSelect; form cards use primary stripe defaults
- [ ] Field wires label / aria-invalid / aria-describedby; first invalid tab activated before focus
- [ ] Virtual keyboard hints provided (inputMode, enterKeyHint, autoComplete)
- [ ] Paste strictly enabled on all fields including OTP/passwords (WCAG 2.2 3.3.8)
- [ ] Non-punitive validation UX (validate on blur or submit attempt; text-wrap: pretty)
- [ ] Touch targets meet 44×44px floor (min-h-11 min-w-11)
- [ ] No Server Actions or form action= posts
- [ ] Shared Zod write schema validates inputs strictly (.strict())
- [ ] Dates validated with isoDateSchema / isoDateOrEmptySchema
- [ ] Active foreign keys verified (deleted_at IS NULL)
- [ ] Uploads: tenant-scoped path, owning module action gate, relative attachment URL whitelist
- [ ] Attachment removal unlinks only after the save commits and no row references the file
- [ ] Focus-return restored to opener on dialog close
- [ ] Inventory regenerated; pnpm run check:forms green with no baseline increase
- [ ] Run: pnpm typecheck && cd apps/frontend && pnpm lint
```

## References

- [TemplateFormModal.tsx](./examples/TemplateFormModal.tsx) — the canonical create/edit form (identity reset, guarded submit, server-error mapping, dirty guard, i18n copy).
- [form-audit-checklist.md](./references/form-audit-checklist.md) — inventory manifest schema, severity rubric, finding format, per-module sweep matrix.
- [form-collection-patterns.md](./references/form-collection-patterns.md) — repeatable collection recipes, stable rows, payload sanitization, Zod/API error mapping.

## Related skills

`mms-fields-registry`, `mms-module-page`, `mms-frontend`, `mms-shared-package`, `mms-query-factories`, `mms-a11y-smoke`, `mms-i18n-completeness`.
