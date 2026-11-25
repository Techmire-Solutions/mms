# Centralised ID Configuration & Auto-Generation Review

**Date:** 2026-11-19
**Scope:** The shared sequence-numbering system (SSOT in `@mms/shared`) and how every module allocates its human-facing document number.
**Outcome:** One gap closed (Obligations receipt numbers are now server-authoritative); two advisory findings documented.

## 1. The shared system

The "centralised ID configuration" is a single shared sequence engine, not a per-module copy:

| Concern | Location |
|---|---|
| Config schema (SSOT) | `packages/contracts/src/core/sequenceNumberingTypes.ts` (`SequenceNumberingConfig`) |
| Formatting engine | `packages/contracts/src/core/sequenceNumberingUtils.ts` (`formatDeterministicSequence`, `formatTemplateSequence`) |
| Per-module adapters | `packages/contracts/src/core/sequenceNumberingAdapters.ts` (faculty, students, accounting, finance, obligations) |
| Shared UI card | `apps/frontend/src/components/sequence-numbering/` (`SequenceNumberingCard` + preview/parameters/telemetry) |
| Per-module Setup sections | `FacultyIdSettingsCard`, `StudentsPreferencesSection`, `FinanceInvoiceNumberingSection`, `AccountingSettingsNumberingSection`, `ObligationsReceiptNumberingSection` |

Every module renders the same `SequenceNumberingCard`, which edits the same
`SequenceNumberingConfig` shape (`autoGenerate`, `prefix`, `yearFormat`,
`sequenceDigits`, `delimiter`, `startingSequence`, `rolloverPolicy`,
`currentSequence`, `lastRolloverYear`). The adapters translate each module's
legacy settings keys into that shape, so the UI and the formatting engine stay in
one place.

## 2. Allocation by module (before this change)

| Module | ID | Allocation | Concurrency guard |
|---|---|---|---|
| Faculty | employee ID | `computeNextFacultyEmployeeIdForSettings` (count + collision probe) | unique index `faculty_employments_employee_id_active_uidx` |
| Students | GR number | `generateNextGrNumber` (count + probe) | unique index `students_workspace_gr_number_active_uidx` + race test |
| Finance | invoice number | `allocateNextInvoiceNumber` / `allocateInvoiceNumberBatch` | counter row |
| Accounting | voucher ref | `accounting_voucher_counters` row-lock | counter row (strongest) |
| **Obligations** | **receipt no** | **browser `generateReceiptNo`** | **unique index only** |

## 3. Findings

### F1 — Obligations receipt numbers were generated in the browser (fixed)

`ObligationCollectionForm.tsx` pre-filled `receipt_no` with
`generateReceiptNo(existingCollections, settings)`, which derived the next number
from whatever list the client happened to hold. The schema comment in
`packages/db/src/schema/obligations.ts` admitted the failure mode: *"two
clients produced the same one; this unique partial index is the only thing that
stops it."* The `autoGenerateReceipt: false` Setup toggle was also ignored — the
form always generated.

**Fix (this change):**

- New counter table `obligation_receipt_counters` (migration
  `0267_calm_talon.sql`), keyed by `(workspace_subdomain, format_key, period_year)`
  with `FORCE ROW LEVEL SECURITY`, mirroring `accounting_voucher_counters`.
- New allocator `apps/backend/src/db/repositories/obligationReceiptNumbering.ts`
  (`allocateObligationReceiptNumbers`): lazy-seeds the counter from existing
  receipt numbers, claims disjoint ranges under the counter row lock inside the
  save transaction, and probes `obligation_collections.receipt_no` for hand-typed
  or imported numbers ahead of the counter.
- `upsertObligationCollections` and `createObligationCollection` now fill blank
  `receipt_no` values from the allocator; a blank number with automatic numbering
  off is a validation error. Manual/imported numbers are respected.
- The browser no longer derives the number: the form shows "assigned automatically
  on save" when auto-generation is on, and an editable required field when off.
- Shared helpers added to
  `packages/contracts/src/obligations/obligationsReceiptNumberingUtils.ts`
  (`obligationReceiptFormatKey`, `obligationReceiptSequencePattern`,
  `obligationReceiptNumberingIsUnambiguous`), mirroring the accounting voucher
  helpers.

**Verification:** `obligationReceiptCountersDb.integration.test.ts` proves
distinct numbers under 8 concurrent transactions, disjoint batch ranges under 4
concurrent writers, rollback reuse, calendar-year restart, format-key isolation,
and trashed/hand-typed catch-up — all against real PostgreSQL.

### F2 — Faculty/Students allocators are count-based, not counter-based (advisory)

Faculty (`computeNextFacultyEmployeeIdForSettings`) and Students
(`generateNextGrNumber`) compute the next number from a `COUNT` plus a collision
probe, protected by a unique index. This is correct (the index is the backstop and
collisions are probed), but it is a softer guarantee than the row-lock counter used
by Finance and Accounting: under extreme concurrent creates the probe can retry,
and the count approach re-reads the directory per record. Not changed in this pass;
left as a follow-up if the modules ever show allocation contention.

### F3 — Inconsistent default delimiters (advisory)

Faculty and Students default to an empty delimiter (compact IDs like
`FAC20260001` / `0001-2026`), while Finance, Accounting and Obligations default to
`-`. This is a per-module product choice, not a defect; left unchanged pending a
product decision. The shared `SequenceNumberingConfig.delimiter` preset list
(`""`, `-`, `/`, `.`) is uniform across all five modules.

## 4. What this change did not touch

- Faculty, Students, Finance and Accounting allocators are unchanged.
- Backup restore (`replaceObligationCollectionsForWorkspace`) still preserves
  stored receipt numbers — it does not allocate.
- The existing partial unique index `obligation_collections_workspace_receipt_uidx`
  remains the backstop; the new counter is the concurrency-safe allocator.

## 5. Verification commands

```bash
pnpm --filter @mms/shared test              # 299 files / 2482 tests
pnpm --filter @mms/shared typecheck
pnpm --filter @mms/shared build             # refresh dist (frontend consumes types)
pnpm --filter mms-backend typecheck
pnpm --filter mms-backend test              # 597 files / 4186 tests
pnpm --filter mms-backend test:db           # real PostgreSQL (129 files / 784 tests)
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/obligationReceiptCountersDb.integration.test.ts
pnpm --filter mms-frontend typecheck
pnpm --filter mms-frontend test             # 1322 files / 4907 tests
bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh
pnpm run check:i18n
```
