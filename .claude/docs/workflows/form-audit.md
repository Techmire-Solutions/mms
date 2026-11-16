---
description: Inventory every form surface, audit it against the canonical FormModal contract, fix lifecycle/collection/UI/i18n/a11y defects module by module, and close with the full verification gate.
---

# Workflow: Form Architecture Audit & Remediation

Executable form of the seven-phase form audit. The owning rule is the norm SSOT
(`rules/mms-form-architecture.md`); this workflow is the procedure and the gates.
If they disagree, the rule wins and this file needs fixing.

**Contract reminder (do not invent props):** the shell is `FormModal` with
`open`, `onSave`, `saving`, `saveDisabled`, `error`, `isDirty`, `dirty`-discard copy.
There is no `isOpen`, `isSubmitting`, or `onSubmit` prop. "Submit is disabled while
pending" means `saving={mutation.isPending}` plus `saveDisabled` when the draft is
invalid — never a locally invented `isSubmitting` state.

**Do not** re-audit by reading all 356 form-like files in one pass. Phase 1 produces
a machine inventory; every later phase works from it.

## Phase 1 — Inventory & architecture gap analysis

- [ ] Load the rule and the skill: `rules/mms-form-architecture.md`,
      `skills/mms-form-architecture/SKILL.md`,
      `skills/mms-form-architecture/examples/TemplateFormModal.tsx`,
      `skills/mms-form-architecture/references/form-collection-patterns.md`,
      `rules/mms-dry.md`.
- [ ] Generate the manifest (do not hand-write it):
      `pnpm run forms:inventory` → `docs/forms-inventory.md`.
- [ ] Classify every surface: modal, drawer, inline editor, wizard step, or setup panel.
- [ ] Diff the manifest against the previous snapshot; every new surface needs an owner.
- [ ] Record gaps per module in `docs/forms-audit-2026-11-16.md` using the finding format in
      `skills/mms-form-architecture/references/form-audit-checklist.md`.

**Exit gate:** manifest regenerated, no `inventoryDrift`, severity triage done.

## Phase 2 — Lifecycle, reset, submission, cache

For every write surface from Phase 1:

- [ ] Identity-based reset: reopening on a different record must not inherit the previous
      draft (`useIdentityReset` / `useZodDraftForm.resetDraft`).
- [ ] Double-submit guard: `useSubmitGuard` / `useFormSubmission`; no synchronous re-entry
      and no `void mutate(`.
- [ ] `saving={mutation.isPending}`; close only after `mutateAsync` resolved.
- [ ] Server errors: `mapApiFormError` → field errors + the modal's `error` banner;
      non-field failures keep the modal open with the draft intact.
- [ ] Invalidation: every affected list, detail, widget, and lookup key invalidated before close.
- [ ] Dirty state: Cancel/Close respects `isDirty` (discard confirm), failed saves keep input.

**Exit gate:** `pnpm run check:forms` baselines not increased; each fixed surface has a
create/edit/reset/validation spec (`skills/mms-testing-e2e/SKILL.md`).

## Phase 3 — Dynamic collections & field registry

- [ ] Repeatable rows use `FormCollectionShell` + `FormListFieldCard` (+ `CardRemoveButton`)
      + `FormAddAnotherButton`; `FormCardTypeSelect` for discriminative headers.
- [ ] Stable row identity (`useStableRowList` / row uuid) — index keys are test-banned.
- [ ] Empty optional rows stripped before submit; `null` / `undefined` / `""` / numeric /
      date coercion matches the shared write schema.
- [ ] Custom fields, blueprint validations, and dynamic tabs resolve metadata, defaults, and
      rules through `rules/mms-fields.md` (skill `mms-fields-registry`) — no local allowlists.

**Exit gate:** `formCollectionKeys.test.ts` green with no new allowlist entries;
`docs/forms-inventory.md` shows every collection surface on the shared triad.

## Phase 4 — Shared UI primitives, layout, footers

- [ ] No raw `<input>` / `<select>` / `<textarea>` / `<button>` / `<label>` in form files
      (enforced by `formUiPrimitives.test.ts`); native file/hidden inputs are the only exception.
- [ ] Label placement, required `*`, hint text, inline error styling, and `space-y-3` bodies
      match `TemplateFormModal.tsx`.
- [ ] Footer order: Cancel at the start, primary submit at the end; destructive actions never
      occupy the primary slot; one spinner source (`saving`).
- [ ] `pnpm run check:shared-ui` and `node .agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs`
      are clean.

**Exit gate:** both shared-UI checks clean; no new primitive duplicates.

## Phase 5 — BiDi, i18n, accessibility

- [ ] Zero hardcoded titles/labels/placeholders/validation copy/toasts in form files — all
      keys exist in en/ar/ur/fa (`pnpm run check:i18n`).
- [ ] Logical directional classes only (ESLint `mms-bidi` authoritative;
      `node .agent/skills/mms-ui-ux-design/scripts/check-bidi-classes.mjs` for a text sweep).
- [ ] Every control has a programmatic label; inline errors are wired with `aria-invalid`
      and `aria-describedby`.
- [ ] Tab order, initial focus, focus restore on close, Enter/Escape behaviour verified.
- [ ] `bash .agent/skills/mms-a11y-smoke/scripts/smoke-a11y.sh full` clean for touched shells.

**Exit gate:** `check:i18n`, `check:i18n-unused`, BiDi, and axe all clean.

## Phase 6 — Domain sweeps (module by module)

Run one sweep at a time; never re-audit across module boundaries in one context.

| Sweep | Modules | Owning skill | Extra reads |
|---|---|---|---|
| 6A | Contacts, Admissions / Student Lifecycle | `mms-student-lifecycle` | `CONTACTS_AUDIT.md`, `CONTACTS_FUNCTIONAL_QA_REPORT.md`, `CONTACTS_ACCESSIBILITY_REPORT.md` |
| 6B | Accounting, Finance | `mms-finance-accounting` | `references/ledger-controls.md`, `references/policies-2026.md` |
| 6C | Attendance, Academic Catalog/Calendar, Faculty | `mms-faculty-domain`, `mms-student-lifecycle` | timezone/FK/upload rules |
| 6D | Messaging, Notifications, Document Templates, Reports, Users/Settings, Platform | `mms-messaging`, `mms-document-templates`, `mms-reports-export`, `mms-user-management` | `scripts/verify-template-tokens.mjs`, `references/document-template-checklist.md` |

Per sweep: frontend schemas must match the backend route contract; fix the findings the
domain reports already record; run the module's unit/integration tests.

## Phase 7 — Final verification & regression gate

- [ ] `bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh`
- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm --filter mms-frontend test`
- [ ] `pnpm run check:forms` (baselines non-increasing)
- [ ] `node scripts/ci/check-ratchet-baselines.mjs --base <base>` — see
      `skills/mms-ci-ratchets/references/ratchet-remediation-guide.md`
- [ ] Playwright form smoke: `pnpm --filter e2e-tests exec playwright test tests/tenant/form-smoke.spec.ts`
      (extend it with the fixed forms' create/edit/validation/reset flows)
- [ ] Adversarial self-review with `skills/mms-code-review/references/adversarial-audit-template.md`;
      every finding fixed or recorded with an owner.
- [ ] Re-run the inventory and `git diff docs/forms-inventory.md` — zero drift.
- [ ] Standards sync: `bash .agent/scripts/sync-all.sh` + `node scripts/verify-rules-integrity.mjs`
      + `node scripts/check-docs.mjs`.

**Exit gate:** all gates green, every finding closed or deferred with a reason, audit doc dated.

---

> [!CAUTION]
> A form is not "done" because it renders. It is done when it cannot lose data, cannot
> double-post, cannot show a stale draft, and cannot fail silently.
