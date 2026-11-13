# Accounting — specialized standards subsystems audit (FX, IFRS 9 hedges, IAS 29)

Scope: the standards-bearing subsystems of the Accounting module — multi-currency / IAS 21
(`accountingFxDb`, `accountingAccountsFxPersist`, `accountingFxExchangeabilityDb`,
`accountingFxRevaluationDb` and the code they exercise), IFRS 9 hedge accounting
(`accountingHedgesDb`, `accountingHedgeRoutes`) and IAS 29 hyperinflation restatement
(`accountingIas29Db`, `accountingIas29Routes`).

Method: every claim was read from the working tree and measured against PostgreSQL 16 (fresh
`db:migrate`, real `test:db` runs). "Verified" means the control is traced to a write path **and** a
test. Findings marked *Fixed* landed with migration
`0255_hedge_discontinuation_and_currency_lock.sql` plus the files in §4.

---

## 1. What is already correct (verified, no change)

### Multi-currency / IAS 21

| Claim | Evidence |
|---|---|
| **Spot and closing rate lookups** | `lookupExchangeRate` (`accountingExchangeRatesRepository.ts`): identity → latest tenant rate **on or before** the date → inverse of a tenant rate → reference feed triangulated via its base currency; the feed only answers SPOT/CLOSING; null when nothing applies, never 1. `rate_date` is a real `date` (0248) and `rate > 0` is enforced in both rate tables. |
| **Lack of exchangeability (IAS 21.19A/57A, 2025 amendment)** | `isNonExchangeableOn` marks a rate for a non-exchangeable currency as `estimate` and **blocks the feed fallback** (`lookupExchangeRate` returns null rather than an observable rate); `exchangeRateUseCases.ts` refuses an estimated rate without an `overrideReason` that explains the estimation. Proved by `accountingFxExchangeabilityDb` (before/after the assessment date, feed suppression, estimate round-trip). |
| **Account-level currency restriction — manual path** | `resolveJournalFxLines` rejects a line whose `txn_currency` differs from `accounting_accounts.account_currency` (`accountingFxLines.ts`, fed from `resolveEntriesFx`); tests in `journalEntryFx.test.ts` and `accountingAccountsFxPersist.test.ts`. |
| **Period-end unrealized FX calculation** | `computeFxRevaluation`: `openTxn × closingRate − carryingFunc`, all in BigInt minor units, zero differences dropped. The journal debits/credits each account's exact rounded amount and plugs the **net** to the unrealized-FX account, so the entry balances exactly and the functional totals are consistent. `carryingFunc` sums `func_debit/func_credit`, so a later revaluation starts from the revalued carrying amount. |
| **Revaluation idempotency & atomicity** | Advisory lock `fx_reval:<date>`, `findRunId`, the `(workspace, revaluation_date)` unique index and the entry source keys; the route wraps the whole operation in one transaction, so entry + next-day reversal + run + audit commit or roll back together. Two-connection proof in `accountingFxRevaluationDb`. |
| **Missing rates and scale problems are 422** | `MissingClosingRatesError` and `AmountScaleError` are mapped to validation errors in the preview/post paths (`accountingFxRevaluationDb` "turns a legacy balance with more decimals … into a 422"). |

### IFRS 9 hedges

| Claim | Evidence |
|---|---|
| **Designation guards** | Role→type validation for instrument (Asset/Liability), reserve (Equity) and P&L (Revenue/Expense) accounts, archived/deactivated rejection, hedged currency ≠ functional currency, maturity after designation, reserve required for a cash-flow hedge, notional representable in the hedged currency (`hedgeAccountRoles.ts`, `accountingHedgeSchemas.ts`). |
| **Effectiveness split** | Cash-flow: effective = lower of |instrument| and |hypothetical| only when the movements offset (IFRS 9.6.5.11), capped into the OCI reserve, remainder to P&L; fair-value: everything to P&L. Hypothetical derivative priced at the designation-date market forward rate (B6.5.5). Over-hedge and offsetting cases proved in `accountingHedges.test.ts` and `accountingHedgesDb`. |
| **State machine basics** | Valuation requires `active`; settlement requires `active` **and** a date after the last valuation record; one valuation per hedge/date enforced by a unique index and an advisory lock; the settled reserve is reclassified once (status `settled` → `reclassified`). |

### IAS 29 hyperinflation

| Claim | Evidence |
|---|---|
| **Monetary vs non-monetary classification** | `isRestatedByIas29`: non-monetary assets/liabilities, equity and P&L are restated; monetary items are not. `is_monetary` is inferred on create from the account type/subtype/name (cash/bank/petty/receivable/loan/deposit/wallet; liabilities except unearned/deferred/advances) and stays editable; the default chart classifies Cash/Bank/Receivables as monetary and Inventory/Fixed assets as not. |
| **Restatement math** | `Σ movement × closing index ÷ month index` per account and month at six index decimals with BigInt arithmetic (`divideRounded`), zero adjustments dropped, the net plug posted to the net-monetary-position account, so the entry balances by construction. `accountingIas29Db` proves the 400 cash / 50% inflation / 200 loss case. |
| **Idempotency and no compounding** | `lockLedgerEvent('ias29:<date>')`, `findIas29RunId`, the `(workspace, restatement_date)` unique index and entry source keys; earlier `ias29_restate`/`ias29_reversal` entries are excluded from the movements (`accountingHyperinflationRepository.ts`), and each restatement is reversed the next day, so the next period restates from historical amounts. Proved by `accountingIas29Db` (posted run + reversal + next-period restatement, concurrent submits). |
| **Missing indices are 422** | `MissingPriceIndexError` names the months without an index on or before their end; the run is not written. |

---

## 2. Findings

**S1 (P0) · The account-currency lock was bypassed by every generated posting.** *Fixed.*
`financeFxPosting.buildFxInvoicePostingLines`/`buildFxPaymentPostingLines` call `resolveJournalFxLines`
**without `accountCurrencies`** (`financeFxPosting.ts:43,197`), and `persistGeneratedEntry` never re-checked
it. A USD invoice or payment therefore posted a USD line to an AR/cash account configured
`account_currency = 'PKR'`, and the period-end revaluation then retranslated a balance the account says it
cannot hold.
*Fix:* `lockPostableAccounts` now returns `account_currency`, and `assertJournalAccountsWritable`
(`accountingAccountPostability.ts:88-95`) validates every line's `txn_currency` against it — that guard is
on the manual **and** generated paths. Lines without a transaction currency are skipped there (the
resolver treats them as functional). Proved by `accountingFxDb` (generated USD line on a PKR-locked
account → 422; PKR line accepted) and `accountingLedgerGuards.test.ts`.

**S2 (P1) · Hedge settlement and reserve reclassification accepted any account.** *Fixed.*
`settleHedge` only checked `accountExists` for the cash account and `reclassifyHedgeReserve` only for the
target (`hedgeSettlementUseCases.ts`), while designation enforced role→type. A settlement could debit a
Revenue account and a reserve could be reclassified into an Asset — both statements misstated with no
error.
*Fix:* one shared validator (`hedgeAccountRoles.ts`, `HEDGE_ACCOUNT_ROLES` incl. `cashAccountId` ⇒ Asset
and `reclassificationAccountId` ⇒ Revenue/Expense) used by designation, settlement and reclassification.
Proved in `accountingHedgesDb` ("refuses settlement and reclassification accounts with the wrong role").

**S3 (P1) · `discontinued` was a state that could never be entered.** *Fixed.*
`HEDGE_STATUSES` and the status column modelled it, but no action set it: an active hedge could only be
settled, so a relationship that stopped qualifying (IFRS 9.6.5.6) kept being valued forever.
*Fix:* `POST /api/accounting/hedges/:id/discontinue` (shared request schema, contract entry, route, hook,
panel button + i18n in en/ar/ur/fa). The write is allowed only from `active`, refuses when a valuation,
settlement or reclassification record exists on/after the date, posts the cumulative fair value at the
closing rate **without** the automatic next-day reversal (effective → OCI reserve, remainder → P&L),
records a `discontinuation` valuation row (`reversalEntryId: null`), sets `status = 'discontinued'` and
`settledReserve = effective`, and audits with the reason. `reclassifyHedgeReserve` now accepts `settled`
**or** `discontinued`. Migration 0255 extends the `kind` CHECK; the shared `kind` union and the HTTP
response enum include it. Proved by `accountingHedgesDb` (posts without a reversal, reserve
reclassifiable, second discontinuation and later valuation refused, early date refused) and
`accountingHedgeRoutes.test.ts`.
*Documented:* the module has no per-relationship instrument subledger, so the derivative balance left by a
discontinued hedge is derecognized with a manual journal; settlement itself stays `active`-only.

**S4 (P2) · Hedge fair value was double-rounded.** *Fixed.*
`computeHedgeValuation` converted the notional at two rates and subtracted the two rounded functional
amounts, so the fair value — and the ineffective split built from it — could differ from
`notional × (rate − contractRate)` by up to one functional minor unit.
*Fix:* `rateDifference` (`money/fxConvert.ts:58`) returns the signed difference of two rates exactly at
the ten-decimal rate scale, and the hedge value converts that difference **once** per term
(`accountingHedges.ts:52-61`). Regression test: 100.05 USD at 283.5 vs 282.25 is 125.06 PKR with one
rounding step, while the two-conversion form produced 125.07.

**S5 (P1) · The year-end close ignored hedges and IAS 29.** *Fixed.*
`closeFiscalYearForTenant` refused without a period-end **FX revaluation**, but accepted a year with no
hedge fair value/OCI reserve and no IAS 29 restatement — both auto-reversed the next day, so the year
closed with those amounts absent.
*Fix:* under the same fiscal-year lock the close now requires (a) a `valuation` record dated `year.endDate`
for every hedge whose designation/maturity range contains it, and (b) an IAS 29 run on `year.endDate` when
hyperinflation is enabled and `appliesFrom` has been reached (`accountingPeriodClose.ts:49,73`), each
failing with a 422 that names what is missing. Proved by six new cases in `accountingPeriodClose.test.ts`.

**S6 (P2) · Functional-currency immutability was application-only.** *Fixed.*
`exchangeRateUseCases` refuses the change when locked, but `saveCurrencySettings` writes whatever it is
given, so a restore, script or future route could re-denominate the ledger retroactively.
*Fix (0255):* `BEFORE UPDATE OF functional_currency` trigger refusing the change when `locked_at IS NOT
NULL` or any posted entry exists, with the purge/maintenance escape. Proved by `accountingFxDb` (raw SQL
rejected with `23514`; maintenance flag allowed and reverted).

**S7 (P2) · No database coverage for fair-value hedges.** *Fixed.*
Every hedge DB test was a cash-flow hedge; the fair-value branch (no reserve line, whole change to P&L)
had zero end-to-end coverage. *Fix:* a fair-value designation + valuation case in `accountingHedgesDb`
asserting the lines are exactly instrument + P&L and that the next-day reversal exists.

### Documented decisions (no code change)
The auto-reversal model (valuations and restatements exist on their own date and are reversed the next
day) is retained; S5 makes the year-end instance mandatory. Effectiveness testing is documentation-based
(`hedgedItem`, `riskManagementObjective`) with no dollar-offset ratio or retrospective re-test, which IFRS 9
does not require. `designationRate` cannot be verified as the market forward for the maturity offline.
IAS 29 restates per-month movements at that month's index and rounds per month; the residual allocation
lands on the net-monetary-position account by construction. Price-index points may be corrected after a
run — posted runs keep their own stored lines, so history is immutable while future recomputation uses
the corrected series. The next-day reversal date can fall outside the fiscal calendar, in which case the
whole posting fails atomically (single route transaction) rather than half-posting.

---

## 3. Files changed

| File | Change |
|---|---|
| `apps/backend/src/db/migrations_drizzle/0255_hedge_discontinuation_and_currency_lock.sql` | new: hedge `kind` CHECK gains `discontinuation`; functional-currency immutability trigger |
| `…/meta/0255_…_snapshot.json`, `meta/_journal.json` | snapshot derived from 0254 + journal entry |
| `packages/shared/src/money/fxConvert.ts` | `rateDifference` |
| `packages/shared/src/finance/accountingHedges.ts` | single-rounding fair value via the rate difference |
| `packages/shared/src/finance/accountingHedgeSchemas.ts` | `hedgeDiscontinuationRequestSchema`; valuation `kind` gains `discontinuation` |
| `packages/shared/src/finance/accountingHttpResponses.ts` | response kind enum |
| `packages/shared/src/contracts/accountingHedges.contract.ts` | `discontinueHedge` contract entry |
| `packages/shared/src/i18n/appTranslations{En,Ar,Ur,Fa}.ts` | discontinue/reason keys |
| `apps/backend/src/db/repositories/accountingAccountsRepository.ts` | `accountCurrency` in the locking postable lookup |
| `apps/backend/src/accounting/use-cases/accountingAccountPostability.ts` | per-line currency check |
| `apps/backend/src/accounting/use-cases/hedgeErrors.ts`, `hedgeAccountRoles.ts` | new: shared 422 shapes and role validation |
| `apps/backend/src/accounting/use-cases/hedgeUseCases.ts` | uses the split role/error modules (under the 300-line ceiling) |
| `apps/backend/src/accounting/use-cases/hedgeSettlementUseCases.ts` | role checks; `discontinueHedge`; reclassification from `discontinued` |
| `apps/backend/src/accounting/use-cases/accountingPeriodClose.ts` | hedge + IAS 29 close preconditions |
| `apps/backend/src/routes/tenant/accounting/accountingHedgeRoutes.ts` | `POST /hedges/:id/discontinue` |
| `apps/backend/src/db/schema/accountingHedges.ts` | declared kind CHECK updated |
| `apps/frontend/src/tenant/features/accounting/{hooks/useHedges.ts,hooks/useHedgesPanel.ts,lib/hedgeForms.ts,components/HedgeActionModal.tsx,components/AccountingHedgesSection.tsx}` | Discontinue action (date + reason), reclassify shown for discontinued cash-flow hedges |

## 4. Tests

| Suite | Added/changed |
|---|---|
| `accountingHedges.test.ts` (shared) | single-rounding regression (125.06 vs the old 125.07), existing split/sign/cap cases kept |
| `fxConvert.test.ts` (shared) | `rateDifference` sign, zero, ten-decimal exactness |
| `accountingHedgeSchemas.test.ts`, `accountingHttpResponses.test.ts` (shared) | discontinuation request accept/reject; kind enum |
| `accountingLedgerGuards.test.ts` | currency lock per line: mismatch blocked, match/unlocked accepted, currency-less line skipped |
| `accountingPeriodClose.test.ts` | hedge and IAS 29 close preconditions (missing vs posted, matured hedge ignored, settled/discontinued ignored, `appliesFrom` in the future ignored) |
| `accountingHedgeRoutes.test.ts` | discontinue: 201 for an accountant, 403 without write permission, 400 without a reason |
| `AccountingHedgesSection.test.tsx` (frontend) | discontinue button offered for active hedges; view-only user sees no actions |
| `accountingHedgesDb` | fair-value valuation (no reserve line, reversal next day), discontinuation without reversal + reserve reclassifiable, early/second discontinuation and later valuation refused, settlement/reclassification role guards |
| `accountingFxDb` | generated posting to a currency-locked account refused, matching currency accepted, functional-currency change refused by raw SQL and allowed under the maintenance flag |

Measured on a fresh PostgreSQL 16: **24 accounting DB suites / 172 tests** green; backend unit
**540 files / 3867 tests** and shared unit **287 files / 2341 tests** green; repo typecheck, ESLint and
every ratchet green (`check:i18n` reports every locale complete); `ci:local --with-db` passed. The
throwaway PostgreSQL container was removed afterwards.

## 5. Reviewed exception: hand-authored migration snapshot

`drizzle-kit generate` still cannot run (malformed committed snapshot chain — see
`docs/finance-accounting-schema-persistence-audit-2026-11-12.md` §5). `0255` changes one CHECK and one
trigger, so `meta/0255_hedge_discontinuation_and_currency_lock_snapshot.json` is the `0254` snapshot with
the updated hedge-kind definition and a fresh `id`/`prevId`; the journal carries `idx: 255`. Regenerate
`0255` with the chain.

## Appendix — reproduction

```bash
docker run -d --name mms-audit-pg -e POSTGRES_PASSWORD=mms -e POSTGRES_USER=mms \
  -e POSTGRES_DB=mms -p 55433:5432 postgres:16-alpine
export DATABASE_URL="postgres://mms:mms@127.0.0.1:55433/mms"
pnpm --filter mms-backend db:migrate
pnpm --filter mms-backend test:db -- accountingHedgesDb accountingFxDb accountingIas29Db accountingFxRevaluationDb
```

```sql
-- 1. The 0255 objects exist
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname = 'accounting_hedge_valuations_kind';
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_accounting_currency_settings_functional_immutable';

-- 2. A functional-currency change after posting is refused (expect check_violation)
BEGIN;
UPDATE accounting_currency_settings SET functional_currency = 'USD'
 WHERE workspace_subdomain = '<workspace with a posted entry>';
ROLLBACK;

-- 3. A discontinuation record is accepted by the kind CHECK
SELECT count(*) FROM accounting_hedge_valuations WHERE kind = 'discontinuation';
```

Measured after the change: 0255 applied cleanly on a fresh database; the new CHECK and trigger are
present; all four FX/hedge/IAS 29 DB suites pass (including the new fair-value, discontinuation and
currency-lock cases).
