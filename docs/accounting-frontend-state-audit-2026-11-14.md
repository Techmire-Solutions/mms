# Accounting frontend architecture, voucher form & query-cache audit

Scope: the Accounting module's client surfaces — page/tier state, Chart of Accounts, General Ledger
drill-down, report charts, the multi-line voucher form, and the TanStack Query keys/invalidation used
by every ledger-affecting write.

Method: traced every state owner and cache key, then probed the form and the cache behaviour with
targeted tests (row render counts, invalidation matrix against a seeded `QueryClient`, real-Postgres
list projection, RTL chart markup).

## 1. Verified sound

| Area | Evidence |
|---|---|
| Page & tiers | `AccountingPage` renders `ModulePageShell` with lazy Reports/Setup tiers; tab, sub-tab, trash and create-request state live in `useAccountingPageController`; the work tier receives query data read-only — no duplicated DTO copies |
| COA data flow | Server-paginated/full account list via `useAllAccountingAccounts`; the screen owns only view state (search/type/inactive/modal) and the optimistic `onChange` updater |
| General Ledger drill-down | `useGeneralLedger` keeps filter state locally, resets the page on every filter change, and reads the server-computed page (`ACCOUNTING_LEDGER_QUERY_KEY` under the entries prefix) — the old 5,000-entry browser aggregate is gone |
| Balance math | `useJournalEntryForm` sums integer cents and applies the shared `isJournalEntryBalanced`; `addLine` pre-fills the remaining imbalance in cents — no float tolerance |
| Submission blocking | `validateJournalEntryForm` blocks **posted** vouchers when unbalanced, lets drafts save, and requires a usable FX rate for foreign entries |
| Multi-currency preview | `JournalEntryCurrencyFields` shows the functional equivalent (`previewConvertedAmount`), disables submission without a rate, and warns when the FX rounding account is unset; `applyEntryCurrency` stamps `txn_*`/rate at save |
| Query-key shape | One `["accounting", …]` family; entries detail/ledger/aging are children of the entries prefix, so one prefix invalidation reaches all of them; report aggregates keep `staleTime: 5 min` but are invalidated centrally |
| BiDi (CSS) | No physical direction utilities in the accounting feature — logical `ms/me/ps/pe/text-end` throughout the shell, tables, drawers and print surfaces |
| Loading/empty/error | Trial Balance, Financial Reports, COA (seed empty state), GL and the tier-level `listLoadFailed` error path were already explicit |

## 2. Findings and fixes

- **F1 (P1) — the voucher picker offered header/summary accounts.** The form built its option list
  inline (active accounts only), while every other picker used `accountOptions()` with the shared
  `summaryAccountIds()` exclusion. A parent account could be selected and only failed at save.
  **Fixed:** the form now builds its options from `accountOptions(accounts)` (header-excluded, sorted,
  `code – name` labels), memoized on `[accounts]`; a new `accountOptions` test pins the exclusion.
- **F2 (P1) — the memoized voucher rows re-rendered on every keystroke.** `JournalEntryForm` passed an
  inline `onOpenAddAccount` closure and the editor re-wrapped it per row; `areRowPropsEqual` compares
  that prop, so its identity change defeated the row memo for **every** row on each keystroke
  whenever quick-create was available.
  **Fixed:** `useAccountQuickCreate` memoizes `openCreate/close/handleSave/existingCodes`, the form
  derives a stable `openAddAccount` via `useCallback`, and the editor now passes it straight through
  (the row calls `onOpenAddAccount(lineIndex)` internally). Rows are memoized again.
- **F3 (P1) — reversal detection was page-scoped.** `hasReversalEntry` scanned only the current page,
  so a reversal on another page was invisible and the UI offered an action the server rejected (409).
  **Fixed:** the entries list/detail projection now carries `active_reversal_entry_id` (additive DTO
  field + a correlated `EXISTS`-style subquery matching the backend reversal lookup), the row action
  hides Reverse for a reversed voucher, and the click guard keeps the page scan as a fallback for
  older cached payloads. The projection test proves it works with the reversal off-page.
- **F4 (P1) — an FX-rate save left the FX report stale.** Only the rate list/lookup were invalidated;
  the exposure report (`["accounting","fx","report",…]`) converts balances at the as-of closing rate.
  **Fixed:** `invalidateExchangeRateQueries` invalidates the FX prefix (rates, lookup, report,
  revaluations) plus the accounting report/metric/dashboard caches.
- **F5 (P2) — a fee/salary posting skipped dashboard invalidation.** The mutation invalidated the
  `["accounting"]`/`["finance"]` prefixes but not the dashboard summary/dynamic-widget keys that live
  outside them.
  **Fixed:** `invalidateSpecializedEntryQueries` now runs both module invalidators, the central
  accounting invalidator and `invalidateDashboardDataQueries`.
- **F6 (P2) — the dashboard rendered zeros while loading or after an error.** No loading/error branch
  existed, so pending or failed metrics looked like real `0` balances.
  **Fixed:** `useAccountingDashboardView` exposes `isLoading`/`isError`/`refetch`; the dashboard
  renders an `aria-busy` skeleton grid while loading and an `ErrorState` with retry on failure.
- **F7 (P2) — dead/misleading ledger props.** `TrialBalance` accepted `accounts?/entries?` and ignored
  them, while `AccountingWorkTier` passed `aggregateEntries` that was in fact the current page.
  **Fixed:** the dead props are gone, the tier passes only `fiscalYears`, the `allEntries` chain was
  removed, and the controller no longer defines an "aggregate" collection at all — a page cannot stand
  in for the ledger by construction.
- **F8 (P3) — header accounts were invisible in the chart.** The UI is a flat, type-grouped list (a
  deliberate decision — hierarchy enforcement stays server-side), so nothing marked the accounts the
  journal pickers refuse.
  **Fixed:** `ChartOfAccounts` computes `summaryAccountIds` once and shows a "Header account" badge
  (with the `headerHint` tooltip) on the table name cell and the mobile card; the badge carries
  `data-account-kind="header"`.
- **F9 (P3) — Recharts axes/legend stayed LTR in RTL locales.** The pages use logical CSS, but chart
  geometry did not follow the direction.
  **Fixed:** the dashboard charts read `isRtlLanguage(language)`, reverse the X axis and mirror the
  pie legend order in ar/ur/fa; the LTR behaviour is unchanged and the sr-only data table remains.
- **F10 (P3) — duplicated register key literal.** `accountingListFetch` re-declared the entries-list
  prefix to dodge an import cycle, so the page key could silently drift from the invalidation target.
  **Fixed:** `ACCOUNTING_ENTRIES_LIST_PREFIX` is exported from `accountingQueryKeys.ts` and imported
  by both the register hook and the invalidator (no cycle exists).

## 3. Cache invalidation matrix

`accountingQueryInvalidationMatrix.test.ts` seeds a `QueryClient` with every accounting key and asserts
the invalidation helpers reach all of them:

| Write | Ledger keys (entries list/detail/ledger/aging/page, accounts, aggregates, metrics, fiscal years, preferences, voucher numbering) | FX report & rates | Dashboard summary + dynamic widgets |
|---|---|---|---|
| Journal save/delete/restore, reversal, close/reopen, fiscal close, posting rules, opening post, chart seed, hedge valuation, FX revaluation, IAS 29 | ✔ | ✔ (via the central invalidator only for module reports) | ✔ |
| Exchange-rate save | ✔ | ✔ | ✔ |
| Fee/salary posting | ✔ | — | ✔ |

## 4. Public API / DTO changes
- Additive `active_reversal_entry_id?: string | null` on `journalEntryRecordSchema`; projected by the
  entries list and the single-entry loader. No migration: `reversed_ref`, `source_type` and `source_id`
  already exist.
- New i18n keys in en/ar/ur/fa: `accounting.dashboard.loadFailed`, `accounting.dashboard.loadFailedHint`,
  `accounting.coa.headerAccount`, `accounting.coa.headerHint`.
- No route shapes changed; responses remain validated by the same `sendValidated` contract.

## 5. Verification

```bash
pnpm typecheck && pnpm --filter @mms/shared build
pnpm --filter @mms/shared test
pnpm --filter mms-backend test
pnpm --filter mms-frontend test
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting
pnpm run check:code-norms && pnpm run check:db-projections && pnpm run check:backend-boundaries \
  && pnpm run check:docs && pnpm run check:i18n && pnpm run check:migration-hygiene \
  && pnpm run check:migration-indexes && pnpm run check:tdd-pairing
DATABASE_URL=… bash scripts/ci/local-ci.sh --with-db
```

New/updated tests: `accountOptions.test.ts`, `JournalEntryLineRow.memo.test.tsx` (the row memo
contract: unchanged rows compare equal, a changed callback identity does not, and the editor keeps
line/callback references stable), `accountingQueryInvalidationMatrix.test.ts`,
`AccountingDashboardStates.test.tsx`, `AccountingDashboardCharts.test.tsx`,
`ChartOfAccountsListDesktopTable.test.tsx` (header badge), and the real-Postgres reversal projection
test in `accountingListFiltersDb.integration.test.ts`.
