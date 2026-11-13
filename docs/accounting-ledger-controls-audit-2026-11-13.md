# Accounting — core domain and ledger-control audit

Scope: the domain layer behind the Accounting module — `accountingUseCases`, `accountingLedgerOpsUseCases`,
`accountingLedgerGuards`, the posting/reversal orchestration (`ledgerPosting/*`,
`reverseJournalEntryUseCase`), the period and year-end locks (`accountingPostingPeriodUseCases`,
`accountingPeriodClose`, `fiscalYearPostingLock`), the shared invariants they rely on
(`packages/shared/src/finance/accountingLedgerInvariants.ts`, `accountingJournalReversal.ts`,
`accountingLedgerPosting.ts`), and the database guards those paths depend on (`0248`, `0249`, `0253`,
`0254`).

Method: every claim was read from the working tree and measured against PostgreSQL 16 (fresh
`db:migrate`, real `test:db` runs). "Verified" below means the control was traced to a write path **and**
a test, not merely asserted in a comment. Findings marked *Fixed* landed with migration
`0254_accounting_ledger_control_hardening.sql` plus the files in §5.

---

## 1. What is already correct (verified, no change)

| Claim from the request | Evidence |
|---|---|
| **Functional double entry, `Σdebit == Σcredit > 0`** | `prepareJournalEntryForPersist` (`accountingLedgerGuards.ts:54`) requires `isJournalEntryBalanced` (≥ 2 lines, each single-sided, balanced, non-zero) for a posted entry; the deferred `accounting_journal_lines_balance_guard` + `accounting_assert_entry_postable` (`0249:31-114`) re-check at COMMIT, so a repository, import or raw-SQL writer cannot skip it. Proven by `accountingBalanceInvariantDb`. |
| **Both currencies** | *Not* fully — see L1. The functional pair was enforced; the transaction-currency legs were not. |
| **Posted vouchers are not editable in place** | App: `assertEntriesMutable` (`accountingLedgerGuards.ts:253-267`) compares content (including lines, tags, attachments) after the journal lock. DB: `0248:42-101` (no archive, no line DELETE), `0249:143-205` (date/status/fiscal-year/source frozen), `0253` (`ref`/`reversed_ref` frozen), `0254` (`created_by` frozen). |
| **Corrections go through a linked reversal** | `reverseJournalEntry` (`reverseJournalEntryUseCase.ts:120-218`) runs in one transaction: journal advisory lock → eligibility → duplicate check → date rules → fiscal-year lock + re-read → period check → account check → insert → audit; broadcast only after commit (`reverseJournalEntryDeps.ts:18`). `buildReversalLines` swaps **functional and transaction** amounts (`accountingLedgerPosting.ts:5-16`). Non-reversible sources (invoice, payment, closing, fx, ias29, hedge) are refused in shared code. |
| **No double reversal** | Advisory lock + `findActiveReversalOf` (matches `source_id` and legacy `reversed_ref`) + partial unique index `accounting_entries_workspace_source_uidx`; two-connection proof in `accountingConcurrencyDb`. |
| **No posting into a closed period / locked year (application paths)** | Every posting path takes the fiscal-year advisory lock and re-reads the years under it: `persistGeneratedEntry(s)` (`ledgerPostingHelpers.ts:38-153`), manual create/update/bulk (`accountingEntryMutationUseCases.ts:74,165,215`), reversal (`:167`), close (`accountingPeriodClose.ts:64`), period close/reopen. The DB re-checks closed periods at commit (`0249`). |
| **Retained-earnings rollup is atomic** | `closeFiscalYearForTenant` is one transaction: fiscal-year row lock → advisory lock → re-read years → IAS 21 revaluation pre-check → trial-balance balance pre-check → closing entry (idempotent via `findEntryIdBySource` + the unique source key) → `status='closed'` → audit. `buildClosingEntryLines` uses the report's normal-side balance convention (contra accounts flip correctly). `accountingCloseConcurrencyDb` proves close-once and no half-close, including a posting racing the close. |

---

## 2. Findings

### P0 — bypassable invariant

**L1 · Double entry was enforced in the functional currency only.** *Fixed (narrowed after measurement).*
`isJournalEntryBalanced` sums `debit/credit`; `resolveJournalFxLines` (`accountingFxLines.ts:106-144`)
derives functional amounts and absorbs rounding but never compares the document-currency legs, and the
database only mirrored the functional pair. A voucher written in one foreign currency could therefore
balance in PKR while its own document was short by any amount (per-line rates make that easy), and the FX
report's per-currency exposure and realised FX then describe a position the ledger never held.
*Fix:* `journalCurrencyImbalances` (`packages/shared/src/finance/accountingCurrencyBalance.ts:39`), enforced in
`prepareJournalEntryForPersist` (`accountingLedgerGuards.ts:70-86`) and in the commit-time
`accounting_assert_entry_postable`. **Scope, corrected during implementation:** the invariant is
checkable only for a **single-currency** voucher. A mixed-currency voucher cannot be held to it — a
payment settlement retires a USD receivable against PKR cash and books the realised gain in the
functional currency, so its lines are in different currencies by design. The first implementation
enforced per-currency balance on every entry and was rejected by an existing settlement test
(`ledgerPostingService`: "release AR at 280 and book the gain") — the correct rule, and the one shipped,
is: single-currency vouchers must balance in their currency; mixed entries are excluded; rows with a
missing `txn_*` leg (pre-backfill) are excluded. `audit:ledger-currency-balance` reports existing
violations and the migration only warns, so the deploy is never blocked by historical data.

**L2 · System postings bypassed the account-writability guard.** *Fixed.*
`assertJournalAccountsWritable` was called only from the manual create/update/bulk and reversal paths.
`persistGeneratedEntry`/`persistGeneratedEntries`, `tryPostOpeningJournal` and the year-end close never
called it. Reachable today: opening balances accepted **any** `accountId` (`accountingLedgerOps.ts:49-61`
validated single-sidedness only) and posted them, and deactivating a posting-rule account after
configuration left every invoice/payment posting writing lines to a deactivated account (rule validation
runs only when the rules are saved). Violates "posted entries need valid … active tenant-owned accounts".
*Fix:* the guard now runs in `persistGeneratedEntry`/`persistGeneratedEntries`
(`ledgerPostingHelpers.ts:106,149`), for the closing entry, and opening balances are validated at edit
time. Account ids are read with `FOR SHARE` (`lockPostableAccounts`) so an archival cannot commit
underneath a posting.

**L3 · No header/summary-account protection.** *Fixed.*
Nothing in the module modelled header/summary accounts: no `isPostable`/`isSummary`/header field, and
`assertJournalAccountsWritable` only checked existence/deactivation. Since 0253 introduced the COA parent
link, a journal line could target a parent that has children, silently double-counting in any rollup.
*Fix (derived from the hierarchy, per the approved decision):* an account with active children is a
summary account. Rejected in `assertAccountIdsPostable` (`accountingAccountPostability.ts:38`, readable 422 naming the account) and at the
database (`accounting_journal_line_summary_guard`). The mirror rule also holds: an account that already
carries journal lines cannot become a parent (application guard + `accounting_account_hierarchy_guard`).
The COA line pickers filter summary accounts (`accountOptions.ts`) so the UI stops offering a rejected
option.

### P1 — races and enforcement gaps

**L4 · `reopenPostingPeriod` was a check-then-lock race.** *Fixed.*
It read the fiscal year (`accountingPostingPeriodUseCases.ts:90-93` before the fix) and only then took
the advisory lock (`:94`), while `setPostingPeriodStatus` writes unconditionally
(`accountingPostingPeriodsRepository.ts:171-199`). A close committing while the reopen waited left an
**open period inside a closed fiscal year** — the state the monthly lock exists to prevent.
*Fix:* lock first, then the reads the decision uses (`:47,97`); a database guard
(`accounting_posting_period_status_guard`, 0254) refuses reopening a period of a closed year for any
caller. Proven with two real connections (`accountingPeriodReopenRaceDb`).

**L5 · The database could not enforce a closed fiscal year, and a restore erased the period locks.** *Fixed, with one residual.*
`0249:69-87` checked `accounting_posting_periods` only, so a writer that bypassed the application could
post into a closed year whose periods were open or missing. `replaceFiscalYearsForWorkspace`
(`accountingFiscalYearsRepository.ts:276-292`) deleted and re-inserted years without
`syncPostingPeriods`; periods cascade-delete with their year and are not in the restore snapshot, so a
restore left **no** monthly locks at all.
*Fix:* the postable guard now also rejects a date inside a closed `accounting_fiscal_years` row; the
restore path regenerates the periods (`:295`), closed years come back with closed months. **Residual
(documented):** the backup snapshot does not carry the monthly lock *state* of an open year, so months
that were closed individually reopen as open after a restore and must be re-closed. The year-level lock
is preserved because it lives on the year row.

**L6 · Deactivate/archive versus post was unlocked.** *Fixed.*
Posting guards read accounts through a replica reader (`findAccountsByIds`) with no lock while account
archival takes `FOR UPDATE` (0253): a posting that validated just before an archive committed landed
lines on an archived account — exactly the "prior active-account lookup in another transaction is
insufficient" case.
*Fix:* `lockPostableAccounts` (`accountingAccountsRepository.ts:175`) reads `FOR SHARE` on the primary
and reports `hasChildren`; the posting guards use it. Archival waits for the posting and the posting
waits for a committed archive, re-evaluating `deleted_at IS NULL`.

**L7 · The `closing` exemption was broader than the close needs.** *Fixed.*
`0249:73-75` exempted *any* entry with `source_type='closing'` from the closed-period check, so a raw
writer could post into a closed period by labelling the row.
*Fix:* the exemption now applies only to the **registered** closing entry — `source_id` references a
fiscal year that is closed and whose `end_date` equals the entry date — which is precisely the write the
close performs in the transaction that closes the year. Pinned by `accountingPeriodLockDb`
(hand-labelled `closing` refused, legitimate close still allowed) and end-to-end by
`accountingCloseConcurrencyDb`.

### P2 — hardening

**H1 · Preparer attribution was rewritable.** `journalEntryContentChanged` ignored `created_by` and the
database did not freeze it, so an edit could rename who posted a voucher. *Fixed:* server-owned on
update (`withServerOwnedSourceKeys`) and frozen by `accounting_entries_posted_columns_guard` (0254).
**H2 · 32-bit advisory lock key.** The fiscal-year lock used `hashtext` while entry locks use
`hashtextextended`, so unrelated years could collide into one key. *Fixed:* both use 64-bit hashing.
**H3 · FX rounding line used a fixed id.** A client line already called `fx-rounding` collided on the
line primary key and surfaced as a misleading 409. *Fixed:* the id is derived (`fx-rounding-<n>`).
**H4 · The closed-period read ran through the replica helper.** Correct only because every caller
happened to hold a transaction. *Fixed:* the read now runs on the primary
(`accountingPostingPeriodsRepository.findClosedPostingPeriodForDate`).

### Documented decisions (no change)
A workspace with no fiscal years/periods stays postable (bootstrap rule); dates after the last configured
year stay allowed; a manually posted mirror entry is not detected as a reversal (only the endpoint or a
legacy `reversed_ref`); backup restore trusts its payload (maintenance flags disable the guards); draft
entries may be unbalanced and may reference not-yet-postable accounts until they are posted; reverse of a
reversal is allowed (it is a second linked correction, and the unique source key still prevents a
duplicate of the original reversal).

---

## 3. Deviations from the approved plan

1. **L1 was narrowed after the code proved the broader rule wrong.** The plan said "every currency's
   legs must balance" and the first implementation enforced that in the app and in the DB trigger. An
   existing settlement test immediately failed (`does not balance per currency: USD debit 0.00 vs credit
   1000.00`): a payment that retires a USD receivable against PKR cash legitimately has a credit-only USD
   leg. The shipped rule is single-currency vouchers only (L1, §2), in the app, the DB trigger **and** the
   audit script; mixed-currency vouchers keep the functional invariant as their only balance rule. The
   `functionalCurrency` plumbing the plan implied became unnecessary and was removed.
2. **No separate `findClosedPostingPeriodForDateInTx`.** Instead of adding a parallel API, the existing
   reader was moved onto the primary (H4) — same effect, fewer surfaces.
3. **Two-connection proof for the reopen race was implemented** (`accountingPeriodReopenRaceDb`), not
   only a sequential test.
4. **Frontend picker filter added** (not in the plan text): once posting to a summary account is a 422,
   the journal line pickers must stop offering it.

---

## 4. Files changed

| File | Change |
|---|---|
| `apps/backend/src/db/migrations_drizzle/0254_accounting_ledger_control_hardening.sql` | new: commit-time per-currency + closed-fiscal-year checks, narrowed closing exemption, summary-account line guard, "used account cannot become a parent", frozen `created_by`, period-reopen guard, report-only warnings |
| `…/meta/0254_accounting_ledger_control_hardening_snapshot.json`, `meta/_journal.json` | snapshot derived from 0253 + journal entry (no schema delta) |
| `apps/backend/src/accounting/use-cases/accountingLedgerGuards.ts` | transaction-currency check; `created_by` server-owned; re-exports the split modules |
| `apps/backend/src/accounting/use-cases/accountingAccountPostability.ts` | new: `assertAccountIdsPostable` / `assertJournalAccountsWritable` (summary + locking loader) |
| `apps/backend/src/accounting/use-cases/accountingLedgerErrors.ts` | new: the 422 `ledgerError` shape shared by both guard modules |
| `apps/backend/src/accounting/ledgerPosting/ledgerPostingHelpers.ts` | postability guard on generated postings |
| `apps/backend/src/accounting/use-cases/accountingPeriodClose.ts` | postability guard for closing lines |
| `apps/backend/src/accounting/use-cases/accountingLedgerOpsUseCases.ts` | opening balances validated at edit time; summary accounts rejected as posting-rule targets |
| `apps/backend/src/accounting/use-cases/accountingPostingPeriodUseCases.ts` | lock-before-read for close and reopen |
| `apps/backend/src/accounting/ledgerPosting/fiscalYearPostingLock.ts` | 64-bit advisory key |
| `apps/backend/src/db/repositories/accountingAccountsRepository.ts` | `lockPostableAccounts` (`FOR SHARE`, `hasChildren`), `findSummaryAccountIds` |
| `apps/backend/src/db/repositories/accountingFiscalYearsRepository.ts` | restore regenerates posting periods |
| `apps/backend/src/db/repositories/accountingPostingPeriodsRepository.ts` | closed-period read on the primary |
| `apps/backend/src/db/repositories/accountingAccountGuards.ts` | hierarchy guard rejects reparenting a used account (422) |
| `apps/backend/src/db/repositories/accountingAccountLedgerLines.ts` | new: `postedActiveLineScope` / `postedLineCountsByAccount` (split for the 300-line ceiling) |
| `apps/backend/src/accounting/repository/accountingRepository.ts` + adapter | `lockPostableAccounts` |
| `packages/shared/src/finance/accountingLedgerInvariants.ts` | (split: currency checks moved out) |
| `packages/shared/src/finance/accountingCurrencyBalance.ts` | new: `journalCurrencyImbalances`, `formatJournalCurrencyImbalance` |
| `packages/shared/src/finance/accountingAccountHierarchy.ts` | `summaryAccountIds` |
| `packages/shared/src/finance/accountingFxLines.ts` | unique FX-rounding line id |
| `apps/frontend/src/tenant/features/accounting/lib/accountOptions.ts` | summary accounts excluded from pickers |
| `apps/backend/src/scripts/audit-ledger-currency-balance.ts` + `package.json` | new audit script (`audit:ledger-currency-balance`) |

## 5. Tests

| Suite | Added/changed |
|---|---|
| `accountingLedgerInvariants.test.ts` (shared) | single-currency imbalance reporting, mixed settlement excluded, pre-backfill NULL legs excluded, 4-dp exactness |
| `accountingAccountHierarchy.test.ts` (shared) | `summaryAccountIds` (active child, archived child, dangling parent) |
| `accountingLedgerGuards.test.ts` | transaction-currency rejection (functional balances, document does not), balanced foreign voucher, mixed settlement accepted, draft untouched, summary-account rejection, `created_by` ownership |
| `accountingLedgerOpsUseCases.test.ts` | opening balance on archived and on summary account refused; posting rule on summary account refused |
| `accountingPostingPeriodReopen.test.ts` (new) | lock-before-read order for close and reopen, closed-year refusal, serialization key |
| `accountingLedgerControlDb` (new, DB) | raw-SQL rejection of a single-currency imbalance, balanced foreign voucher accepted, mixed settlement accepted, pre-backfill skipped, summary-account line rejected, used account cannot become a parent, closed-year posting rejected with open periods, registered closing entry allowed / hand-labelled refused, period reopen of a closed year refused (and allowed in an open year), restore regenerates periods |
| `accountingPeriodReopenRaceDb` (new, DB) | deterministic reopen-behind-close (2 connections) and the concurrent invariant "never an open period in a closed year" |
| `accountingPeriodLockDb` | the exemption case rewritten to pin the narrowed rule |
| `accountingPostedLedgerGuardsDb` | `created_by` frozen on a posted voucher |

Measured on a fresh PostgreSQL 16: **24 accounting DB suites / 163 tests**, **11 finance DB suites / 42
tests**, backend unit **540 files / 3854 tests**, shared **287 files / 2336 tests**, all green;
`audit:ledger-currency-balance` returns 0 on a clean database and exit 1 when an imbalanced entry is
injected (verified by inserting one under the maintenance flag, then removing it).

## 6. Reviewed exception: hand-authored migration snapshot

`drizzle-kit generate` still cannot run (malformed committed snapshot chain — see
`docs/finance-accounting-schema-persistence-audit-2026-11-12.md` §5). `0254` changes functions and triggers
only, so `meta/0254_accounting_ledger_control_hardening_snapshot.json` is the `0253` snapshot with a new
`id`/`prevId`, and the journal entry carries `idx: 254`. Regenerate `0254` with the chain.

## Appendix — reproduction

```bash
docker run -d --name mms-audit-pg -e POSTGRES_PASSWORD=mms -e POSTGRES_USER=mms \
  -e POSTGRES_DB=mms -p 55433:5432 postgres:16-alpine
export DATABASE_URL="postgres://mms:mms@127.0.0.1:55433/mms"
pnpm --filter mms-backend db:migrate
pnpm --filter mms-backend test:db -- accounting
pnpm --filter mms-backend audit:ledger-currency-balance
```

```sql
-- 1. Which guards exist (expect the four 0254 triggers)
SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal AND c.relname LIKE 'accounting%' ORDER BY 1;

-- 2. A posted entry dated inside a closed fiscal year is refused even when its
--    periods are open (expect check_violation)
BEGIN;
INSERT INTO accounting_entries (id, workspace_subdomain, date, ref, description, status, created_by, fiscal_year)
VALUES ('probe', '<ws>', '<closed-year-date>', 'PROBE', 'x', 'posted', 't', '');
INSERT INTO accounting_journal_lines (id, workspace_subdomain, entry_id, account_id, debit, credit, func_debit, func_credit)
VALUES ('p1','<ws>','probe','<asset>','1','0','1','0'), ('p2','<ws>','probe','<revenue>','0','1','0','1');
COMMIT;

-- 3. A line on a summary account is refused (expect check_violation)
BEGIN;
INSERT INTO accounting_journal_lines (id, workspace_subdomain, entry_id, account_id, debit, credit)
VALUES ('p3','<ws>','<some entry>','<account with children>','1','0');
ROLLBACK;
```

Measured after the change: 0254 applied cleanly on a fresh database; the four new triggers and the
rewritten functions are present; the two new DB suites pass; `audit:ledger-currency-balance` is silent on
a clean database and exits 1 on an injected imbalanced entry.
