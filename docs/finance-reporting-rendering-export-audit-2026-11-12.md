# Finance reporting, printable documents, exports and COA seeding — audit and hardening

Scope: the accounting-report SQL (`accountingRepositoryReport`), the General Ledger and receivables-aging surfaces, printable fee receipts/invoices/vouchers and their BiDi/RTL behaviour, streaming CSV/XLSX exports, and the default Chart-of-Accounts seed (`accountingSeedDb`).

Method: read the report builders and their DB predicates, the report/GL/aging data flow (server aggregates vs browser aggregates), the document-template renderer and print window, the Typst templates, the CSV/XLSX streaming helpers, and the seed transaction; then exercised the paths against PostgreSQL (ledger paging, aging buckets, opening-balance revisions, fiscal-year overlap, 10k-line EXPLAIN plans) and Vitest (schemas, exporter sanitising, print batching).

Status: **Fixed** items ship with this change; **Verified** items were exercised; **Documented** items are deliberate limitations or follow-ups.

---

## 1. Verified baseline

| Guarantee | Evidence |
|---|---|
| **Report math reconciles** | `aggregateAccountingReport` computes the movement set (range, closing excluded), the P&L set and the cumulative as-of set separately; equity includes the unclosed as-of surplus exactly once; the existing DB suite asserts `assets = liabilities + equity`, a closing entry zeroes the P&L in `incomeStatementTrialBalance` while the trial balance still balances, and indirect cash flow equals the direct cash movement. Trial Balance/BS/IS panels consume this server aggregate (the old browser TB was removed). |
| **Date cutoff** | All report predicates filter `status = 'posted'`, `deleted_at IS NULL` and an inclusive `date` range on the `date` column (no timestamp truncation). The balance-sheet/equity as-of figures deliberately ignore `dateFrom` so prior-period assets are not dropped. |
| **Indexes** | `accounting_entries (workspace, status, date DESC) WHERE deleted_at IS NULL`, `accounting_journal_lines (workspace, account_id) INCLUDE (debit, credit)` and `(workspace, entry_id)`, `finance_invoices (workspace, status, due_date) WHERE deleted_at IS NULL`. A seeded 10k-entry tenant confirms the trial-balance access path uses the entry/line indexes (no sequential scan on those tables); the aging predicate has a usable status/due-date index. |
| **BiDi/RTL rendering** | The template renderer sets the print window `dir` from the locale, supports a per-element `direction` plus script auto-detection, and the print helper uses the template's paper size/orientation. The Typst templates (`fee-receipt.typ`, `financial-ledger.typ`, `report-card.typ`) set `text(dir: rtl|ltr)` with Arabic/Urdu fonts; both are covered by existing tests. |
| **Streaming bounds** | `streamCsvToStorage` honours `PassThrough` backpressure (`drain`) and abort checks; `streamTableToExcel` streams via ExcelJS `WorkbookWriter`; the PDF path compiles to disk, streams to storage and cleans up, with concurrency 2 and a 15 s compile timeout. Memory tests cover 50k CSV rows (<50 MB), 10k XLSX rows (<120 MB) and 500 concurrent worker tasks (<50 MB). |
| **Formula-injection safety** | Every client CSV export routes through `buildCsvContent` → `escapeCsvCell` (neutralises `= + - @ | %`, leading tab/CR and whitespace-hidden formulas while keeping plain negative numerics numeric). The XLSX exporter passes values to ExcelJS as string cells, so `=SUM(...)` stays literal text — proven by test. |
| **COA seeding idempotency** | `seedAccountsIfEmpty` takes a per-workspace advisory lock, refuses when any row exists (archived included), and inserts the chart plus settings defaults in one transaction; defaults are filled only where unset. Tests cover fresh seed, replay, dangling-preference repair, one-workspace race, cross-tenant concurrency and archived-row refusal. |

## 2. Findings

### P1 — fixed

**F1 — malformed report/list dates crashed with a 500.** `accountingReportQuerySchema` and `accountingEntriesListQuerySchema` accepted any string up to 32 chars for `dateFrom`/`dateTo`. A non-date reached the `date` column comparison, PostgreSQL raised `22007`/`22008`, and neither was mapped → 500. The FX report schema already validated dates, so the module was inconsistent. *Fixed:* both schemas now use `isoDateSchema` with a `dateFrom <= dateTo` refinement (400 with a domain message); `22007`/`22008` map to 400 as defence. Tests cover malformed dates and reversed ranges.

**F2 — the General Ledger silently truncated at 5,000 entries.** `fetchAllAccountingEntries` paged at most 50×100 rows and returned the slice unflagged; `useGeneralLedger` computed the running and closing balances from it. A tenant with a larger ledger saw a wrong closing balance that still looked balanced. *Fixed:* a server endpoint `GET /api/accounting/ledger` computes the opening balance, the page's running balance and the whole-window totals in integer cents; the GL panel now pages the server report (with CSV export paging through the same endpoint and warning when the export cap is hit). `fetchAllAccountingEntries` remains only for the journal quick-add lookups and documents its cap; it no longer feeds any report total.

**F3 — the Student Aging report did not exist.** No server aggregation, no view; the only receivable figure was the cash-flow adjustment. *Fixed:* `GET /api/accounting/receivables-aging?asOf` returns per-student buckets — current/not-due, 1–30, 31–60, 61–90, 90+ — over open invoices (pending/partial/overdue, non-deleted), using the stored balances so a later late fee cannot rewrite an earlier report. Exact totals always cover every open invoice; the row list is capped at 500 with a flag. The Accounting Reports tab has an "Aging" view with CSV export. DB tests cover bucket boundaries, the as-of cutoff, excluded statuses/deleted rows and later-date bucket movement.

**F4 — opening balances could not be corrected after posting.** `findEntryIdBySource("opening", fy)` kept matching the reversed original and the `(source_type, source_id)` unique index blocked a replacement, so the error's advice ("reverse that entry before editing") could never be followed — the ledger stayed on the original figures. *Fixed:* opening postings resolve the latest entry + its active reversal; a reversed opening entry allows editing and re-posting as a revision (`source_id = "<fy>:r2"`, `:r3`, …), unchanged replay still returns `posted: false`, and the posting now writes an `opening_balances_posted` audit row. DB test: post → reverse → edit → repost → the as-of ledger shows only the corrected position.

**F5 — overlapping fiscal years could corrupt closing balances.** No write path validated ranges; an overlap let one close sweep another year's P&L into retained earnings and the second close then saw a zeroed P&L and closed without a closing entry. *Fixed:* the bulk-save guard returns a readable 422 naming the conflicting pair; migration 0251 adds an exclusion constraint on `daterange(start_date, end_date, '[]')` per workspace (partial: archived years ignored), with a descriptive pre-check listing any existing conflicts; `23P01` maps to 409. Tests: adjacent accepted, overlap rejected, archived ignored, direct SQL rejected.

### P2 — fixed

**F6 — batch receipt printing was unbounded and doubled the DOM.** The receipt modal rendered every selected invoice twice (offscreen print copy + preview). *Fixed:* `MAX_RECEIPT_PRINT_BATCH = 100`, with the omitted count shown in the modal and a warning before printing; a pure helper plus tests cover the cap and non-mutation.

**F7 — the report export sanitiser mangled negative amounts.** The FE `sanitizeExportValue` prefixed any string starting with `-`, turning `-100.50` into a text cell. *Fixed:* it now mirrors `escapeCsvCell` (formula triggers + whitespace-hidden form, negation exempt), with tests for `=`, `+`, `@`, `|`, `%`, tab/CR, whitespace and plain negatives.

### Documented limitations

- **No bank fee challan template/institutional bank-account settings.** Contacts carry bank fields; there is no workspace-level bank account to print a challan against. Recommended follow-up once that setting exists.
- **Finance printables are browser-only.** The Typst renderer is not reachable for finance (the fee-receipt/ledger runners were removed as dead in the previous worker audit), so receipts, invoices and journal vouchers print through the shared template editor. The server PDF path remains bounded for any future use.
- **Server-side finance/accounting CSV export is unavailable (503)**; report exports are the client CSV path, which is formula-safe and bounded.
- **The client journal aggregate stays capped** (`fetchAllAccountingEntries`, 5,000 entries) for the journal quick-add lookups and the dashboard's monthly/recent series (its KPI tiles prefer the server metrics). GL, TB, BS, IS and aging totals are server-computed now; a larger-ledger dashboard chart remains a follow-up.
- **Report aggregation still scans the ledger three times per request** (movement, P&L, as-of). The scans are index-backed; a single-pass rewrite is an optimisation follow-up.

## 3. Opening/closing balance matrix

| Concern | Behaviour | Guard |
|---|---|---|
| Opening posting | One journal at the fiscal-year start date, balanced, `source_type = opening` | `seed`/`post` transaction; unchanged replay returns `posted:false` |
| Correction after posting | Edit refused while the opening entry is live | 422 with the reversal instruction |
| Correction after reversal | Edit allowed; next posting becomes `fy:rN` | reversal-aware source resolution + unique source key |
| Close computation | P&L net balances of the year's range → retained earnings | refuses an unbalanced trial balance and an unrevalued foreign balance |
| Overlapping years | Rejected | app guard 422 + exclusion constraint (0251) |
| Archived years | Ignored by the overlap guard/constraint | partial `WHERE deleted_at IS NULL` |

## 4. Landed changes

| File | Change |
|---|---|
| `packages/shared/src/finance/accountingReportEndpoints.ts` (new) | ledger + aging query/response schemas, exported from the shared barrel |
| `packages/shared/src/finance/accountingReportAggregates.ts`, `accountingListQuery.ts` | ISO-date + ordered-range validation |
| `apps/backend/src/lib/dbErrorMapping.ts` | `22007`/`22008` → 400, `23P01` → 409 |
| `apps/backend/src/db/repositories/accountingReportEndpointsRepository.ts` (new) | integer-cent ledger/aging SQL |
| `apps/backend/src/accounting/use-cases/accountingReportEndpointsUseCases.ts` (new) | ledger page + aging DTOs |
| `apps/backend/src/routes/tenant/accounting/accountingReportRoutes.ts` | `GET /ledger`, `GET /receivables-aging` |
| `apps/backend/src/accounting/ledgerPosting/ledgerPostingService.ts`, `accounting/use-cases/accountingLedgerOpsUseCases.ts` | revisioned opening balances + audit |
| `apps/backend/src/accounting/use-cases/accountingAccountLifecycleUseCases.ts` | fiscal-year overlap guard |
| `apps/backend/src/db/migrations_drizzle/0251_fiscal_year_no_overlap.sql` | exclusion constraint + pre-check |
| FE `useAccountingQueries`, `useGeneralLedger`, `GeneralLedger`, `ReceivablesAgingPanel`, `FinancialReports`, `accountingListFetch` | server ledger paging, aging view, paged CSV export |
| FE `InvoiceReceiptModal`, `receiptPrintBatch` | print batch cap |
| FE `reportExportCore` | sanitizer parity with `escapeCsvCell` |

## 5. Evidence

- `accountingReportEndpointsDb` (5): ledger opening/running/totals/paging/404; aging buckets, cutoff, exclusions, later as-of.
- `accountingReportIndexPlanDb` (3): 10k-entry trial-balance plan has no seq scan on entries/lines and uses an index; aging index applicability; index presence.
- `accountingOpeningBalancesDb` (2): post → reverse → edit → revision flow and the audit row.
- `fiscalYearOverlapDb` (5): adjacent accepted, overlap 422, helper unit, DB exclusion violation, archived ignored.
- `accountingSeedDb` (+2): cross-tenant concurrent seed isolation; archived-row refusal.
- `excelStreaming` (+1): formula-looking strings are text cells, negative numerics stay numeric.
- `accountingReportEndpoints.test` (5): date schemas, ledger/aging query contracts.
- FE `reportExportCore` (3) and `receiptPrintBatch` (3) tests.
- Existing suites: backend unit (run in this change), shared 285 files/2302 tests, FE accounting 61/335.

## 6. Rollout notes

1. **Migration 0251** aborts with a message listing every overlapping fiscal-year pair. Resolve those pairs (adjust/delete one year) and re-run; adjacent years are unaffected. Dev data had zero overlaps.
2. **Report date filters now reject malformed dates** with 400 instead of 500. Any external caller that passed loose date strings must send `YYYY-MM-DD`.
3. **Opening-balance corrections** now require reversing the posted opening entry first (as the message always said) and then editing/reposting; the ledger keeps the original, reversal and revision entries, so audit remains complete.
4. **Receipt batch printing** stops at 100 invoices per action; a message reports the omitted count.

## 7. Out of scope / follow-ups

- Bank fee challan template once workspace bank-account settings exist.
- Server-side finance/accounting CSV/XLSX export (currently 503; client exports are hardened).
- Single-pass report aggregation / cached report snapshots.
- RLS-strict database role for migration execution (the dev connection is the `postgres` superuser; the migrate run logs the reminder).
