# Finance frontend architecture, forms and cache invalidation — audit and hardening

Scope: the Finance/Accounting module pages (`ModulePageShell`/`ModuleScaffold`), the ledger explorer and report visualizations (`FinancialReportCharts`), the journal-voucher and invoice/payment forms (`FormModal`), and the TanStack Query factories that keep ledger, report and dashboard data fresh.

Method: traced the page controllers and list state, the query-key hierarchy and every invalidator (mutation + websocket), the multi-line voucher editor and its totals, the currency-preview path, the form submit paths, the report chart data/axis configuration, and the render tree of a voucher row. Then exercised the fixes with unit tests (submit guard, cents totals, invalidators, chart direction) and a real listing of the affected suites.

---

## 1. Verified baseline

- **State separation is sound:** `FinancePage` → `ModulePageShell` delegates to `ModuleScaffold` (skeleton, ErrorBoundary, SEO); page state lives in `useFinancePageController` + focused hooks (modal state, selection, column layout, trash, status filter). Tab state is persisted, not duplicated.
- **The ledger explorer is server-backed** with exact integer-cent running balances and paging (`useAccountingLedger`); the client-side aggregate cap no longer feeds a report total.
- **Voucher totals were cent-exact on the values side**: `getJournalEntryLineTotals` and `isJournalEntryBalanced` operate on cents (no 0.01 tolerance). The remaining float paths were the *summation* and balancing-line code (fixed below).
- **Currency previews are exact**: invoice/journal/payment previews call shared `previewConvertedAmount` (BigInt minor units) and format the result; no `Number()` on a rate.
- **BiDi layout** in finance/accounting components uses logical utilities (`ps/pe/ms/me`, `text-start/end`, `align: end`); no physical direction classes were found.
- **Error handling on lists** exists (`ErrorState` + retry for invoices/payments) and the accounting reports page already has loading/error skeletons.

## 2. Findings and fixes

### P1 — cross-module stale caches

**F1 — a Finance posting never refreshed Accounting.** Finance mutations invalidated finance keys only, and the backend broadcast only `finance_*` collections on invoice/payment/credit/reversal paths. The acting client kept a stale ledger, Trial Balance/BS/IS (5-minute `staleTime`), metrics, General Ledger and receivables aging; other clients received no `accounting_entries` update at all. *Fixed:*
- `persistGeneratedEntry` / `persistGeneratedEntries` now live-push `accounting_entries` + `accounting_metrics` after a committed generated posting (best-effort; a push failure cannot fail the posting). One place covers invoice/payment/credit/reversal/opening/close/FX.
- `invalidateFinanceQueries` now also runs `invalidateAccountingQueries` (public collections surface) and the dashboard data invalidator, so the actor is correct even with the socket down; Accounting does not call back into Finance (a ledger write leaves invoices/payments unchanged), so there is no cycle.

**F2 — dashboards were stale on the acting client.** Only the websocket dispatcher invalidated the dashboard summary and dynamic widget aggregates. *Fixed:* a keys-only `invalidateDashboardDataQueries` (summary root + dynamic widget aggregates) is called by both module invalidators; it deliberately lives in `lib/query` rather than the dashboard setup module so module invalidators do not pull the dashboard API/auth graph (and its test mocks) into their import graph.

### P1 — double submit

**F3 — two rapid clicks could post two vouchers.** The state-based `submitting`/`saving` flags only disable after a re-render, and the journal save generated a **new client id per invocation**, so a double call produced two distinct entries with different server voucher numbers. *Fixed:* a synchronous `useSubmitGuard` (ref set before the first await, released in `finally`) wraps journal/invoice/payment submits; a new journal draft now gets one stable id per form session (retries update the same draft); `saveEntry` catches `onSave` rejections and shows an inline form error instead of an unhandled promise (the mutation layer still toasts the reason).

### P1 — client float math

**F4 — voucher totals summed floats before converting to cents, and the balancing line used float rounding.** *Fixed:* totals accumulate per-line integer cents and divide once; `addLine` balances from the cents difference; the editor's “unbalanced by” footer computes the diff in cents; line amounts parse through strict `tryParseMoneyAmountNumber` (rejects exponents and 3+ decimals), with an inline per-row error (`accounting.journal.form.errorAmountFormat`).

**F5 — the finance report fallback aggregated floats over the first 100 invoices.** *Fixed:* the fallback accumulates integer cents (collected/outstanding/total and discounts), and when it is used the report shows a fallback notice (“from the 100 most recent invoices”) instead of pretending the chart is complete. Server aggregates remain the primary source.

### P2 — loading / empty / error states

**F6 — the finance report had no loading state and never used the chart empty state.** *Fixed:* skeleton while either query loads; both chart cards receive `empty` + `emptyNode` (`finance.report.noCollectionData`, `finance.report.noDiscountData`); ErrorState + retry unchanged.

**F7 — Finance lists flashed “empty” during the first load.** *Fixed:* `isLoading` threads from the controller through `InvoicesList`/`PaymentsList` into their content; a shared `FinanceListLoadingSkeleton` (aria-busy) renders instead of the empty state.

**F8 — the ledger panel had no loading skeleton.** *Fixed:* skeleton rows while the first ledger page loads; the existing 404/load-failed state is unchanged.

### P2 — BiDi report charts

**F9 — charts were LTR in RTL locales.** Recharts axes/legend ignored the writing direction. *Fixed:* `chartDirection(isRtl)` flips the X axis (`reversed`), moves the Y axis to the right and mirrors the legend; applied to the Finance report charts. LTR rendering is unchanged.

### P2 — sluggish multi-line re-renders

**F10 — every keystroke re-rendered every voucher row.** `JournalEntryLineRow` was not memoized, `accountOptions` and callbacks were rebuilt per render, and the mobile list was an inline map. *Fixed:* the row is memoized with an explicit comparator (line identity, account/options identity, error and lock flags, callbacks); `accountOptions`/`accountMap` are memoized and the handlers are `useCallback`-stable; the mobile card was extracted and memoized the same way. One keystroke now re-renders only the edited row (and the totals strip).

## 3. Invalidation matrix (after the fix)

| Mutation | Finance keys | Accounting keys (entries/report/metrics/GL/aging) | Dashboard data |
|---|---|---|---|
| Create/update/delete invoice, payment, bulk status/delete, restore | ✓ | ✓ (posting or reversal journal) | ✓ |
| Credit note / cancel invoice / collect overdue (late fee) | ✓ | ✓ | ✓ |
| Journal entry create/update/post/delete/restore, reversal | — (no finance-document change) | ✓ | ✓ |
| Fiscal-year close, opening balances, posting rules, voucher numbering, seed | — | ✓ | ✓ |
| Any domain collection update over `/api/ws` | module mapping | module mapping | ✓ (existing dispatcher) |

## 4. Landed changes

| Area | Change |
|---|---|
| `accounting/ledgerPosting/ledgerPostingHelpers.ts` | best-effort `accounting_entries`/`accounting_metrics` live push after generated postings (single + batch) |
| `lib/query/dashboardDataInvalidation.ts` (new), `lib/query/dashboardQueryKeys` usage | keys-only dashboard data invalidator |
| `invalidateFinanceQueries.ts`, `invalidateAccountingQueries.ts` | cross-module + dashboard invalidation wrappers |
| `lib/forms/useSubmitGuard.ts` (new) | synchronous in-flight guard |
| `useJournalEntryForm.ts` | guard, stable draft id, cents totals/balancing, error surfacing |
| `journalEntryFormValidation.ts` | strict 2-dp line parsing + inline amount errors |
| `JournalEntryLinesEditor.tsx`, `JournalEntryLineRow.tsx`, `JournalEntryLinesEditorMobile.tsx` | cents footer diff, memoized rows/cards, memoized account maps |
| `InvoiceForm.tsx`, `PaymentForm.tsx` | submit guard |
| `FinancePage.tsx`, `InvoicesList*`, `PaymentsList*`, `FinanceListLoadingSkeleton.tsx` (new) | loading skeleton instead of empty flash |
| `lib/ui/chartDirection.ts` (new), `FinancialReportSections.tsx` | RTL axes/legend + chart empty states |
| `FinancialReport.tsx` | loading skeleton, cents fallback, capped-data notice |
| `GeneralLedger.tsx` | loading skeleton |
| 4 locale files | `errorAmountFormat`, `noCollectionData`, `noDiscountData`, `fallbackNotice` |

## 5. Evidence

- `useSubmitGuard.test.tsx` (2): one execution while in flight; guard released after success and failure.
- `useJournalEntryForm.test.tsx` (+3): multi-line totals exact at `0.3` for `0.10 + 0.20`; over-precision input produces the inline line error and blocks save; two synchronous `saveEntry` calls invoke `onSave` once.
- `invalidateFinanceQueries.test.ts` (1): finance + accounting entries/report-aggregates/metrics + dashboard summary/widget-aggregate keys all invalidated.
- `invalidateAccountingQueries.test.ts` (1): accounting + dashboard invalidated, finance keys untouched.
- `chartDirection.test.ts` (2): LTR vs RTL geometry.
- Backend `ledgerPostingService.test.ts` (+1): a generated posting broadcasts `accounting_entries` and `accounting_metrics`.
- Suites: frontend finance/accounting/reports 107 files / 514 tests (before the new tests; re-run in the gate), backend unit full suite, shared tests, and the ratchets below.

## 6. Rollout notes

1. The new live push fires only when a generated entry was actually persisted (idempotent replay returns `null` first), so replayed postings do not emit duplicate invalidations.
2. Finance mutations now invalidate Accounting caches too — a few extra refetches on posting, acceptable for correctness; the dashboard data invalidation is one summary + one widget-aggregate request.
3. A malformed/over-precision voucher amount now shows a per-row error instead of silently rounding; negative amounts remain rejected by the posting schema.
4. Chart geometry changes only under RTL; screenshots/tests for LTR are unchanged.

## 7. Documented limitations (not changed)

- Finance Work lists still fetch `limit: 100` and paginate client-side; a server-driven pager is a follow-up.
- No request-level idempotency key for invoice/payment creation — the UI double-submit is guarded, but a network-level retry is a backend feature.
- Chart RTL was applied to the Finance report charts; other modules' Recharts surfaces can adopt `chartDirection` incrementally.
