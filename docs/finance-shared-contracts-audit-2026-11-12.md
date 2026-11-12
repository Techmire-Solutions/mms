# Finance shared contracts & TypeScript definitions — audit and hardening

Scope: every Finance/Accounting DTO in `packages/shared` (invoice/payment payloads, journal voucher lines, exchange-rate objects, report models), its Zod schemas, its consumers in `apps/backend` and `apps/frontend`, and the database enums behind them.

Method: inventoried the shared finance modules, traced each DTO to its frontend/backend consumers, compared the shared enums against the PostgreSQL check constraints (read live from the dev database), scanned the money paths for `parseFloat`/`Number()`/`any`, and inspected the packaging/version resolution.

Status: **Fixed** items ship with this change; **Verified** items were checked with no change; **Documented** items are deliberate policies or follow-ups.

---

## 1. Verified baseline

| Guarantee | Evidence |
|---|---|
| **Zod is the SSOT; TypeBox is not used** | The repo has no TypeBox dependency. Shared finance modules are pure Zod + inferred types exported through the `@mms/shared` barrel; backend contracts (`finance.contract*`, `accounting.contract`) and frontend hooks import them. |
| **Core DTOs already centralized** | `Invoice`, `Payment`, `InvoiceLine`, `JournalEntry`/`JournalLine`, `FiscalYear`, `ExchangeRateRecord`/`ExchangeRateLookupResult`, `AccountingReportAggregates`, FX report rows and the new ledger/aging schemas live only in `packages/shared`. `finance.dto.ts` composes the insert schemas instead of re-declaring them. |
| **Stored statuses match shared sets** | `accounting_entries.status` = `draft|posted`; `finance_invoices.status` = `paid|pending|overdue|partial|cancelled`; `accounting_posting_periods.status` = `open|closed`; `accounting_fiscal_years.status` = `active|closed|upcoming`. Migration 0252 and the new parity test pin this. |
| **Money columns are exact in Number** | Money columns that travel as numbers are `numeric(12,2)` (invoices/payments) / `numeric(14,2)` (journal lines): ≤ 10¹⁴ cents, well inside 2⁵³. The 4-dp transaction amounts and 10-dp rates are decimal strings. A DB test now asserts this bound so a future widening fails. |
| **No version drift** | `zod` resolves to a single 4.6.7 (catalog) and TypeScript to a single `~7.0.2` across all four workspaces; both apps link `@mms/shared` as `workspace:*`. A new ratchet enforces all three. |

## 2. Findings

### P1 — duplicated type declarations

**F1 — the trial-balance row was declared three times and bridged with casts.** Shared `AccountingTrialBalanceRow`, `financialReportsExportHelpers.TrialBalanceRow` and `TrialBalanceTypeGroup`'s local interface described the same server row; `useFinancialReportsModel` cast server aggregates with `as TrialBalanceRow[]`. The shared schema also typed `type` as `z.string()` and omitted `subtype` the server returns, so the casts hid real drift. *Fixed:* shared schema now uses `z.enum(ACCOUNTING_ACCOUNT_TYPES)` + optional `subtype`; the frontend export type is an alias of the shared row; the type-group component consumes the shared type; the casts are gone.

**F2 — normal balance (debit/credit) was not in shared.** `accountingData.ACCOUNT_TYPE_META` hard-coded the sides and `accountingRepositoryReport` re-derived them with `type === "Asset" || type === "Expense"`. *Fixed:* `ACCOUNT_TYPE_NORMAL_BALANCE`, `normalBalanceForAccountType`, `isDebitNormalAccountType` in shared; both consumers use it; a test asserts the map covers every account type.

**F3 — account/journal/fiscal-year enums were re-declared inline.** `accountRecordSchema`/insert inlined the account-type list although `ACCOUNTING_ACCOUNT_TYPES` existed; `["posted","draft"]` appeared three times; `["active","closed","upcoming"]` twice; `accounting_accounts.type` and `accounting_fiscal_years.status` had **no DB check constraint** at all. *Fixed:* one `accountingEnums.ts` module supplies every enum (`ACCOUNTING_ACCOUNT_TYPES`, `JOURNAL_ENTRY_STATUSES`, `FISCAL_YEAR_STATUSES`, `POSTING_PERIOD_STATUSES`, `EXCHANGE_RATE_SOURCES`, `FINANCE_PAYMENT_METHODS`, `JOURNAL_TAGS`); all Zod schemas import it. Migration **0252** adds `accounting_accounts_type_chk` and `accounting_fiscal_years_status_chk` and validates the pre-existing `accounting_entries_status_chk`; a DB parity test compares each constraint's value set with the shared enum.

**F4 — payment methods drifted in four directions.** Stored rows use `"Cash"`; `DEFAULT_FINANCE_SETTINGS.paymentMethods` was `["cash","bank_transfer"]`; `FinancePreferencesSection` re-declared `ALL_PAYMENT_METHODS` (snake_case); `FEE_ENTRY_PAYMENT_METHODS` is a different lowercase set; `paymentRecordSchema.method` was an unconstrained string; the frontend label map was missing `Card`. *Fixed:* `FINANCE_PAYMENT_METHODS` (`Cash, Bank Transfer, Online, Cheque, Card, Other`), `normalizePaymentMethod`/`coerceFinancePaymentMethod`, typed `FinanceSettings.paymentMethods` with legacy normalization on read, an enum on the payment schema (lenient read → `Other`, strict write), and `FEE_ENTRY_TO_FINANCE_PAYMENT_METHOD` for fee entries.

**F5 — journal tags and the "reversed" rule lived only in the frontend.** The backend writes `"Payroll"`, `"Reversal"`, `"Prior Period"`; `JOURNAL_TAGS` was a frontend array that omitted `"Prior Period"`, so the tag filter could not match a server tag. Reversal detection was implemented twice in the frontend (`hasReversalEntry`, an inline `reversed_ref` check) and once in the backend with a wider rule (`source_type='reversal' AND source_id=id`). *Fixed:* shared `JOURNAL_TAGS` (superset) and `isJournalEntryReversed` matching the backend lookup; backend tag literals use `JOURNAL_TAG_*` constants; both frontend sites delegate to the shared rule.

**F9 — exchange-rate `source` was unconstrained.** `EXCHANGE_RATE_SOURCES` existed but the record schema typed `source: z.string()`, the enum omitted the synthetic `"identity"` same-currency lookup and the IAS 21 `"estimate"` source, and the DB adapter widened the row's varchar with no narrowing. *Fixed:* enum sources `manual|feed|estimate|identity`, `coerceExchangeRateSource` narrows stored rows, the stored record schema is enum-typed; the lookup *result* keeps a provenance label (`feed:<provider>`, `manual:inverse`) because it is display text, not a stored enum.

### P1 — monetary enforcement gaps

**F6 — most money fields were unrefined `z.number()`.** Invoice `baseFee/discountAmt/finalAmt/paidAmt/lateFeeAmt/creditedAmt`, invoice-line/payment amounts, opening/closing balances and every report aggregate accepted 3-dp values, `NaN`-adjacent input, and beyond-2⁵³-cent numbers. Report totals were also summed as floats (`0.10 + 0.20 = 0.30000000000000004`), which is why those schemas could not be tightened. *Fixed:* shared `moneyAmountSchema`/`signedMoneyAmountSchema` now check 2 dp **and** `Number.isSafeInteger(cents)`; `positiveMoneyAmountSchema` added; all invoice/payment/line/report/opening-balance fields use them. `accountingRepositoryReport` accumulates every total in integer cents and converts once at the boundary, so the strict schemas validate. A DB test seeds `0.10 + 0.20` and asserts exactly `0.3`.

**F7 — words formatting used a float.** `formatAmountInWords` did `parseFloat` + `Math.round(×100)`, losing cents beyond 2⁵³ and drifting on 4-dp transaction amounts. *Fixed:* exact decimal-string → cents → words via BigInt (half-up at 4 dp), with tests for large values, negatives and `1.0050`.

**F8 — no backstop against new coercions.** Backend adapters and form draft handlers used `Number()`/`parseFloat` on money and rates (the payment edit guard compared exchange rates with `Number()`, which cannot distinguish `1.0000000001`). *Fixed:* new shared `parseMoneyAmountNumber` (strict 2 dp), `tryParseMoneyAmountNumber` (UI), `roundMoneyAmount` (FX-converted amounts) and `exchangeRateStringsEqual` (exact decimal compare); every call site migrated; new `check:money-safety` ratchet fails on any future `parseFloat`, unchecked money `Number()` or `any` cast in finance/accounting paths (DB adapters allowlisted, proven exact by the precision test).

### P3 — packaging

**F10 — `@mms/shared` is consumed from `dist`.** Turbo rebuilds it for package scripts (`^build`), but a direct `tsc`/`vitest` run in an app can read a stale build. No version duplication exists (verified above). *Fixed/documented:* `check:contracts` keeps the single-version/workspace-link invariants; the build-order requirement is documented for direct commands.

## 3. Deliberate policies

- **Money representation:** ledger/invoice/payment wire values stay **bounded 2-dp numbers** (DB scale 2, exact cents inside 2⁵³); 4-dp transaction amounts and 10-dp rates are decimal strings. Moving the ledger to strings is a breaking API change and is out of scope; the safe-cents schema + DB precision test are the guardrails until then.
- **Voucher lifecycle:** stored status is `draft|posted`. "Reversed" is a derived lifecycle value (`isJournalEntryReversed`), never stored; "voided" is not modelled — invoice `cancelled` is the void analogue. No DB status values were added.
- **Payment-method storage:** legacy lowercase/snake values normalize at the boundary; a DB check constraint on `finance_payments.method` is intentionally deferred until a read-only audit of production values is clean (dev data shows only `Cash`).

## 4. Landed changes

| Area | Change |
|---|---|
| `packages/shared/src/finance/accountingEnums.ts` (new) | account types, normal balances, journal lifecycle/status, fiscal-year/posting-period states, rate sources, payment methods + normalization, journal tags, reversal rule, `accountTypeFromDb` |
| `packages/shared/src/finance/accountingLedgerInvariants.ts` | safe-cents bounds, `positiveMoneyAmountSchema`, `parseMoneyAmountNumber`/`tryParseMoneyAmountNumber`/`roundMoneyAmount` |
| `packages/shared/src/money/fxConvert.ts` | `exchangeRateStringsEqual` (exact decimal compare) |
| `packages/shared/src/finance/moneyFormatUtils.ts` | BigInt-based `formatAmountInWords` |
| `packages/shared/src/finance/financeCollect.ts` | BigInt late-fee math |
| shared schemas | account/journal/fiscal-year/period/rate-source/payment-method enums wired; invoice/payment/line/report/opening balance money schemas tightened; trial-balance row enum + `subtype` |
| `packages/shared/src/finance/accountingSpecializedEntries.ts`, `financeSetupConfigTypes.ts`, `financeModuleSettings.ts` | fee-entry → canonical method map; payment-method normalization; typed settings |
| `apps/backend` report repository | account type narrowed via `accountTypeFromDb`; normal balance from shared; all aggregates summed in integer cents |
| `apps/backend` FX/payment/collect/specialized-entry code | source coercion, exact rate comparison, percent parsing, exact amount parsing |
| `apps/backend/src/db/migrations_drizzle/0252_finance_enum_checks.sql` | account-type + fiscal-year-status checks, journal-status validation |
| `apps/frontend` report/receipt/payment code | shared trial-balance row (no duplicate/casts), shared normal balance, shared tags + reversal rule, shared payment methods/labels, exact money parsing |
| `scripts/check-money-safety.mjs`, `scripts/check-finance-contract-parity.mjs` + package/CI wiring | backstop ratchets |

## 5. Evidence

- `packages/shared/src/finance/accountingEnums.test.ts` (8): normal-balance coverage, `accountTypeFromDb` refusal, reversal rule, payment normalization/coercion, rate sources, backend tag inclusion.
- `accountingLedgerInvariants.test.ts` (+4): strict parse, null-returning UI parse, half-up rounding, safe-cents rejection.
- `moneyFormatUtils.test.ts` (+2): 4-dp half-up, cents preserved beyond float precision.
- `fxConvert.test.ts` (+2): exact rate equality including tenth-decimal changes.
- `financeEnumParityDb` (2): every check constraint equals its shared enum; every 2-dp money column stays exact in cents.
- `accountingReportPrecisionDb` (1): `0.10 + 0.20` reports exactly `0.3` and passes `accountingReportAggregatesSchema`.
- Suites: shared 286 files / 2318 tests, frontend finance+accounting 82 / 420, backend unit 531+ files (see gate run), DB finance/accounting batch green, all ratchets green including the two new ones.

## 6. Rollout notes

1. **Migration 0252** lists offending rows and aborts before adding the checks; fix those values (account types, fiscal-year statuses, journal statuses) and re-run. Dev data was already clean.
2. **Payment-method inputs** now normalize legacy spellings; an unknown value fails a write (400) and reads back as `Other` instead of breaking a response.
3. **Stricter money schemas** reject 3-dp or out-of-safe-range values that previously slipped through; all DB money columns already satisfy them, so existing data and reports are unaffected.
4. **Report totals** are now exact cents; any consumer comparing against a previously float-drifted total may see a 1-cent difference (the correct one).

## 7. Out of scope

- Moving ledger/invoice/payment money to decimal strings (breaking; documented migration path).
- A DB check on `finance_payments.method` (pending a production value audit).
- Introducing `reversed`/`voided` stored journal statuses (reversal remains a linked entry).
- TypeBox adoption.
