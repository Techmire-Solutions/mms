# Form Architecture Audit

**Date:** 2026-11-16 · **Scope:** every form surface in `apps/frontend/src` — FormModal
consumers, raw modal/drawer forms, inline form files, wizard steps, and setup panels —
plus the agent standards that govern them.

**Method:** the `/form-audit` workflow (`.agent/workflows/form-audit.md`), which is the
executable form of the original seven-prompt suite. The inventory is generated
(`docs/forms-inventory.md`), never hand-written.

## Baseline (measured when the audit opened → ratchet today)

| Signal | Opened | Now | Note |
|---|---:|---:|---|
| Form-like `.tsx` files | 213 | 214 | generated inventory (extraction added one dialog file) |
| Files with a `<FormModal>` (tags) | 73 | 73 (74 tags) | one file renders two shells; signals inspect the first tag |
| Write surfaces (`<FormModal` + `onSave`) | 69 | 69 | |
| Write surfaces without `saving` | 6 | **0** | 5 were synchronous local actions (declared exemptions with reasons in the script); `QuestionSourceBooksSection` was a real async save → fixed |
| Write surfaces with no in-flight submit binding | 45 | **0** | the gated signal is "an async save with no pending state bound to `saving`"; a **synchronous** guard is advisory (see D6) |
| Write surfaces with an editable draft but no `isDirty` | 40 | **0** | all editable drafts guarded; 3 forced/credential prompts are declared exemptions with reasons (`scripts/lib/form-exemptions.mjs`) |
| Stateful row collections using an index key | 1 | **0** | gate narrowed to `FormListFieldCard` / `useStableRowList` rows (the one hit was a static error list, where index keys cannot corrupt input state) |

## Standards findings (closed in the same change)

| # | Finding | Fix |
|---|---|---|
| S1 | Rule said Zod issues map via `mapZodFormErrors` **in `@mms/shared`**; the only implementation is `apps/frontend/src/lib/forms/mapZodFormErrors.ts`. | Rule §4 corrected to the real path; server-side mapping named (`mapApiFormError`). |
| S2 | The canonical lifecycle toolkit (`useFormSubmission`, `useSubmitGuard`, `useIdentityReset`, `useDirtySnapshot`, `useStableRowList`, `mapApiFormError`) was named in no rule or skill, so adoption was optional; `useFormSubmission` had zero adopters. | Rule §2 states the lifecycle contract and names every helper; `pnpm run check:forms` tracks adoption. |
| S3 | `check-shared-ui.mjs` existed twice with divergent banned-primitive lists (the skill copy was missing ~13 names). | Skill script is the single implementation; the root script delegates to it. |
| S4 | Three static form guards (`formContractArchitecture`, `formUiPrimitives`, `formCollectionKeys`) ran in CI but were missing from the enforcement registry. | Registered in `.cursor/rules/README.md`. |
| S5 | Rule index claimed 21 scoped / 23 total rules; disk has 22 / 24. | Corrected. |
| S6 | The canonical `TemplateFormModal.tsx` taught hardcoded English copy, rendered a second `FormErrorBanner` although `Modal` already renders one from `error`, and its dirty guard reported every edit-open as dirty because the reset is scheduled during render. | Example rewritten: `AppTranslationKey` copy props + `translateValidationMessage`, shell `error` only, and `useDirtySnapshot(draft, identity, resetDraft)` with a regression test (`useDirtySnapshot.test.tsx`). |
| S7 | No workflow, command, inventory artifact, or form ratchet encoded the seven-prompt suite. | `/form-audit` workflow + both command wrappers + `scripts/check-form-architecture.mjs` + `docs/forms-inventory.md`. |
| S8 | `form-collection-patterns.md` had no empty-row stripping / `null` vs `undefined` vs `""` guidance. | New section in the reference. |
| S9 | `mms-a11y-smoke` covered focus trap/return but not field-level `aria-invalid` / `aria-describedby`. | Procedure + checklist extended. |

## Module findings

Discovery and remediation results per module are recorded here as the sweeps close.
Rows are `# | Sev | Finding | Fix | Status`: the Finding names `file:line` and the owning
rule section; a `closed` row names its spec. Statuses are never `closed` on a manual claim
alone.

### Contacts / Admissions (sweep 6A)

| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| 6A-1 | P1 | `BudgetAddModal` routed the native Enter submit straight to the raw parent save, bypassing the try/catch wrapper passed to `FormModal`; a failed budget save produced an unhandled rejection and an empty banner. | One `handleSave` (guarded, awaited) for both the footer and `<form onSubmit>`; localized fallback copy. | closed (spec: BudgetAddModal.test.tsx) |
| 6A-2 | P1 | The enrollment wizard's `FormModal` had `hideFooter` and no `saving`, so the modal stayed dismissible while the create-enrollment POST was in flight. | `EnrollmentWizard` reports `submitting`; the layer binds `saving` (shell becomes non-dismissible + busy). | closed (spec: EnrollmentWizard.test.tsx + EnrollmentWizardFooter.submitting.test.tsx) |
| 6A-3 | P1 | Contact create had no synchronous re-entry guard: the footer and the form's Enter path both called `handleSave`, and each call mints a fresh `uuidv7()` — two contacts from one double submit. | `useContactFormSave` wraps its save in a ref guard (set before the first await); `useZodDraftForm` gained the same guard for every adopter. | closed (spec: useContactFormSave.test.tsx) |
| 6A-4 | P2 | The student form's non-field save failures only toasted; the shell banner stayed empty. | `studentFormSaveFlow` now carries `setFormError` from `mapApiFormError`, and `StudentForm` renders it alongside the validation summary. | closed (spec: studentFormSaveFlow.test.ts) |
| 6A-5 | P2 | Contact save failures without field keys were only toasted; the modal banner stayed empty. | The save hook now exposes `formError` and `ContactForm` passes it to the shell banner (the parent write action keeps its toast). Conflict-specific copy is still generic. | closed (spec: useContactFormSave.test.tsx) |
| 6A-6 | P2 | `EnrollmentOperationModal` (withdraw/transfer/readmit/suspend) submits unguarded from Enter. | `submit` runs through `useSubmitGuard` with a `!canSave` early return; the Enter handler no longer pre-checks validity. | closed (spec: EnrollmentOperationModal.test.tsx) |
| 6A-7 | P2 | Changing the avatar in the student draft immediately mutates the linked contact, so cancelling the form still commits part of the draft. | The avatar is held as a pending URL; a confirm dialog states it updates the linked contact immediately and only then writes. | closed (spec: StudentForm.avatar.test.tsx) |

### Finance / Accounting (sweep 6B)

| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| 6B-1 | **P0** | The simple-transaction wizard mints its client voucher id once per component mount, but the wizard stays mounted between openings: every later collection reused the first id, so the server either treated a genuine second collection as an idempotent replay (silently dropping it) or refused it as an immutable posted entry. | Re-mint `sessionEntryIdRef` on every `open` transition; regression test posts twice across a close/reopen and asserts distinct ids. | closed (spec: SimpleTransactionWizard.test.tsx) |
| 6B-2 | P1 | `SpecializedEntryModal` (fee/salary) posts ledger entries with no synchronous guard — same-frame double click = two entries. | Both modals wrap the submit in `useSubmitGuard`. | closed (spec: SpecializedEntryModal.test.tsx) |
| 6B-3 | P1 | `AccountingFiscalYearModal` / `CloseFiscalYearModal` had state-only guards and irreversible actions (year close). | Both wrap the save in `useSubmitGuard`; `saving` already bound. | closed (spec: AccountingFiscalYearModal.guard.test.tsx + CloseFiscalYearModal.test.tsx) |
| 6B-4 | P1 | `InvoiceCorrectionActions` credit-note had no ref guard (same-frame double click = two credits) and cancel-invoice closed the dialog before the ledger mutation resolved. | Both actions route through `useSubmitGuard`; the cancel confirm now awaits `handleCancel()` and stays open when it returns `false`. | closed (spec: InvoiceCorrectionActions.test.tsx) |
| 6B-5 | P2 | `PaymentForm` pre-fills the amount from a raw float subtraction (`String(balance)`), producing `"800.1999999999999"` which fails the decimal regex and permanently disables Save. | Balance derived in integer cents and passed as a 2-dp decimal string; 1200.30/400.10 now pre-fills `"800.20"`. | closed (spec: PaymentForm.test.tsx) |
| 6B-6 | P2 | `JournalReverseDialog` validates only the fiscal year, so a closed monthly posting period is rejected by the server as a toast with no field error. | `postingPeriods` flow into the dialog state; a closed period blocks `buildRequest` and shows `errorClosedPostingPeriod` under the date. | closed (spec: JournalReverseDialog.test.tsx) |
| 6B-7 | P2 | Journal validation errors on a blank added line instead of stripping it, blocking Save draft and Post. | Fully blank lines are skipped by validation and filtered from the save candidate. | closed (spec: journalEntryBlankLines.test.ts) |
| 6B-8 | P2 | Wakala allows any split ≤ 100 % although the server requires exactly 100 %. | Step-3 Save requires exactly 100 % and surfaces the existing incomplete-split copy. | closed (spec: WakalaFormModal.test.tsx) |
| 6B-9 | P2 | Fee-structure item amount coerces unparseable input to `0` and saves a zero-value item. | A named item now requires a parseable positive amount with an inline error; no silent zero is saved. | closed (spec: FinanceFeeStructuresSection.test.tsx) |

### Attendance / Academic Catalog / Faculty (sweep 6C)

| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| 6C-1 | P1 | `EnterMarks` re-seeded the marks grid when the `exam` **object** identity changed, so any list refetch wiped typed grades and the section filter. | Re-seed keyed on `exam.id`; a same-exam refetch no longer touches the draft. | closed (spec: EnterMarks.test.tsx) |
| 6C-2 | P1 | The examination form offered classes from terminal sessions — the first fix excluded only archived/cancelled while the shared helper also treats **completed** as read-only (backend has no session-status guard on `classIds`). | Filter via the shared `isSessionReadOnly` (completed/cancelled/archived). | closed (spec: examinationClassOptions.test.ts) |
| 6C-3 | P2 | Hasanat and question-bank invalidators missed the dashboard summary root, leaving dashboard KPIs stale after a write. | `createModuleQueryInvalidator` gained a documented `dashboard` key; both modules use it, tests assert it. | closed (spec: hasanat + question-bank invalidator tests) |
| 6C-4 | P1 | Mark-attendance footer had no in-flight binding; Save Draft/Submit stayed clickable while the roster upsert and day submit were pending. | The persistence hook exposes `saving` (ref-guarded before the first await); both footer buttons disable while it is true. | closed (spec: MarkAttendanceActions.test.tsx + useMarkAttendancePersistence.test.tsx) |
| 6C-5 | P2 | Attendance lifecycle decisions clear the confirm target **before** awaiting the mutation, so a failed approve/reject loses the typed note. | The target is cleared (and `true` returned) only after the mutation resolves; rejection keeps the dialog and note. | closed (spec: AttendanceLifecyclePanel.test.tsx) |
| 6C-6 | P2 | `QuestionForm` has no `isDirty` (silent discard) and drops server `fieldErrors` into a banner only. | `isDirty` from RHF with discard copy; server `fieldErrors` are set on the matching RHF paths. | closed (spec: QuestionForm.draftLifecycle.test.tsx) |
| 6C-7 | P2 | Inline attendance record edit still reports validation only as a toast (prior audit F13 remains open). | `editingRecordError` is rendered inline in the desktop editing row and the mobile card; edit mode is preserved. | closed (spec: useAttendanceRecordsState.test.tsx + AttendanceListDesktopTable.test.tsx) |
| 6C-8 | P2 | A failed question-media attach leaves the uploaded file orphaned (no unlink). | The uploaded URL is unlinked (`deleteAttachmentFile`) when the attach call fails. | closed (spec: QuestionMediaSection.test.tsx) |
| 6C-9 | P2 | Hasanat create defaults use device-local `todayISO()` instead of the workspace day. | Distribute/Redeem/Stock defaults and the attendance export month use `useWorkspaceToday()`. | closed (spec: moduleWorkspaceDay.test.ts) |
| — | — | Prior attendance audit (2026-11-11) F1–F5, F7, F9–F12 re-verified as holding; F6 is only partly fixed (see 6C-9); the calendar-form test follow-up is now present. | — | verified |

### Messaging / Templates / Reports / Users / Settings / Platform (sweep 6D)

| # | Sev | Finding | Fix | Status |
|---|---|---|---|---|
| 6D-1 | P1 | Users bulk-message resolved recipients by intersecting the **current page** with the cross-page selection, silently dropping recipients selected on earlier pages. | Selected row snapshots are retained across page changes and pruned only when deselected. | closed (spec: UsersList.test.tsx) |
| 6D-2 | P1 | Widget drill-down hard-deleted a Hasanat distribution on one click with no confirmation, and the persistence used `apiFetch` (resolves on 4xx), so a rejected delete looked successful. | Destructive `ConfirmAlertDialog`; `apiJson` (throws); invalidates distributions + metrics + report aggregates. | closed (spec: WidgetDrilldownModalRecords.test.tsx) |
| 6D-3 | P1 | The permission matrix re-seeded only on role **id**, so after saving the same role the matrix showed — and re-saved — the pre-save grants. | Seed identity is the role id **plus** its persisted permissions payload. | closed (spec: useRolesPermissionDraft.test.tsx) |
| 6D-4 | P1 | `EditUserModal` toasted every failure and never mapped server field errors into the shell banner. | `mapApiFormError` → `form.setError` per field + banner; guarded submit. | closed (spec: EditUserModal.test.tsx) |
| 6D-5 | P2 | `verify-template-tokens.mjs` proved nothing: it resolved a non-existent schema path, kept a stale hardcoded 11-token list, and always exited 0. The runtime scanner also missed brace placeholders outside `[a-z_]`, so `{Invoice Number}` was saved and shipped literally. | Verifier reads the real allowlist and shipped defaults, accepts `--text/--file`, exits non-zero; runtime pattern broadened; tests added. | closed (spec: messagingUtils.test.ts + verifier CLI) |
| 6D-6 | P2 | Saved-report delete fires immediately (no confirm). | Destructive confirm owned by `SavedReports`, with report-scoped copy keys; `deleteReport` runs only on confirm. | closed (spec: SavedReports.test.tsx) |
| 6D-7 | P2 | Users Preferences rendered two `ModuleSetupSaveFooter`s for one draft. | Closed by the cross-cutting footer sweep (F6). | closed (spec: moduleSetupFooters.test.ts) |
| 6D-8 | P2 | Theme save persists the whole branding record, committing unsaved Institution-tab edits. | New theme-scoped merge helpers + `handleSaveTheme`; theme save no longer persists identity fields. | closed (spec: brandingIdentityDraft.test.ts + useThemeSettingsDraft.test.tsx) |
| 6D-9 | P2 | Composer "select all" only adds the current 50-row page; `matchRecipients` is never called. | Select-all calls `matchRecipients` with the current filters, dedupes, caps at the match limit, and reports truncation/failure. | closed (spec: TenantMessageComposerRecipientPicker.test.tsx) |

### Cross-cutting (module-independent)

| # | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| F1 | P2 | `components/app/ModuleImportDialog.tsx` keys a **static** error list with the array index. | No change: the list renders no inputs, so an index key cannot corrupt state. The ratchet was narrowed to `FormListFieldCard` / `useStableRowList` rows rather than flagging it. | closed (not a defect) |
| F2 | P1 | Six write surfaces passed `onSave` without `saving` (no in-flight feedback; a second click could re-enter). | Five were synchronous local actions (read-only job tray, palette import, local-storage preset, in-memory lock prompt, page-owned settings draft) → declared exemptions with reasons in `scripts/check-form-architecture.mjs`. `QuestionSourceBooksSection` saved asynchronously through a prop → added `useSubmitGuard` + `saving` + `error` and cleared the error on close. | closed (spec: QuestionSourceBooksSection.test.tsx) |
| F3 | P2 | Write surfaces without `isDirty`: closing the modal drops typed input silently. | Narrowed to the 19 surfaces that own an editable draft (action/confirmation dialogs excluded). Tracked as the `formModalWithoutDirtyGuard` ratchet baseline; each module sweep lowers it where the draft is user-authored. | tracked (D1) |
| F4 | P2 | `formContractArchitecture.test.ts` scanned only `tenant/` + `platform/`, so shared `components/` FormModal surfaces (branding, reports, background jobs) escaped the fire-and-forget / legacy-store guard. | Scan root widened to `src/components`; zero violations today, six surfaces now covered. | closed (spec: formContractArchitecture.test.ts) |
| F6 | P2 | Seven module Setup panels rendered **two** `ModuleSetupSaveFooter`s for the same preference draft (accounting rules, hasanat, enrollments, users, question-bank, examinations, finance) — the in-card footer duplicated the panel footer and cleared the same dirty flag. | In-card footer removed in all seven; exactly one panel-level footer (with the unsaved-navigation guard) remains, matching the attendance precedent. | closed (spec: moduleSetupFooters.test.ts) |
| F7 | P2 | Writing the D6 spec for the enrollment wizard surfaced that only the shell (`FormModal saving`) was guarded: the wizard footer's own Cancel/Previous stayed active during the in-flight enrollment POST. | Footer buttons (and Next) disable while `submitting`; `EnrollmentWizardFooter.submitting.test.tsx` pins it. | closed (spec: EnrollmentWizardFooter.submitting.test.tsx) |
| F5 | P2 | `sync-all.sh` regenerated the skill index **after** mirroring skills, so a changed skill description left `.cursor/.claude/.dsh` one description behind and the verifier failed on drift. | Index sync now runs first (and is skipped in `--dry-run`, which previously wrote). | closed (spec: check-sync-order.test.mjs) |

## Verification log

| Command | Result |
|---|---|
| `node scripts/verify-rules-integrity.mjs` | pass — 50 skills, 24 rules, 8 workflows |
| `node scripts/check-docs.mjs` | pass — 0 missing index entries, 0 broken links |
| `pnpm run check:forms` | pass — 0/0/0/0/0/0 baselines |
| `pnpm run check:shared-ui` | pass — 0 duplicate primitives, 0 orphaned imports, 0 cross-console leaks |
| `node .agent/skills/mms-ui-ux-design/scripts/check-bidi-classes.mjs` | pass (see Phase 7 log) |
| `pnpm typecheck` | pass — 6/6 tasks |
| `pnpm lint` (frontend) | pass |
| `formContractArchitecture` / `formUiPrimitives` / `formCollectionKeys` | pass — 7 tests |
| `node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs` | pass — 4 default templates / 7 tokens against the 16-key runtime allowlist; `--text "{Invoice Number}"` exits 1 |
| Finance wizard regression (`SimpleTransactionWizard.test.tsx`) | pass — 19 tests incl. "fresh client voucher id on every opening" |
| Contacts suite | pass — 364 tests |
| Users suite | pass — 83 tests |
| Question-bank / hasanat / lib-forms suites | pass — 184 + 54 tests |
| Full frontend suite (`pnpm --filter mms-frontend test`), run serially | pass — 1269 files, 4751 tests (2 skipped) |
| `pnpm --filter mms-frontend lint` | pass (unused imports introduced by the fixes were removed) |
| Second audit pass (independent re-read of the approved plan) | closed the four remaining P1s (invoice credit/cancel guard, contact banner, mark-attendance pending, seven duplicate Setup footers) and aligned token trimming between the verifier and the runtime |
| Deferred-register pass (D1–D6) | D1 dirty guard 22→0; D2–D5 fixes landed; 16 new/extended spec files; F4/F5 enforcement tests; enrollment footer gap found and fixed |
| `pnpm run check:code-norms` | pass — 4/4 over-cap files, baseline unchanged. Two touched files briefly crossed the 300-line cap; both were trimmed to 299 rather than raising the baseline. |
| `pnpm run check:i18n` / `check:i18n-unused` | pass — 0 missing/EN-fallback; 278 unreferenced (baseline 517) |
| `bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh` | pass — every gate green |
| Deferred-register pass final: full frontend suite | pass — **1299 files / 4834 tests (2 skipped)** |
| Deferred-register pass final: `check:forms` | pass — 0/0/0/0/0, `--ratchet` equality, inventory drift 0 |
| Deferred-register pass final: `check:code-norms` | pass — 4/4 (lifecycle dialogs extracted to keep the panel under the 300-line cap) |
| Deferred-register pass final: `verify-rules-integrity` + `check:docs` + `check:i18n` + BiDi + shared-UI + token verifier | pass |
| `git status` mirror idempotency | pass — re-running `sync-all.sh` leaves `.agent/.cursor/.claude/.dsh` byte-identical |
| Playwright `tests/tenant/form-smoke.spec.ts` | **not run** (no live tenant here) — but its two existing tests already drive create → edit → validation error → dirty-discard-reset for **RoleFormModal** and **MessagingSetupTemplateForm**, two of the fixed surfaces; TypeScript is covered by `e2e-tests:typecheck` and PR-visible proof is the Vitest suite. |
| `pnpm ci:local` | one run failed in 16 files with Vite dep-cache misses (`node_modules/.vite/.../deps/*.js`) because another Vitest process was running concurrently; the serial full-suite re-run above passed. Not a code failure — recorded so the run is not mistaken for green. |

## Closing re-audit (workflow phase 7)

The seven-prompt suite re-run against the tree after the fixes:

| Prompt | Command | Result |
|---|---|---|
| 1 — inventory & gaps | `pnpm run forms:inventory` + `pnpm run check:forms` | 214 form-like files / 73 FormModal / 69 write surfaces; no drift, baselines 0/0/0/0/0/0 |
| 2 — lifecycle/reset/submit/cache | `pnpm run check:forms` + the form-contract vitest guards | 0 missing `saving`, 0 surfaces without an in-flight binding, 0 fire-and-forget saves |
| 3 — collections & fields | `formCollectionKeys.test.ts`, `formUiPrimitives.test.ts` | pass, no allowlist growth |
| 4 — shared UI & footers | `node .agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs` | pass — 0 duplicates / 0 orphaned imports / 0 cross-console leaks |
| 5 — BiDi / i18n / a11y | `check-bidi-classes.mjs`, `check:i18n`, `check:i18n-unused`, `smoke-a11y.sh static` | BiDi + i18n clean; a11y heuristics report 141 pre-existing advisory touch-target findings (script is advisory by design; the axe spec is the gate) |
| 6 — domain sweeps | targeted suites after each sweep: contacts 364 · users 83 · enrollments+examinations 183 · question-bank+hasanat+forms 238 · accounting wizard 19 + step form 10; full frontend suite 4748 | pass |
| 7 — regression gate | `pre-pr-review.sh` | pass — all gates green |

Every finding above is `closed` or carries a D-item with an owner and a reason. The ratchet
baselines can only decrease from here.

## Deferred register — closed

The 2026-11-16 follow-up pass closed every item. Evidence is the spec named in each row
above; this table records the workstream and its proof.

| # | Item | Outcome |
|---|---|---|
| D1 | 22 write surfaces without `isDirty` | 19 guarded; 3 forced/credential prompts exempt with written reasons in `scripts/lib/form-exemptions.mjs`. Ratchet `formModalWithoutDirtyGuard` = **0**; `formContractArchitecture.test.ts` fails any unguarded editable write surface or stale exemption. |
| D2 | Finance write-path hardening | Integer-cents balance pre-fill; reversal closed-period field error with awaited confirm; blank journal lines stripped; Wakala requires exactly 100 %; fee amount validated; obligation form reveals errors instead of a dead disabled Save; obligations writes invalidate accounting entries + report aggregates + dashboard summary. Specs per row. |
| D3 | Contacts/admissions | Conflict-specific 409 copy (4 locales), student non-field banner, enrollment operation guard, faculty duplicate confirm guarded + mapped, bulk-enroll failure banner, avatar change gated behind an explicit confirm that states it writes the linked contact immediately. Specs per row. |
| D4 | Attendance/academic | Lifecycle confirms await before closing, `QuestionForm` dirty + field errors, inline record-edit errors in both layouts, media attach failure unlinks the upload, workspace-day defaults, calendar copy dirty guard. Specs per row. |
| D5 | Admin/settings | Saved-report delete confirm with report-scoped copy, theme-scoped branding save (identity draft retained), select-all via `matchRecipients` (dedupe + cap + truncation/failure UX), role labels unique across system + custom. Specs per row. |
| D6 | Specs for every previously "closed without spec" row | 16 new/extended spec files (29 targeted tests) plus the lane specs; F4 contract-scan fixture test and F5 sync-order test added. One real gap surfaced while writing them — the enrollment wizard footer did not disable Cancel/Previous during submit — fixed with `EnrollmentWizardFooter.submitting.test.tsx`. |

No open D-items remain. The advisory **synchronous-guard** list stays advisory (the gated signal
is the in-flight binding): `check-form-architecture.mjs --json` prints
`advisory.synchronousGuardMissing`, and the rule marks the synchronous ref guard as required for
financial/destructive forms, which the touched ones now use.

