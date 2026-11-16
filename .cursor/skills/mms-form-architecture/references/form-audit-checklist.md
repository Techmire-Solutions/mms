# Form Audit Checklist & Finding Register

Companion to the `/form-audit` workflow (`.agent/workflows/form-audit.md`). Norms live in
`mms-form-architecture.md` §1–§8; this file is the working format for a sweep.

## 1. Manifest (generated, never hand-written)

`pnpm run forms:inventory` writes `docs/forms-inventory.md`. Per surface it records:

| Column | Meaning |
|---|---|
| file | repo-relative path under `apps/frontend/src` |
| module | `tenant/<feature>`, `tenant/pages/<area>`, `platform/<area>`, `components/<area>` |
| surface | `modal-form` (\<FormModal\>), `modal` (raw Modal), `drawer`, `inline` |
| saving | `saving=` present on the FormModal tag |
| dirty | `isDirty=` present |
| in-flight binding | a pending state reaches `saving` (`…isPending/submitting/saving`), or a canonical hook is used. This is the gated signal; a **synchronous** guard (`useSubmitGuard`/ref) is advisory and reported separately |
| identity reset | `useIdentityReset` / `resetDraft` |
| server map | `mapApiFormError` / `onFieldErrors` |

Staleness fails `pnpm run check:forms`. A new surface must appear in the diff and get an owner
in the audit doc.

## 2. Severity rubric

| Severity | Meaning | Examples |
|---|---|---|
| **P0** | Data loss / corruption, financial misposting, tenant or permission leak, double-post | Save writes the wrong record; reversing a posted entry from a form; cross-tenant FK accepted; a second voucher posted by double-click |
| **P1** | The form cannot fail safely | Silent save failure; server field errors shown as a toast; stale draft edits the previous record; directory stays stale after save; close-before-await |
| **P2** | Standardization / a11y / i18n deviation | Missing dirty guard; hardcoded English; physical `ml-*` classes; missing `aria-invalid`; index key in a repeatable row; duplicate footer |
| **P3** | Polish | Spacing, helper text wording, icon choice |

P0/P1 must close before the sweep is reported done. P2/P3 may be deferred with an owner and a
reason in the audit doc (`D1`, `D2`, …).

## 3. Finding record

Use this row shape in `docs/forms-audit-2026-11-16.md`:

```
| F-id | Sev | file:line | Rule § | Finding | Fix | Spec | Status |
```

Rules:
- One row per defect, not per file.
- `Rule §` cites the owning clause (e.g. `mms-form-architecture.md §2`).
- `Spec` names the test that proves the fix (the reset/validation spec added in the same change), not "tested manually".
- `Status` is `open`, `closed`, or `deferred (D-n)`.
- A `closed` row without a spec is a review failure (`mms-completion-review.md` §4).

## 4. Per-surface questions

Ask these for every write surface; a "no" is a P1 unless the surface is genuinely read-only:

1. Does reopening on a different record reset the draft and errors?
2. Is there exactly one submit path, guarded against re-entry, that awaits the mutation?
3. Does `saving` reflect the mutation's pending state, and is the modal non-dismissible while pending?
4. Are field-level server errors rendered on the same keys as local Zod errors, with a form-level fallback?
5. Does the mutation invalidate every affected list/detail/widget/lookup key before close?
6. Does closing with unsaved input ask first, and does a failed save keep the input?
7. Are collection rows keyed by identity, and are empty optional rows stripped/coerced before submit?
8. Are all labels/placeholders/messages translated in en/ar/ur/fa and free of physical direction classes?
9. Does every control have a programmatic label, `aria-invalid`, and `aria-describedby` when invalid?
10. Does focus return to the opener, and does submit failure focus the first invalid field (and its tab)?

## 5. Module sweep matrix

| Sweep | Modules | Directories | Owning skill | Domain reports to reconcile |
|---|---|---|---|---|
| 6A | Contacts, Admissions / Student Lifecycle | `tenant/features/contacts`, `students`, `enrollments`, `sessions`, `tenant/pages/apply` | `mms-student-lifecycle` | `CONTACTS_AUDIT.md`, `CONTACTS_FUNCTIONAL_QA_REPORT.md`, `CONTACTS_ACCESSIBILITY_REPORT.md` |
| 6B | Accounting, Finance | `tenant/features/accounting`, `finance`, `obligations` | `mms-finance-accounting` | `references/ledger-controls.md`, `references/policies-2026.md` |
| 6C | Attendance, Academic Catalog/Calendar, Faculty | `tenant/features/attendance`, `examinations`, `faculty`, `workshops`, `tasks`, `question-bank`, `hasanat` | `mms-faculty-domain`, `mms-student-lifecycle` | timezone/FK/upload rules |
| 6D | Messaging, Notifications, Document Templates, Reports, Users/Settings, Platform | `tenant/features/messaging`, `users`, `settings`, `components/reports`, `platform` | `mms-messaging`, `mms-document-templates`, `mms-reports-export`, `mms-user-management` | `verify-template-tokens.mjs`, `document-template-checklist.md` |

Run one sweep at a time. Each sweep ends with: the module's unit/integration tests, its
`docs/forms-audit-2026-11-16.md` section filled, and `pnpm run check:forms` re-run with baselines lowered
where possible.

## 6. Sign-off

| Gate | Evidence |
|---|---|
| Inventory | regenerated, zero drift |
| Ratchet | `pnpm run check:forms` green, baselines not increased |
| Static guards | `formContractArchitecture`, `formUiPrimitives`, `formCollectionKeys` green, no unexplained allowlist |
| Behaviour | create → edit → create reset spec per fixed form; double-submit spec; server-error spec |
| i18n | `check:i18n` + `check:i18n-unused` clean |
| a11y | axe smoke clean; focus/aria assertions in specs |
| Review | adversarial pass completed (`mms-code-review`), audit doc statuses all closed or deferred |
