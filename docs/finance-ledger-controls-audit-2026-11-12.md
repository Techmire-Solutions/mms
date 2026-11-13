# Finance ledger controls — use-case and invariant audit

Scope: the core Finance/Accounting domain — `accountingUseCases`, `accountingLedgerOpsUseCases`, `accountingLedgerGuards`, `accountingPostingPeriods`, `accountingPeriodClose`, the fiscal-year posting lock, every ledger-posting path that feeds them (`ledgerPostingService`, `ledgerPostingHelpers`, `ledgerReversalPostingService`, `obligationPostingService`, `reverseJournalEntryUseCase`, `processSpecializedEntryUseCase`) and the finance write paths that post into the ledger (`createInvoice`, `createPayment`, `createCreditNote`, `cancelInvoice`, batch generation, payment archive/restore). Line numbers are from the working tree at audit time; where a change moved them, the function name is given instead.

Method: read every named file plus the writers that reach it; verified behaviour against the running PostgreSQL (constraint/trigger/column introspection, `EXPLAIN`) and with new DB-integration suites for each invariant. Nothing below is inferred from a type or a comment.

Every finding marked **Fixed** landed with this change (migration `0249_finance_ledger_invariants.sql`, the guards, the period API, the cents refactor and the atomicity fixes). **Documented** findings are recorded decisions, not code changes.

---

## 1. What holds (verified, so the report doesn't over-claim)

| Guarantee | Evidence |
|---|---|
| **Application-level double entry everywhere** | `prepareJournalEntryForPersist` rejects a posted entry unless `isJournalEntryBalanced` (≥2 lines, single-sided, equal cents, >0). It runs in `upsertEntries`, `createJournalEntry`, `updateJournalEntryById`, `persistGeneratedEntry(s)`, period close and the reversal use case. |
| **Functional amounts are derived, not client-supplied** | `resolveJournalFxLines` recomputes `debit/credit` from `txn × rate` for foreign lines; residue ≤ one minor unit per line goes to the FX-rounding account, larger residue is left for the balance check to reject. `journalLineFxInsertValues` writes `func_* = debit/credit`. |
| **Corrections are reversals** | `assertEntriesMutable` rejects any posted content change; posted deletes are blocked in both layers; `reverseJournalEntry` refuses drafts, non-reversible sources (invoice/payment/closing/FX/IAS 29/hedge), duplicates, dates before the original and closed periods. |
| **Fiscal-year close serialization** | The close takes the row lock **and** the per-year advisory lock before aggregating; posting paths re-read the years under the same lock. |
| **Document posting is idempotent and transactional** | `persistGeneratedEntry` dedupes on `(source_type, source_id)` + partial unique index; `createInvoice`, `createPayment`, `createCreditNote`, `cancelInvoice`, payment archive/restore, batch generation and the specialized-entry pipeline each run in one transaction. |
| **Realized FX is not a 4 dp/2 dp mismatch** (a suspicion I checked and discarded) | `realized_fx` is stored as `Number(moneyToDecimalString(realized))` — formatted at the functional currency's minor units — and `buildFxPaymentPostingLines` uses the same helper, so the subledger value and the posted line agree. The `numeric(19,4)` column is forward-compatible with a future ledger-DTO widening. |

## 2. Findings

### P0 — guarantees that were not enforced

**F1 — no database-level double-entry invariant.** *Fixed.* The only check lived in `prepareJournalEntryForPersist`. Writers that bypass it: the public `saveEntry` repository, `replaceEntriesForWorkspace` (backup restore + legacy `031` import, rows verbatim under `allow_hard_purge`), `091_backfill_functional_currency` (line UPDATEs), and any raw SQL/ops fix. Migration 0249 adds **deferred constraint triggers** on `accounting_journal_lines` (fires per touched row at COMMIT: ≥2 lines, Σdebit = Σcredit > 0) and on `accounting_entries` (fires on the transition into `posted`, covering "post an entry with no lines"). Both honour `app.allow_hard_purge` / `app.allow_ledger_maintenance`, so restore, purge and the IAS 21 backfill keep working.

**F2 — `accounting_posting_periods` was write-only; a closed period could not exist.** *Fixed.* `syncPostingPeriods` was the only writer and no module read the table; `assertJournalEntryPeriodOpen` and `validateJournalReversalDate` consulted fiscal years only; no route could close a period; `accountingPostingPeriods.test.ts` tested the generator alone. Landed: `findClosedPostingPeriodForDate` + `assertPostingPeriodOpen` wired into every posting path (`upsertEntries`, create/update entry, `persistGeneratedEntry(s)`, reversal), a DB backstop inside the 0249 balance trigger, and `GET /api/accounting/posting-periods` + `POST …/:id/close` + `POST …/:id/reopen` with `closed_at`/`closed_by`, an audit row and the fiscal-year advisory lock. The year-end closing entry is exempt (it is dated inside the period it closes and is written by the same transaction that closes it); `source_type` is server-owned, so a client cannot claim the exemption.

**F3 — the close lock could be bypassed by a declared year different from the entry date.** *Fixed.* `upsertEntriesHelper` locked `resolveYearId(fiscalYears, entry.date) ?? entry.fiscal_year_id` while `prepareJournalEntryForPersist` stores `declared ?? containing`: an entry declared into year A but dated in year B held only B's advisory lock, so close(A) could aggregate and flip status while the entry was in flight, and the entry then committed into the closed year. `postingYearIds` now returns the union of the date's year, the declared year and a declared id not yet in the list; `lockFiscalYearsForEntries` locks all of them before the caller re-reads the years.

### P1 — bypassable or imprecise controls

**F4 — a backdated date before the configured calendar escaped every period check.** *Fixed, narrowly.* `prepareJournalEntryForPersist` fell back to `fiscal_year_id = null` and the guard returned silently when no year contained the date, so an entry dated before the first year (or in a gap) moved the books with no lock. The guard now rejects a posted write whose date is **not contained and not after the last configured year** — i.e. backdating before the books or into a gap — while a *forward* date beyond the last year stays allowed (the normal "next year not created yet" invoice) and a workspace with no fiscal years at all stays fully postable. This mirrors the reversal path's existing `outside_fiscal_years` rule.

**F5 — posted content immutability had no database guard.** *Fixed.* 0248 blocked soft-delete of posted entries and DELETE of their lines, but `UPDATE accounting_entries` of `date/status/fiscal_year_id/source_type/source_id` and `UPDATE accounting_journal_lines` of `debit/credit/account_id` were unguarded. 0249 adds BEFORE UPDATE triggers that compare OLD/NEW: an entry's ledger columns are frozen once posted, and a posted line may only change the IAS 21 columns (`txn_*`, `rate_*`, `func_*`) — the exact contract `091` depends on. `ref`/`description` stay writable.

**F6 — the trial balance, and therefore the closing entry, was aggregated in `float8`.** *Fixed.* `accountingRepositoryReport.ts` summed `::float8` and derived `balance` in JS floats; `closeFiscalYearForTenant` fed those floats into `buildClosingEntryLines`, whose retained-earnings plug silently absorbed any float residue. Sums are now `::numeric::text` converted once, and the close **verifies the year's own ledger balances** (exact cents, Σdebit = Σcredit) and refuses to close otherwise.

**F7 — subledger money arithmetic was float, not cents.** *Fixed.* `invoiceTotalsFromLines` (`baseFee - discountAmt` in floats), `getOutstandingAmountForInvoice` (four floats added/subtracted), `applyCollectedDelta` (`paidAmt + delta`) and `createPayment`'s remaining-balance comparison/`newPaid` now work in integer cents and convert once at the boundary. Tests pin `0.3 − 0.1 = 0.2` and a partial-payment `0.1 + 0.2 − 0.3` case.

**F9 — batch invoice generation linked enrollments outside the transaction.** *Fixed.* `generateInvoices` now wraps `persistGeneratedInvoices` **and** `linkEnrollmentInvoiceIds` in one `withTenant` (nested calls join it), so invoices, postings and enrollment links commit together; a link failure rejects the generation.

**F10 — `saveInvoice` wrote the invoice and its lines in two transactions.** *Fixed.* `replaceInvoiceLines` moved inside the same `withTenant` callback, so the header and lines are one aggregate even when the caller owns no transaction. A DB test forces a duplicate line id and proves the invoice does not persist.

### P2/P3 — documented (not changed)

- **F8 — realized FX 4 dp vs 2 dp:** verified *not* a defect (see §1).
- **F11 — unposted documents are silent.** `tryPostInvoiceJournal` returns without posting when posting rules are unset and nothing backfills them later. `audit:ledger-balance` now reports them (634 in the dev database — fixture/test workspaces with no posting rules). Recommendation: a reconciliation report + explicit backfill action.
- **F12 — opening balances of a closed or already-posted year:** *fixed in passing* — `upsertOpeningBalances` now rejects both cases.
- **F13 — bank statement/reconciliation writes have no period check** (`accountingLedgerOpsUseCases`); no ledger write involved, low risk.
- **F14 — a reversal can itself be reversed** (`source_type='reversal'` is not in `NON_REVERSIBLE_JOURNAL_SOURCES`), producing chains; recommend refusing reversal-of-reversal. Closing/FX/IAS 29/hedge sources are correctly refused.
- **F15 — advisory keys use `hashtext()`**, which PostgreSQL does not guarantee stable across major versions; harmless collisions, worth documenting in `fiscalYearPostingLock.ts`.
- **F16 — `moneyToCents` remains a float entry point**, bounded by the DTO's ≤2-decimal refinement; the cents refactor uses it only on 2 dp inputs.

## 3. Bypass matrix (writer → what is enforced where)

| Writer | Balance | Posted content | Closed FY | Closed period |
|---|---|---|---|---|
| Manual entry API (`upsertEntries`, create/update) | app + DB | app + DB | app (+ DB on status transition) | app + DB |
| Invoice/payment/credit-note/cancel/archive postings (`persistGeneratedEntry(s)`) | app + DB | app + DB | app | app + DB |
| FX revaluation / IAS 29 / hedges / obligations | app + DB | app + DB | app | app + DB |
| Journal reversal route | app + DB | app + DB | app | app + DB |
| Year-end close (closing entry) | app + DB | app + DB | n/a | exempt by design |
| `saveEntry` repository / raw SQL / ops | **DB** | **DB** | — | **DB** |
| Backup restore / legacy import (`replaceEntriesForWorkspace`) | bypass by design (`allow_hard_purge`) | bypass by design | bypass by design | bypass by design |

## 4. What the existing suites did and did not assert

| Suite | Covered | Gap found |
|---|---|---|
| `accountingLedgerGuards.test.ts` (13 → 16 tests) | posted balance, closed-year rejection by date and label, content change | **enshrined** "a date outside every year is allowed"; narrowed to forward dates / bootstrap and added the pre-calendar + gap cases |
| `accountingPeriodPostingPeriods.test.ts` | the period generator only | never that a period is *read*; the feature was inert |
| `accountingPeriodClose.test.ts` (5 → 10 tests) | not-found, already-closed, missing/non-equity retained earnings, FX revaluation gate, happy close | mock trial balance had no `totalDebit/totalCredit` (the new balance check immediately exposed it) |
| `accountingFiscalYearCloseLock.test.ts` | row lock + advisory lock ordering, audit shape | no coverage of *which* years a posting locks |
| `accountingConcurrencyDb` | stale draft vs concurrent post, duplicate create, unique ref | no declared-year/date-year race |
| `financeInvoiceGenerationUseCases` | batch atomicity, audit per invoice | no link-failure case |
| `financeInvoicePersist` tests | upsert parity, soft-delete parity | no header+lines atomicity case |

## 5. Landed changes

**Migration `0249_finance_ledger_invariants.sql`** (+ snapshot + journal entry; hand-authored under the same reviewed exception as 0248 because `drizzle-kit generate` is blocked by the pre-existing malformed snapshot chain):
`accounting_assert_entry_postable()` helper; deferred constraint triggers `trg_accounting_journal_lines_balance_guard` and `trg_accounting_entries_posting_guard`; BEFORE UPDATE triggers `trg_accounting_entries_posted_columns_guard` and `trg_accounting_journal_lines_posted_columns_guard`; CHECKs `func_debit/func_credit mirror`; `accounting_posting_periods.closed_at/closed_by` + range CHECK; an informational WARNING when legacy posted rows fail the invariant (never blocks the deploy).

**Guards and locks:** `assertPostingPeriodOpen`, `assertEntriesWritable` (period-aware), out-of-range rule in `assertJournalEntryPeriodOpen`, `postingYearIds` + `lockFiscalYearsForEntries`, and wiring in every posting path.

**Posting-period API:** `db/repositories/accountingPostingPeriodsRepository.ts` (list / find-by-id / closed-for-date / set-status), `accounting/use-cases/accountingPostingPeriodUseCases.ts` (close/reopen with audit + FY lock), re-exported from `accountingLedgerOpsUseCases.ts`; routes `GET /posting-periods`, `POST /posting-periods/:id/close`, `POST /posting-periods/:id/reopen` in `accountingLedgerOpsRoutes.ts`; shared `postingPeriodRecordSchema`, `postingPeriodParamsSchema`, `postingPeriodsQuerySchema`, `closePostingPeriodBodySchema` in `packages/shared/src/finance/accountingLedgerOps.ts`.

**Precision:** exact trial balance sums, closing-entry balance assertion, cents arithmetic in `financeBilling.ts`, `financeInvoiceAmounts.ts`, `financePaymentArchiveDeltas.ts` and `createPayment`.

**Atomicity:** `saveInvoice` header+lines in one transaction; `generateInvoices` invoices+postings+links in one transaction.

**Audit script:** `apps/backend/src/scripts/audit-ledger-balance.ts` (`audit:ledger-balance`) — read-only; reports unbalanced/short posted entries, functional-mirror mismatches, postings inside closed periods and documents without a ledger posting; exits non-zero on invariant violations only.

## 6. Evidence

**Red evidence.** `accountingBalanceInvariantDb.integration.test.ts` was written first and failed before migration 0249 with `expected [Function] to reject, got 'Failed query: commit'` for the unbalanced posted entry and `promise resolved "Result{ command: 'UPDATE' }" instead of rejecting` for posting an empty draft; the functional-mirror CHECK failed the same way. All three pass after 0249. The period suite failed before the guard (`rejects a journal entry dated inside the closed period` resolved instead of rejecting) and passes after it.

All suites below were run against the dev PostgreSQL (`localhost:5432/mms`) with migration 0249 applied:

- `accountingBalanceInvariantDb.integration.test.ts` — balanced posted commits; unbalanced posted rejected at COMMIT even for a raw writer; unbalanced draft allowed; posting an empty draft rejected; functional-mirror CHECK; `allow_hard_purge` escape; posted entry/line content immutable; IAS 21 backfill still allowed.
- `accountingPeriodLockDb.integration.test.ts` — periods generated, close with attribution + audit row, journal/invoice-path posting rejected inside a closed period, open period accepted, raw DB backstop, closing-entry exemption, reopen restores posting, FY-closed reopen refusal, tenant isolation.
- `accountingPostingYearLock.test.ts` — the lock set includes the declared and the dated year, plus an unseen declared id.
- `accountingLedgerGuards.test.ts` — forward dates allowed, no-years bootstrap allowed, pre-calendar and gap dates rejected.
- `financeInvoiceAtomicityDb.integration.test.ts` — header rolled back when a line fails; happy path writes both.
- `financeInvoiceGenerationUseCases.test.ts` — link failure rejects the generation.
- Shared `financeBilling` / `financeInvoiceAmounts` — exact netting and cents-based outstanding.
- `audit:ledger-balance` on the dev database — **0 ledger-invariant violations**, 634 unposted documents (the F11 data gap).

## 7. Recommendations not implemented here

1. **Unposted-document reconciliation** (F11): a scheduled report + a reviewed backfill that posts documents created before posting rules existed, rather than leaving `audit:ledger-balance` as the only signal.
2. **Reversal-of-reversal refusal** (F14) and an explicit chain policy.
3. **Bank-rec period checks** (F13).
4. **Frontend** for period close/reopen: the API is live, the Period-end panel is the natural home; not part of this backend change.
5. **Ledger DTO widening to 4 dp** if a functional currency with 3 minor units must be supported (the columns and `func_*` already carry 4 dp; the `debit/credit` DTO does not).

## Appendix — reproduction queries

```sql
-- Posted entries that fail the invariant (should be empty; the audit script runs this)
SELECT e.workspace_subdomain, e.id, count(l.id) AS lines,
       coalesce(sum(l.debit),0) AS debit, coalesce(sum(l.credit),0) AS credit
  FROM accounting_entries e
  LEFT JOIN accounting_journal_lines l
    ON l.workspace_subdomain = e.workspace_subdomain AND l.entry_id = e.id
 WHERE e.status = 'posted' AND e.deleted_at IS NULL
 GROUP BY 1,2
HAVING count(l.id) < 2 OR coalesce(sum(l.debit),0) <> coalesce(sum(l.credit),0);

-- The deferred guards are constraint triggers
SELECT c.relname, t.tgname, t.tgdeferrable, t.tginitdeferred
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
   AND t.tgname LIKE '%balance_guard' OR t.tgname LIKE '%posting_guard';

-- Closed periods covering posted entries (should be empty)
SELECT e.workspace_subdomain, e.id, e.date, p.label
  FROM accounting_entries e
  JOIN accounting_posting_periods p
    ON p.workspace_subdomain = e.workspace_subdomain
   AND p.status = 'closed' AND e.date BETWEEN p.start_date AND p.end_date
 WHERE e.status = 'posted' AND e.deleted_at IS NULL AND e.source_type <> 'closing';
```
