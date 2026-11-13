# Finance specialized subsystems — FX engine, automated billing, hedges and IAS 29

Scope: the multi-currency engine (spot lookup, exchangeability, realized/unrealized FX, period-end revaluation), automated student billing with multi-currency rates, and hedge accounting / IAS 29 hyperinflation, including the DB-integration suites named in the review (`financeFxDb`, `accountingFxDb`, `accountingAccountsFxPersist`, `accountingFxExchangeabilityDb`, `accountingFxRevaluationDb`, `financeGeneratedInvoiceFxDb`, `accountingHedgesDb`, `accountingIas29Db`). Line numbers are from the working tree at audit time; where a change moved them, the function name is given.

Method: read every named suite plus the shared maths (`money/`, `finance/accountingFxLines.ts`, `accountingFxRevaluation.ts`, `accountingFxExchangeability.ts`, `accountingHedges.ts`, `accountingHyperinflation.ts`, `financeDocumentFx.ts`, `financeFxPosting.ts`), the use cases (`fxRevaluationUseCases`, `hedgeUseCases`, `ias29UseCases`, `exchangeRateUseCases`, `financeDocumentFx`, `financeInvoiceGenerationUseCases`), the repositories, and the routes. Each invariant was exercised against the running PostgreSQL.

Status: **Fixed** findings landed with this change; **Documented** findings are deliberate model limitations recorded for the reviewer.

---

## 1. What holds (verified, so the report doesn't over-claim)

| Guarantee | Evidence |
|---|---|
| **Exact money arithmetic** | `Money` is BigInt minor units; `divideRounded` is half-up and symmetric for negatives (`money.ts:47-64`); `convertMoney` rejects rates with >10 decimals and never falls back to 1 (`fxConvert.ts:31-85`). |
| **Spot lookup chain fails closed** | Tenant rate → inverse → feed triangulated through the base, latest on or before the date (`accountingExchangeRatesRepository.ts:130-265`). A currency assessed non-exchangeable on/after its assessment date never falls back to the feed; a manual rate for it must carry an estimate disclosure and is stored with `source = "estimate"` (`exchangeRateUseCases.ts:76-112`; covered by `accountingFxExchangeabilityDb`: pre-assessment feed usable, post-assessment lookup returns null, estimate stored/returned). The feed worker writes only `fx_reference_rates` (platform), so it cannot inject a market rate the tenant must not use. |
| **Realized and unrealized FX are separate, and both are idempotent** | Realized FX is measured at settlement against the invoice's booked rate and posted to the FX gain/loss account (`financeFxPosting.ts`, `financeDocumentFx.ts:61-110`, `financeFxDb`). Unrealized FX is a functional-only revaluation (`txn_* = 0` on each adjusted line), reversed the next day, one run per date, published only for monetary, revaluable, non-functional accounts (`accountingFxRevaluation.ts:75-180`, `accountingFxRevaluationRepository.ts:19-59`). |
| **Hedge and IAS 29 mathematics** | Under/over-hedge, non-offsetting movements, sell forwards, fair-value hedges, losses, OCI cap and reclassification (`accountingHedges.test.ts` 8 cases); monthly-index restatement, missing-index 422, no closing index refusal, net monetary loss/gain, balanced journal (`accountingHyperinflation.test.ts` 8 cases). |
| **Billing duplicate guards** | `(workspace, enrollment_id, billing_period)` partial unique index for active invoices; period marks + `shouldSkipGeneratedInvoice`; generated invoices booked at the due-date SPOT with one lookup per currency × date (`applyGeneratedInvoiceFx`); enrollment discounts derived as `finalFee = baseFee − discountAmt` (`enrollmentFees.ts:56`). |

## 2. Findings

### P1 — wrong money, unrecoverable state, or a broken billing↔ledger link

**F1 — a hedge `notional` with more decimals than the hedged currency made the hedge permanently unvaluable (500).** *Fixed.*
`hedgeRelationshipCreateSchema.notional` used `moneyDecimalAmountSchema` (up to 4 dp) with no currency-scale refinement (`accountingHedgeSchemas.ts`), so `notional: "1000.1234"` USD was accepted and stored in `numeric(19,4)`. Every valuation then called `normalizeStoredAmount(notional, "USD")`, which threw a bare `RangeError` for the non-zero 4th decimal, and the use case did not catch it → 500 on every valuation/settlement. There is no update/delete endpoint for hedge relationships, so the row could only be repaired in SQL.
Fix: the designation schema now refines the notional against the currency scale (422 with the `notional` path), and `normalizeStoredAmount` throws a typed `AmountScaleError` that the hedge, revaluation and IAS 29 use cases map to a 422 naming the value and currency. Tests: `accountingHedgeSchemas.test.ts` (USD 4 dp rejected, JPY fraction rejected, valid scales accepted) and a DB test that a legacy 4 dp notional returns 422, not 500.

**F2 — hedge postings were not keyed idempotently: a concurrent double-submit duplicated or 500ed.** *Fixed.*
`postHedgeValuation`, `settleHedge` and `reclassifyHedgeReserve` used `hv-${randomUUID()}` as the journal `source_id`, so the `(source_type, source_id)` idempotency key could never dedupe a repeat of the same hedge/date/kind. The only backstop was the unique index on `accounting_hedge_valuations`, which fires *after* the entries are posted inside the route transaction — the loser rolled the whole request back and returned a 500.
Fix: deterministic ids (`hv-<sha256(relationship)[:12]>-<kind>-<date>`, short enough for `accounting_entries.source_id varchar(64)`), a per-event advisory lock (`lockLedgerEvent`, keyed `ledger-event:<tenant>:hedge:<id>:<kind>:<date>`) taken before the read-then-post, and a unique-violation fallback that returns the stored relationship. Test: two concurrent valuations of one hedge/date resolve to one valuation row and one `hedge_val` entry.

**F3 — editing a session's currency silently reinterpreted every enrolled fee.** *Fixed (guard).*
Enrollments carry their fee without a currency; `sessions.currency` is editable through the session PUT and `applyGeneratedInvoiceFx` reads it at generation time. Changing a session from PKR to USD turned an existing `finalFee = 5000` into USD 5,000 (~281×) for all future billing, and the GL posted AR at the new rate.
Fix: `updateSessionById` now refuses a `currency` change while the session has non-archived enrollments (`sessionHasEnrollments` on the sessions port), with a 422 telling the operator to create a session in the new currency. Tests: two unit cases (blocked with enrollments, allowed without) and a DB assertion that `sessionHasEnrollments` reflects the seeded enrollments.

### P2 — hardening (fixed)

**F4 — revaluation / IAS 29 run creation raced into a 500.** Two concurrent `postFxRevaluation`/`postIas29Restatement` calls both passed `findRunId`; the loser hit the unique `(workspace, date)` index and surfaced a 500 instead of the existing run the API documents. Fixed with the same per-event advisory lock (`ledger-event:<tenant>:fx_reval:<date>` / `ias29:<date>`) before the read. Tests: concurrent submits return the same run id and leave one run row.

**F5 — generated invoices did not report whether they reached the ledger.** `tryPostInvoiceJournals` skips silently when posting rules are unset, and `generateInvoices` returned only `{created, skipped, eligible}`. `GenerateInvoicesResult` now carries `posted`/`unposted` (per invoice `findEntryIdBySource` after posting), and the generate dialog raises a warning toast naming the unposted count instead of a plain success. Tests: unit counts, DB end-to-end (below).

**F6 — hedge accounts were existence-checked but not role-checked.** The reserve could be an Expense and the P&L account an Equity. Fixed: instrument = Asset/Liability, reserve = Equity, P&L = Revenue/Expense, aggregated into one 422. Test: wrong-role designations rejected.

**F7 — the IAS 29 net monetary position account was not type-checked.** Fixed: it must be an active Equity/Revenue/Expense account; the plug would otherwise misstate the balance sheet. Test: an Asset account as NMP is rejected.

**F8 — an account locked to a foreign currency was not necessarily monetary.** `inferIsMonetaryAccount` is a name/subtype heuristic, so an account created with `accountCurrency: "USD"` and a name outside the cash/bank/receivable pattern was classified non-monetary and silently excluded from period-end revaluation. Fixed: an explicit `accountCurrency` now implies `isMonetary` unless the caller explicitly sets `false`. Test: both directions.

### P3 — documented model limitations (no code change)

- **F9 — no correction path once a revaluation/restatement/valuation date is posted.** Repeat calls return the existing run by design, and the entries are non-reversible by the journal reversal route (`fx_reval`, `ias29_*`, `hedge_*` are workflow-owned sources), so a wrong closing rate or price index locks that date. Recommend an audited "void run" action (voided_at/voided_by + partial unique index + correcting entry).
- **F10 — no hedge update or discontinuation action.** `discontinued` is modelled as a status with no transition, so a mis-designated relationship can be settled but not ended; only new relationships are possible.
- **F11 — the hypothetical derivative is priced with spot rates**, whereas IFRS 9.B6.5.5 refers to forward rates; designation documents the objective/hedged item as free text with no structured effectiveness method. A deliberate simplification that should be stated in the UI help.
- **F12 — valuation entries are period-end snapshots reversed the next day**, so OCI exists only on valuation dates and the reserve is re-established at settlement; interim balance sheets between valuations show no hedge accounting.
- **F13 — IAS 29 classifies accounts by today's `is_monetary`**, not the flag in force when each movement arose (`accountingHyperinflationRepository.ts`).
- **F14 — bounded rounding sites.** Inverted/cross rates are rounded to 10 dp (≤5e-11 relative; sub-cent below ~1e10 units); the hedge fair value is two independently rounded conversions (≤1 minor unit vs `notional × Δrate`); IAS 29 rounds per month (≤0.5 minor unit). Each site is additive or plugged, so every journal still balances to the cent.

## 3. Duplicate/correction matrix

| Event | Idempotency key | Repeat (sequential) | Repeat (concurrent) | Correction after posting |
|---|---|---|---|---|
| FX revaluation | entry `source_id = date`; run unique `(workspace, date)` + event lock | returns the run | waits, returns the run (F4) | none — next-day reversal only (F9) |
| IAS 29 restatement | entry `source_id = date`; run unique `(workspace, date)` + event lock | returns the run | waits, returns the run (F4) | none (F9) |
| Hedge valuation/settlement/reclass | deterministic `hv-<hash>-<kind>-<date>` + event lock + valuation unique `(relationship, date, kind)` | returns the relationship | one row, one entry (F2) | none (F9); discontinuation absent (F10) |
| Generated invoice | `(enrollment, billing_period)` active unique + period marks | skipped, `created: 0` | unique index rejects the loser, batch rolls back | archive + regenerate next period |

## 4. Billing → ledger link

- Generated invoices now prove the link end to end in `financeGeneratedInvoiceFxDb`: a USD session at SPOT 281 produces an invoice with `currency = USD`, booked rate 281, and a balanced posted entry (Dr AR 14,050 PKR at `txn 50.00 USD` / Cr Income 14,050), dated the due date; the PKR session posts in the functional currency with no FX fields.
- The link is reported (`posted`/`unposted`) instead of assumed; when posting rules are absent the invoice still exists and `audit:ledger-balance` lists it (634 such documents in the dev database, mostly fixture workspaces).
- A second generation for the same period creates nothing, and a direct duplicate active invoice for the same enrollment/period is rejected by the unique index.
- **Remaining gap (unchanged, documented):** documents created before posting rules existed are never backfilled; the audit script is the reporting surface, and a reconciliation/backfill action remains a recommended follow-up.

## 5. Landed changes

| File | Change |
|---|---|
| `packages/shared/src/finance/accountingHedgeSchemas.ts` | notional refined against the hedged currency's scale |
| `packages/shared/src/finance/accountingFxRevaluation.ts` | typed `AmountScaleError` from `normalizeStoredAmount` |
| `packages/shared/src/finance/financeInvoiceGeneration.ts` | `posted`/`unposted` on `GenerateInvoicesResult` |
| `apps/backend/src/accounting/use-cases/hedgeUseCases.ts` (+ new `hedgeSettlementUseCases.ts`) | deterministic ids, event lock, account-role validation, 422 on scale errors; settlement/reclass split out for the length ceiling |
| `apps/backend/src/accounting/ledgerPosting/ledgerEventLock.ts` | new per-event advisory lock |
| `apps/backend/src/accounting/use-cases/fxRevaluationUseCases.ts`, `ias29UseCases.ts` | event lock before the run check, 422 on scale errors, NMP account type validation |
| `apps/backend/src/accounting/repository/accounting{Hedges,Hyperinflation}RepositoryAdapter.ts` | expose `findAccountsByIds` |
| `apps/backend/src/db/repositories/accountingAccountsFxPersist.ts` | foreign-currency account implies monetary |
| `apps/backend/src/db/repositories/sessionRepositoryQueries.ts` + sessions port/adapter | `sessionHasEnrollments` |
| `apps/backend/src/sessions/use-cases/sessionsUseCases.ts` | currency-change guard |
| `apps/backend/src/finance/use-cases/financeInvoiceGenerationUseCases.ts` | posted/unposted counts |
| `apps/frontend/src/tenant/features/finance/components/FinanceGenerateInvoicesDialog.tsx` + 4 locale files | warning toast for unposted invoices |

## 6. Evidence

Against the dev PostgreSQL with all migrations applied:

- `accountingHedgesDb` (6 tests) — existing effectiveness/settlement/reclassification cases plus: wrong-role account 422, legacy 4 dp notional 422, concurrent valuation → one row and one entry.
- `accountingFxRevaluationDb` (6) — existing preview/posting/reversal/report cases plus: concurrent submits → one run/one entry set; legacy 4 dp balance → 422.
- `accountingIas29Db` (7) — existing restatement cases plus: wrong-type NMP account 422, concurrent restatement → one run.
- `financeGeneratedInvoiceFxDb` (5) — session-currency stamping plus: end-to-end posted entry at the booked rate, second generation no-op, unique active duplicate rejection, session-has-enrollments.
- Unit/shared: `accountingAccountsFxPersist` (6), `accountingHedgeSchemas` (4), `sessionsUseCases` (21, two new guard cases), `financeInvoiceGenerationUseCases` (7, new counts).
- Whole-suite results: backend unit **527 files / 3725 tests**, shared **283 / 2286**, finance+accounting DB batch **20 files / 110 tests**, typecheck clean, all 15 ratchets green, `audit:ledger-balance` still reports zero ledger-invariant violations.

## 7. Recommendations not implemented

1. **Void-run action** for a posted revaluation/restatement (F9) and **hedge discontinuation** (F10).
2. **Unposted-document reconciliation** and a reviewed backfill for invoices created before posting rules existed.
3. **Forward-rate hypothetical derivative** and structured effectiveness documentation if the module is ever presented as full IFRS 9 compliance (F11).
4. **Explicit pricing currency on the enrollment** (instead of the session-currency guard) if cross-currency rollover or mid-session currency changes become a product requirement (F3).

## Appendix — reproduction queries

```sql
-- Hedge relationships whose notional cannot be represented in their currency
SELECT workspace_subdomain, id, currency, notional
  FROM accounting_hedge_relationships
 WHERE notional <> round(notional, 2);           -- 2 dp example; use the ISO minor units

-- One revaluation/restatement run per date (unique indexes back this)
SELECT workspace_subdomain, revaluation_date, count(*)
  FROM accounting_fx_revaluation_runs GROUP BY 1,2 HAVING count(*) > 1;
SELECT workspace_subdomain, restatement_date, count(*)
  FROM accounting_ias29_runs GROUP BY 1,2 HAVING count(*) > 1;

-- Hedge events and their journal sources (deterministic ids)
SELECT v.relationship_id, v.kind, v.valuation_date, v.id, e.id AS entry_id
  FROM accounting_hedge_valuations v
  LEFT JOIN accounting_entries e
    ON e.workspace_subdomain = v.workspace_subdomain
   AND e.source_type = 'hedge_val' AND e.source_id LIKE 'hv-%'
 ORDER BY v.created_at DESC LIMIT 20;

-- Generated invoices with no ledger posting (the now-reported gap)
SELECT i.workspace_subdomain, i.id, i.currency, i.final_amt
  FROM finance_invoices i
 WHERE i.deleted_at IS NULL AND i.status <> 'cancelled'
   AND NOT EXISTS (SELECT 1 FROM accounting_entries e
                    WHERE e.workspace_subdomain = i.workspace_subdomain
                      AND e.source_type = 'invoice' AND e.source_id = i.id);
```
