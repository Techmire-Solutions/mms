# Accounting module bug review & fixes

A full read of the backend accounting slice (`apps/backend/src/accounting/**`, the accounting routes and
repositories) and the frontend accounting feature, hunting for real defects rather than style. Each
finding below was reproduced, fixed, and covered by a regression test where one is feasible.

## Backend

| # | Severity | Bug | Fix |
|---|---|---|---|
| B1 | P2 | **FX report dropped older revaluations.** `buildFxReport` called the list screen's query, which is capped at the newest 24 runs, then filtered by period — a tenant with more than 24 lifetime revaluations reported `revaluations: []` for older periods although the ledger held them. The same cap made re-posting an old date hit the unique index and surface as a 500 instead of an idempotent replay. | `listFxRevaluationRunsBetween` / `listIas29RunsBetween` + `findFxRevaluationRunByDate` / `findIas29RunByDate`; the report asks for the window, the re-post path asks for the stored run by date. IAS 29 had the identical hole. |
| B2 | P2 | **A ref collision was swallowed as "already posted".** `persistGeneratedEntry` returned `null` for *every* `23505`, including a voucher whose `ref` collided with another entry (e.g. a client-typed receipt number reused). The caller reported success while no ledger entry existed — trial balance silently diverged from the obligations report. | `isIdempotentGeneratedEntryConflict` only swallows the source-key/pkey (or an unidentifiable) violation; an identified `…_ref_active_uidx` collision goes through `mapJournalEntryUniqueError` → 409. |
| B3 | P3 | **FX rate cache ignored the rate type.** The per-request cache key was `currency|date`, so a voucher with a HISTORICAL line and a SPOT line on one day reused the first rate for both, mis-stating the second line's functional amount (the entry still balanced). | Key includes `rate_type`. |
| B4 | P3 | **One bad currency cell failed the whole chart import.** The CSV DTO accepts up to 10 characters, the column is `varchar(3)`, and `toAccount` never validated the value, so the failure surfaced inside `upsertAccounts` with no row number and zero imports. | `toAccount` validates with `currencyCodeSchema` and returns a per-row error. |
| B5 | P3 | **Voucher-numbering preview used the UTC day.** With no `date` query the preview resolved "today" from `toISOString()`, so a UTC+5 tenant at 02:00 local previewed the previous year's number for a calendar-year rollover. | `workspaceTodayIso(tenant)`, like every other accounting date fallback. |

Verified clean: ledger balance/single-sided guards and the 0249 commit trigger, reversal idempotency,
fiscal-year/period locking order, tenant predicates in every accounting raw SQL statement, opening and
closing balance sign handling, aging bucket boundaries, 2-dp/safe-cents money DTO boundary, and the
`@mms/shared` Money/convert/allocate helpers.

## Frontend

| # | Severity | Bug | Fix |
|---|---|---|---|
| F1 | P1 | **A save rewrote the whole register page.** The list ships header-only rows, but the write path sent the entire page through `PUT /entries`; the backend replaces the children of every non-posted row in the batch, so saving one voucher emptied the other drafts' lines on the page. Posting a draft sent an empty voucher (always rejected), and Edit opened a blank form. | Writes send only entries whose object identity changed; post fetches the stored entry's lines first and edit opens with the fetched detail. |
| F2 | P1 | **Every amount derived from register rows read 0.00** (row debit/credit, footer, CSV, dashboard recents, reverse dialog, print action, cashbook) because they summed `lines`, which the header-only projection never shipped. | Row totals prefer the server header totals; the register asks for full vouchers again (preserving the header-only opt-in for a future per-view migration) so Cashbook/print/the wizard recover their line data. |
| F3 | P1 | **Comma amounts were rescaled 100×.** The voucher parser deleted commas, so `1234,56` (the natural form on a comma-decimal workspace) posted as `123456` with no row error. The natural-language amount extractor had the same flaw. | `parseJournalLineAmount`/`journalLineAmountErrorKey` are separator-aware via the shared money-input parser (ambiguous input is refused, not rescaled); the NL extractor only strips valid thousands groups. |
| F4 | P2 | **Balance Sheet claimed "balanced" within one whole currency unit.** `< 1` tolerance hid discrepancies up to 0.99. | Exact integer-cents comparison in `FinancialStatementPanels`, matching the dashboard. |
| F5 | P2 | **Opening balances: "Post" enabled for 0 = 0**, which the server drops then rejects as unbalanced; and the list showed the previously selected year's rows while the new year loaded (`placeholderData`). | `postable` requires positive balanced non-zero rows; the list renders only rows belonging to the loaded year. |
| F6 | P3 | **Settings toggles promised unimplemented behaviour.** `requireNarration` was ignored by the voucher form; `allowEditPosted` and `autoPostDrafts` had no consumer anywhere (posted vouchers are immutable by design). | The form honours `requireNarration`; the two phantom toggles are removed from Setup → Rules (schema fields kept for backward-compatible saves). |

## Known limitations left deliberately
1. **Simple wizard balance hint** still sums the current register page. With full vouchers restored it is
   correct for the loaded page, but not ledger-wide; a server-side account-balance read is the right fix
   and needs its own design (per-account ledger query/caching).
2. **Hedge settlement/reclassification require `accounting.write`, while FX/IAS 29 postings require
   `accounting.manage`.** Both write posted ledger entries, so the split is a policy decision, not a
   mechanical bug; changing it silently would revoke an existing accountant workflow. Recorded here for
   product sign-off.

## Verification
```bash
pnpm typecheck
pnpm --filter mms-backend test        # 556 files / 3958 tests
pnpm --filter mms-frontend test       # 1224 files / 4594 tests
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting finance   # 119 files / 737 tests
pnpm run check:code-norms && pnpm run check:docs && pnpm run check:i18n && pnpm run test:scripts
```
New regression tests: `journalEntryFx` (mixed rate types), `fxReportWindow`, `accountingVoucherPeriod`,
`generatedEntryUniqueConflicts`, `accountingImportRunner` (bad currency row), `journalEntryLineTotals`
(projected rows), `journalEntryFormValidation` (comma parsing, narration), `FinancialStatementPanels`
(exact tolerance), `journalEntriesControllerActions` (post fetches lines), and the row-memo contract from
the earlier frontend audit.
