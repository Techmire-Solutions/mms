# Centralised ID Configuration — DRY / SSOT Review

**Date:** 2026-11-19
**Scope:** duplication (DRY) and single-source-of-truth (SSOT) quality of the shared sequence-numbering system.
**Follows:** `id-configuration-review-2026-11-19.md` (the server-authoritative Obligations fix).

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | Three copies of the "pattern / format-key / unambiguous" trio (`accountingVoucherNumbering`, `obligationsReceiptNumberingUtils`, plus per-module `formatX` wrappers) | high | **fixed** |
| F2 | Five different backend allocation strategies (counter row-lock ×3, count+probe ×1, `LIKE … LIMIT 100` scan ×1) | high | **fixed** for the counter modules (one generic allocator) |
| F3 | Finance numbering config was UI-only: the server honoured only `invoicePrefix` | high | **fixed** |
| F4 | Finance had a parallel `nextInvoiceSequence` string-slice parser | medium | **fixed** (removed) |
| F5 | Dual/legacy settings keys per module (`idPrefix` vs `employeeIdPrefix`, `grNumberTemplate` vs `grNumber*`) | medium | follow-up |
| F6 | Frontend `handleChange` field-map boilerplate across 5 Setup sections | low | follow-up |

## What changed

### Phase 1 — one implementation of the sequence helpers (F1, F4)

Added to `packages/shared/src/core/sequenceNumberingUtils.ts`:

- `sequenceFormatKey(config)` — counter identity `yearFormat|delimiter|prefix`.
- `sequencePattern(config, periodYear)` — POSIX regex for one counter period.
- `sequenceNumberingIsUnambiguous(config)` — restart ⇒ must print the year.
- `formatSequenceNumber(sequence, config, printYear)` — the single format wrapper.

`accountingVoucherNumbering` and `obligationsReceiptNumberingUtils` now delegate to these
(their `voucher*` / `obligationReceipt*` names remain as thin aliases), so the two modules share
byte-identical pattern output and one regex-escaping rule. The now-unused finance
`nextInvoiceSequence` / `nextInvoiceNumber` were removed (`formatInvoiceNumber` stays — the
frontend draft preview uses it).

### Phase 2 — Finance honours its full numbering config (F2, F3)

- `FinanceModulePreferences` (the server-persisted preferences blob) now carries
  `invoiceYearFormat`, `invoiceSequenceDigits`, `invoiceDelimiter`, `invoiceStartingSequence`,
  `invoiceRolloverPolicy`, `invoiceCurrentSequence`; `DEFAULT_FINANCE_SETTINGS` gained matching
  defaults; the preferences PUT schema validates them.
- New `finance_invoice_counters` table (migration `0268_robust_mikhail_rasputin.sql`, FORCE RLS),
  mirroring `obligation_receipt_counters`.
- `financeBillingNumbering.allocateInvoiceNumbers(tenant, { date?, count?, reserved? })` replaces
  the `LIKE … ORDER BY DESC LIMIT 100` scan with the same row-lock counter allocator used by
  accounting and obligations, and now honours the full format config.
- `createInvoice` and `persistGeneratedInvoices` call the new allocator instead of passing a bare
  prefix string.

Note: `autoGenerateInvoice` retains its existing meaning ("auto-create invoices on enrollment"),
so invoice numbers are still always assigned when absent; the allocator does not gate on it.

### Phase 3 — one generic counter allocator (F2)

Added `apps/backend/src/db/repositories/sequenceNumberAllocator.ts`:
`allocateSequenceNumbers(tenant, { label, counterTable, docTable, docNumberColumn, readConfig,
resolvePeriod }, options)` — the single row-lock counter allocator (lazy seed → claim → collision
probe → catch-up), parameterised over the three identical counter tables.

`accountingVoucherRepository.allocateVoucherNumbers`,
`obligationReceiptNumbering.allocateObligationReceiptNumbers`, and
`financeBillingNumbering.allocateInvoiceNumbers` now delegate to it (each supplies only its config
reader and — for accounting — its fiscal `resolveVoucherPeriod`). This removes ~250 lines of
near-identical claim/catch-up/seed code. Behaviour is unchanged, proven by the three counter DB
suites (32 tests) and the accounting unit suites.

## Remaining follow-ups (documented, not in this change)

- **F2 (faculty):** Faculty employee IDs still use `COUNT` + collision probe (no counter). Migrating
  it to the shared counter allocator is the last weak spot.
- **F5 / F6:** consolidate the faculty `idPrefix`/`idDigits` legacy keys and the frontend
  `handleChange` boilerplate with a declarative field map (assessed as lower value — the current
  explicit mappings are clear and each section has module-specific extras such as the faculty
  `idTemplate` and students `grNumberTemplate` rebuilds).

## Verification

```bash
pnpm --filter @mms/shared test        # incl. sequenceNumberingUtils + financeBilling + accountingVoucherNumbering
pnpm --filter @mms/shared typecheck && pnpm --filter @mms/shared build
pnpm --filter mms-backend typecheck && pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/financeInvoiceCountersDb.integration.test.ts \
  src/__tests__/db-integration/obligationReceiptCountersDb.integration.test.ts
bash .agent/skills/mms-schema-migrate/scripts/check-migrations.sh
```
