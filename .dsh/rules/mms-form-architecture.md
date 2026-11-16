---
trigger: model_decision
description: FormModal shell, Zod form validation, decimal currency formatting, and form lifecycle hooks
---

# MMS Form Architecture

**Workflow skills:** form authoring → `mms-form-architecture` · form inventory & lifecycle audit → `/form-audit` (workflow `form-audit`) · modern web guidance → `modern-web-guidance` · form UX guidelines → `ui-ux-pro-max` · shell a11y & focus-return → `mms-a11y-smoke`.
**Page boundary:** Work directory / DetailSheet / FormModal triad → `mms-module-architecture.md` + skill `mms-module-page`.

## 1. FormModal Shell & Primitives
- **Modal Scoping:** Use `FormModal` for create, edit, and builder flows; raw `Modal` restricted to confirm/preview dialogs. Shell manages header, icon, subtitle, tabs, progress, focus trap, and focus return on dismiss.
- **Input Primitives & Tokens:** Inputs use `min-h-11 min-w-11` (`FORM_INPUT`). Cards use `FORM_CARD`; builders use `FORM_INPUT_BUILDER`. Inline errors use `FieldErrorMessage` + `FORM_ERROR`.
- **Field Primitives:** Standardize on `Input`, `Textarea`, `Checkbox`, `FormSelect`, `FormSelectWithQuickCreate`, `DatePicker`, `TimePicker`, `DateTimePicker`, `EditableSelect`. Currency requires text `inputMode="decimal"` (ban `type="number"`). Phone uses `type="tel"` with E.164 normalization. Calendar is Gregorian only.
- **Control decision table (SSOT):** Pick exactly one control family — do not invent parallel chrome:
  - Enum / filter → `FormSelect`
  - String tenant lookup → `EditableSelect` + `onUpdateOptions`
  - Entity catalog FK + existing create `FormModal` → `FormSelectWithQuickCreate` (Plus → nested catalog modal → auto-select new ID; gate Plus with write permission). Applies to faculty dept/desig/pos, org position FKs, Wakala mujtahid/rep, obligation type/rep, QB `bookId`, accounting `account_id` legs. Ban one-off Plus+`FormSelect` chrome.
  - Person search → `ContactPicker` / `RegistryPersonSelect` (ban full embedded forms)
  - Chips / categories → `CategorySelector` / `FormTagsInput`
  - Discriminative row-header control → `FormCardTypeSelect` in `FormListFieldCard.typeSelect`
  - Repeatable draft rows → `FormCollectionShell` + `FormListFieldCard` + `FormAddAnotherButton`
- **Scroll & Viewport:** Tabbed forms use `<FormModal tall>` (`max-h-[43.75rem]` + `flex-1 overflow-y-auto`). Use `dvh`/`svh` (+ safe area) over `vh`. Apply `useBodyScrollLock()` + `overscroll-contain` on scrollable modal bodies.
- **Action footer is owned by the shell:** `FormModalFooter` renders Cancel at the start and the primary submit at the end; a destructive choice never occupies the primary slot. Pass `cancelLabel` / `saveLabel` / `saveVariant` instead of composing a second footer. `hideFooter` is for builder/file-preview surfaces only.
- **One error banner only:** the shell renders `FormErrorBanner` from `error` + `onSelectError`. Rendering a second banner inside the body is banned; field errors stay inline under their control.
- **Layout & Structure:** Enforce single-column flows (`COLLECTION_BODY`) inside `space-y-3`. Multi-column sections use CSS Subgrid or `@container` queries. Enabled registry fields must render (ban hardcoded allowlists). Client-side dynamic form compilers are banned. Gate entry and save CTAs with `canWrite`.

## 2. State & React 19 Standards
- **Modern Web Form Standards:** Follow `modern-web-guidance` guides (`forms`, `validate-input-after-interaction`, `brand-consistent-forms`, `required-field-feedback`, `ime-safe-enter-submit`, `sms-otp-form`, `autofill-highlight-inputs`). Standardize `inputMode`, `autoComplete`, IME-safe Enter submission (`isComposing`), and dynamic height with `field-sizing: content` on `Textarea` (`form-fields-automatically-fit-contents`).
- **State Management:** Controlled state (or RHF + zodResolver for complex wizards) validated against `@mms/shared` Zod schemas. RSC `"use server"` actions and native `action=` submissions are banned.
- **Draft lifecycle (create vs. edit):** Define an edit-session identity (record id, or `"create"`). Reset the draft and error map when the identity or `open` changes — `useIdentityReset` or `useZodDraftForm.resetDraft`; a background refetch must never overwrite dirty input, and a failed save must keep the draft. Hydrate edit defaults from the Query cache to prevent empty flashes.
- **Dirty state:** Track the baseline (`useDirtySnapshot` / `useZodDraftForm.isDirty`) and pass `isDirty` to `FormModal` so Cancel/Close/Escape ask before discarding. A dirty form must never close silently from a footer Cancel.
- **Submission:** Use one guarded path — `useFormSubmission` for shell forms, `useSubmitGuard` where a form keeps its own state. The guard must be synchronous (double click / Enter+click in the same frame) and must `await mutateAsync` before `onClose`. Ban `void …mutate(` inside form handlers.
- **Pending & disabled binding:** the shell has `saving` / `saveDisabled` — bind `saving={mutation.isPending}` (or the guarded hook's `submitting`), and set `saveDisabled` from schema validity, not from a local duplicate of the mutation state. There is no `isSubmitting`, `isOpen`, or `onSubmit` prop; do not invent one.
- **Server error mapping:** map field-level contract errors with `mapApiFormError` onto the same field keys the Zod map uses, and surface a non-field failure through the modal's `error` banner while keeping the modal open. A 409 (stale write / duplicate) gets conflict-specific copy, not a generic toast.
- **Form Controls & A11y:** Initialize fields (`""` for strings, `[]` for arrays) to prevent uncontrolled warnings. Controls require `name` and `id` (`useId()` fallback + `<label htmlFor={id}>`). React 19 native `ref` on custom controls (ban `forwardRef`).
- **Semantic Hints:** Mobile hints mandatory: Currency (`inputMode="decimal"`), Phone (`type="tel" inputMode="tel" autoComplete="tel"`), OTP (`inputMode="numeric" autoComplete="one-time-code"`), Email (`type="email"`).
- **Zero-Block Paste:** Never block clipboard paste on OTP, 2FA, or password fields (`onPaste` prevention banned).

## 3. Collection List Tabs (Child & Junction Tables)
- **Authoritative Arrays:** Pre-populate one empty row; strip blanks before save via `cleanContactDraft`. Empty array is authoritative (`[]` clears all child rows, never omitted).
- **Edit Merge:** Merge on edit save via `mergeContactEditSavePayload`: draft collections + scalar sync win over spread contact. Clear legacy `relationships: []` when `relationshipContacts` is emptied.
- **Hydration & Sync:** `normalizeContactForEdit` hydrates scalars only when array is omitted; never overwrite explicit `[]`. Offline sync (`mergeContactForSync`) applies arrays as-is.
- **Add-another SSOT (required):** Repeatable form collections use `FormCollectionShell` + `FormListFieldCard` (+ `CardRemoveButton`) + `FormAddAnotherButton` from `FormPrimitives`. Applies to contacts phones/emails, faculty designation holdings, question-bank matching/ordering/citations, Wakala distribution rows, journal entry lines, paper sections, class fee/schedule/budget row editors, and any new multi-entry form list. Ban one-off `Button`+`Plus`, ad-hoc dashed borders, or `SectionCard` wrapping list cards. `ContactSubListShell` is a thin adapter over `FormCollectionShell`. Label the append control with a short noun (e.g. “Phone Number”, “Designation”). `SectionCard` remains valid for non-list form *sections* (identity blocks).
- **Accounting exception:** Journal desktop lines stay a dense **table** inside `FormCollectionShell` (not `FormListFieldCard` rows). Mobile journal lines keep `FormListFieldCard`. Nested paper-section questions may stay compact chips inside a section card; only top-level sections use the collection SSOT.
- **Collection title hierarchy:** Show exactly one collection identity — (1) named FormModal tab → omit shell title; (2) all-sections / non-tab layout → optional plain `FormCollectionShell` title/icon; (3) row header never repeats the collection noun — prefer `FormCardTypeSelect` in `typeSelect` (contacts Type, faculty holding status) or a sequence label only when there is no type control.
- **Stable row identity:** every repeatable row carries a stable id (`crypto.randomUUID()` at add time, or the server id on hydrate) consumed by `key`; `useStableRowList` / the row-key helper owns add/remove/reorder. Index (`key={index}`) and index-derived template keys are banned — they swap input state and drop focus on reorder/remove (`formCollectionKeys.test.ts` is the gate; an allowlist entry needs a written reason).
- **Payload sanitization:** strip unused optional blank rows before submit instead of sending `""` rows; coerce per the write schema — empty optional text is `undefined` (or the schema's declared default), never `null` unless the DTO allows it; nullable numeric/date fields normalize `""` → `null` and empty-number → `undefined`; money stays a decimal string. Validate the normalized payload, not the raw draft.
- **Form list-card chrome:** Use `FormListFieldCard` default primary stripe/icon only — no override props. Ban per-collection accent/icon classes on form rows. Row header density: icon tile → `FormCardTypeSelect` (when discriminative) → optional `headerExtras` → trash when `canRemove`.
- **Form-root spacing:** Modal/tab bodies use `space-y-3`. Keep `space-y-6` only between peer collection shells on the same surface.

### 3.1 Contact-Linked Module Writes (Students & Faculty)
- **Identity Normalization:** When `contactId` exists, strip `CONTACT_PROFILE_FIELDS` and guardian triad writes via `normalizeContactLinkedRecord`. Do not duplicate person profile on module domain table.
- **Boundary:** Edit forms show hydrated contact fields; save payload links by ID (Contacts owns person identity). Soft-delete and module fields (status, GR) remain on domain row.

## 4. Write vs Read Zod Schemas
- **Write DTO Hygiene:** Write schemas (POST/PUT) omit server-owned fields (`deletedAt`, `deletedBy`, `deletionReason`). Enforce `.strict()` on all write DTOs.
- **Active FK Guarding:** Validators and forms assigning foreign keys (`contactId`, `sessionId`, `facultyId`) must verify referenced entities are active (`deleted_at IS NULL`) (`mms-data-layer.md` §6).
- **Error Mapping & Hydration:** Map Zod issues via the single `mapZodFormErrors` implementation (`apps/frontend/src/lib/forms/mapZodFormErrors.ts`, imported as `@/lib/forms/mapZodFormErrors`) to `t()` keys (ban per-form issue switches). Map server field errors with `mapApiFormError` (`@/lib/forms/serverFormErrors`). Decimal strings for money, E.164 for phones. Hydrate edit defaults from Query cache to prevent empty flashes.
- **Mutation & cache contract:** A form save goes through the owning query factory's mutation (`mutationOptions`) and uses `mutateAsync`; its `onSuccess` invalidates every affected list, detail, widget, lookup, and report root before the modal closes. Closing first and invalidating later is banned — it shows stale rows and can resurrect a deleted record in the directory.
- **Read-Only Projections:** System-managed values (derived tags, computed status/provenance) render as locked read-only chrome, never as editable controls or lookup options. A draft may carry the read projection, but the write DTO strips it; editing the record must preserve the server-owned rows rather than dropping them.

## 5. RTL, Styling & Validation UX
- **Logical CSS:** Use logical Tailwind (`start-0`, `border-e`, `ms-auto`, `ps-4`).
- **Field accessibility wiring:** every control has a programmatic label (`Field` `htmlFor`/`id`, or `aria-labelledby`); inline errors are connected with `aria-describedby` and the control sets `aria-invalid` while its error is shown. Error summaries complement inline errors and stay operable (`onSelectError` jumps to the control).
- **Non-Punitive Validation:** Trigger inline errors on `onBlur` or post-submit (`isSubmitted`), not during keystrokes. Use `:user-invalid`/`:user-valid`. Error copy uses `text-wrap: pretty`. Auto-focus first invalid tab and field on submit failure — activate the owning tab before moving focus.
- **Form UX Intelligence:** Query UI/UX Pro Max form guidelines (`python3 .agent/skills/ui-ux-pro-max/scripts/search.py "form validation error" --domain ux`, skill `ui-ux-pro-max`) for accessible error summaries, visible focus rings (`focus-visible:ring-2`), and resilient label wrapping.

## 6. Security & Upload Boundaries
- **Isolation:** Tenant writes enforce transaction-scoped RLS (`SET LOCAL app.current_tenant`). Platform writes require `authenticatePlatform` + `platformUserCan`.
- **Multipart Uploads:** Authenticated multipart to `/api/uploads/image` or `/attachment` (disk storage via `resolveApiUrl`). Enforce magic-byte sniff, MIME allowlist, and dimension limits (`mms-auth-security.md`).
- **Upload Lifecycle:** Tenant sessions read only `tenants/<tenant>/…`; root-level non-public files are platform-only. Upload/delete requires the owning module action (e.g. `contacts.write`), not just a session. New/changed attachment URLs must be relative tenant attachment paths; unchanged legacy absolute URLs are grandfathered. Unlink after the DB save commits and only when no row still references the file; a reconciler sweeps orphans (`mms-module-architecture.md` §5).

## 7. FormModal vs DetailSheet Boundary
- **FormModal:** Exclusively owns write mutations, create, edit, builder workflows, and data modifications with shared Zod validation.
- **DetailSheet:** Exclusively owns read-only inspection, archive callouts, quick actions, and audit metadata via `EntityDescriptor<T>` (`mms-ui-ux-design.md` §6). Never embed edit forms in DetailSheet.

## 8. Form Audit, Inventory & Ratchet
- **Inventory is generated, never hand-written:** `pnpm run forms:inventory` writes `docs/forms-inventory.md` from the source tree (`scripts/check-form-architecture.mjs --inventory`). A stale snapshot fails `pnpm run check:forms`; every new form surface appears in the diff and needs an owner.
- **The audit procedure is the workflow:** `/form-audit` (`.agent/workflows/form-audit.md`) runs inventory → lifecycle → collections → UI → i18n/a11y → domain sweeps → regression gate. `docs/forms-audit-2026-11-16.md` records findings with severity, fix, and test; a finding is closed only when its spec exists.
- **Machine-enforced subset:** `pnpm run check:forms` (contract/lifecycle ratchet with `BASELINE` constants that may only decrease), plus `apps/frontend/src/lib/forms/formContractArchitecture.test.ts`, `formUiPrimitives.test.ts`, and `formCollectionKeys.test.ts` (raw controls, index keys, fire-and-forget saves, legacy store use). Adding an allowlist entry requires a written reason in the same change.
- **Advisory subset:** copy quality, helper/footer consistency, and "does this form need a dirty guard" are review judgement, recorded in the audit doc rather than guessed by a regex.

