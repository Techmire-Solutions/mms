# Accounting module — best-practices review

A whole-module review of the Accounting slice against the `mms-finance-accounting`
best-practices references (ledger controls, closing/reporting, and the 2026 policy
sources). Conforming controls are listed first; the four gaps found are fixed or
documented below.

## 1. Conforms (verified, no change)

- **Double-entry integrity** — exact integer-cent sums, single-sided non-zero
  balanced lines, and a database commit trigger; no epsilon-based "balanced" checks.
- **Posted-entry immutability** — linked reversals with reason/actor/source/ref;
  duplicate reversals blocked by an advisory lock and the `(source_type, source_id)`
  index; the original entry is never edited.
- **Lifecycle & segregation** — draft/post/manage/delete split; summary/archived/
  deactivated accounts refused at posting; setup access cannot post/reverse/close.
- **Close workflow** — period and fiscal-year locks; a balanced-trial-balance gate;
  retained earnings must be an active Equity account; year-end FX revaluation,
  IFRS 9 hedge valuation and IAS 29 restatement must exist before close; closing
  entries are excluded from the income statement; unclosed surplus appears in equity
  exactly once via `incomeStatementTrialBalance` / `balanceSheetTrialBalance`.
- **Multi-currency** — functional currency immutable once posted; dual-amount lines;
  closing-rate revaluation with next-day reversal; IAS 29 and IFRS 9 implementations;
  exchangeability; consolidation (platform); missing rates fail with 422, never 1.
- **Isolation & audit** — tenant RLS + FORCE RLS; transactional audit rows; forward-only
  migrations; subledger aging; per-row CSV import errors.

## 2. Findings and fixes

### G1 (P2) — Account `type` could be reclassified after posting
`accountRecordUpdateSchema` is `.partial()` and the persist path wrote `type` freely,
so changing a used account's type silently reclassified history in every report.
**Fixed:** `assertNoPostedAccountTypeChange` reads the stored row `FOR UPDATE` and
throws a 409 (`account_type_in_use`) when a posted-line account's `type` changes;
`name`/`subtype`/`code`/description/FX/parent edits remain allowed. Regression tests
cover the posted account, harmless edits, and the no-lines case.

### G2 (P3) — Bank reconciliation re-match was unguarded
The journal-line uniqueness index already existed, but a conflicting match surfaced
as a raw 500 and re-matching the same statement line silently overwrote.
**Fixed:** `matchBankReconciliation` now replays an identical `(entryId, lineId)`
idempotently, refuses pointing a matched statement line at a different line with 409
(`bank_line_already_matched`), and maps the journal-line index violation to 409
(`journal_line_already_matched`). A real-Postgres suite proves all three.

### G3 (P2) — Cash-flow statement had no operating/investing/financing classification
Direct/indirect totals reconciled, but classification relied on code/name heuristics
and there was no O/I/F split.
**Fixed:** new `cash_flow_section` account column (migration 0261, CHECK-constrained)
with `cashFlowSectionForAccount` inference (explicit mapping wins; Fixed Assets →
investing; Equity/Long-Term Liabilities → financing; otherwise operating). The report
classifies each entry's net cash leg by its **non-cash counterpart** account section
(mixed counterparties fall back to operating; cash↔cash transfers appear in no
section) and exposes `cashFlowSections` on the aggregates. Each section carries a
direct figure (cash legs) and an indirect figure (non-cash balance-sheet movements:
operating starts from P&L plus working-capital add-backs; investing/financing mirror
their classified accounts), and the three indirect figures sum to `netCashFlowIndirect`.
The Cash Flow panel shows each section's direct and indirect figures with a
reconciliation line, and the Chart of Accounts editor offers the optional override.

### G4 (P3) — Reversal policy documented
Reversals are whole-entry only; a partial correction is a separate adjusting journal.
Stated in the reversal use-case docstring and this document.

## 3. Verification
```bash
pnpm typecheck && pnpm --filter @mms/shared build
pnpm --filter @mms/shared test && pnpm --filter mms-backend test && pnpm --filter mms-frontend test
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting
pnpm run check:code-norms && pnpm run check:backend-structure && pnpm run check:migration-hygiene \
  && pnpm run check:docs && pnpm run check:i18n && pnpm run test:scripts
```
New tests: `accountingCashFlow.test.ts` (inference), `accountingReportCashFlow.test.ts`
(O/I/F classification), `accountingAccountsSchemaDb` (type immutability),
`accountingBankingDb` (reconciliation idempotency/conflicts).
