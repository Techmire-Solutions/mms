---
name: mms-finance-accounting
description: Implements or audits MMS finance and accounting workflows — invoices, payments, double-entry bookkeeping, chart of accounts, fiscal years, fee structures, and financial reports. Use when modifying finance or accounting features, payment gateways, invoice templates, or ledger entries. Do NOT use for general custom form building (use mms-form-architecture), generic data querying (use mms-query-factories), or low-level database audit hash chains (use mms-audit-trail).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Finance & Accounting Workflow

**Rules (norms SSOT):** `mms-core.md` (money and boundaries), `mms-data-layer.md` (transactions, audit, lifecycle), `mms-auth-security.md` (authorization), `mms-api-interface.md` (write contracts), `mms-reports.md` (report authority).

## When to use

- Changing invoices, payments, ledgers, or accounting posting
- Working payment gateways, invoice templates, or double-entry rules

Use for ledger posting, fee billing and collections, payroll journals, chart of accounts, periods, reconciliation, and financial statements. This is a software implementation workflow, not an assertion that MMS meets any accounting framework.

## Scope and policy first

1. Establish the entity, jurisdiction, reporting framework/version, cash or accrual basis, fiscal calendar, functional currency, and any donor restrictions from existing configuration or the task. When unknown, remain framework-neutral and ask only when the answer changes the requested behavior.
2. Inspect the actual schema and write paths before designing a change. Distinguish implemented controls, tested behavior, and proposed capabilities; a UI setting, type, or skill paragraph is not proof of enforcement.
3. Apply only the relevant references below. New recommendations are **advisory design/review guidance** unless backed by an existing rule and the specific evidence identified in the verification reference. Implementing an unsupported feature requires task scope; do not silently add a new accounting basis, fund engine, approval system, or statutory regime.

## Read by task

| Task | Reference |
|---|---|
| Amounts, journals, retries, payment integration, authorization | [Ledger controls](references/ledger-controls.md) |
| Period close, opening balances, bank matching, reports, exports | [Closing and reporting](references/closing-reporting.md) |
| Recognition, restricted funds, FX, Islamic funds, AI, 2026 applicability | [Accounting policies and sources](references/policies-2026.md) |
| Regression selection, evidence, capability gaps, related-skill ownership | [Verification and routing](references/verification.md) |

## MMS implementation map

- Shared validation and posting helpers: `packages/shared/src/finance/accountingLedgerInvariants.ts`, `packages/shared/src/finance/accountingLedgerPosting.ts`, `packages/shared/src/finance/accountingModuleManifest.ts`, `packages/shared/src/finance/accountingLedgerOps.ts`.
- Posting orchestration: `apps/backend/src/accounting/use-cases/`, `apps/backend/src/accounting/ledgerPosting/ledgerPostingService.ts`, `apps/backend/src/finance/use-cases/`.
- Persistence: `apps/backend/src/db/repositories/accountingEntriesPersist.ts`, `apps/backend/src/db/repositories/accountingEntryLocks.ts`, `apps/backend/src/db/repositories/accountingLedgerOpsRepository.ts`.
- Close/report: `apps/backend/src/accounting/use-cases/accountingPeriodClose.ts`, `apps/backend/src/db/repositories/accountingRepositoryReport.ts`, `packages/shared/src/finance/accountingReportAggregates.ts`.
- IAS 21 multi-currency: exact money in `packages/shared/src/money/` (BigInt minor units, ISO 4217 minor units, `convertMoney`, decimal-string Zod schemas); line resolution in `packages/shared/src/finance/accountingFxLines.ts`; rates and settings in `apps/backend/src/accounting/use-cases/exchangeRateUseCases.ts`, `journalEntryFx.ts`, `db/repositories/accountingExchangeRatesRepository.ts`, `accountingCurrencySettingsRepository.ts`; daily feed in `apps/backend/src/worker/fxRates/` (`FX_RATE_FEED_PROVIDERS`).
- IAS 21 documents and period end: invoices/payments carry `currency` + booked/settlement `exchangeRate` (NULL = functional at 1, insert-only so the historical rate never changes) via `apps/backend/src/finance/use-cases/financeDocumentFx.ts`; payments settle in the invoice currency or the functional currency (`settlementInvoiceAmount`) and post realized FX through `buildFxPaymentPostingLines` (`packages/shared/src/finance/financeFxPosting.ts`). Period-end revaluation of monetary account × currency balances at the CLOSING rate (fallback SPOT) with a next-day auto-reversal lives in `accounting/use-cases/fxRevaluationUseCases.ts` (`fx_reval` / `fx_reval_reversal`, idempotent per date); year-end close refuses while foreign monetary balances are unrevalued.
- Consolidation (Platform Console, `workspaces` grant): `packages/shared/src/finance/consolidationTranslation.ts` (IAS 21.39 closing / average / historical, CTA in OCI, intercompany elimination by account code, NCI) and `apps/backend/src/platform/use-cases/consolidationUseCases.ts`, which reads each member inside its own tenant transaction — never a cross-tenant query.
- Lack of exchangeability (IAS 21, 2025 amendment): `accounting_currency_exchangeability` marks a currency as not exchangeable from an assessment date with the disclosed estimation method; from then the feed is skipped and only tenant rates apply, each requiring an `overrideReason` and tagged `source = "estimate"` (`packages/shared/src/finance/accountingFxExchangeability.ts`).
- IAS 29 hyperinflation: `packages/shared/src/finance/accountingHyperinflation.ts` restates non-monetary balance-sheet accounts, equity and P&L by Σ monthly movement × closing index ÷ index of that month (monetary accounts by `is_monetary` are left alone); the balancing figure goes to the net monetary position account in `accounting_hyperinflation_settings`. Runs live in `accounting/use-cases/ias29UseCases.ts` (`ias29_restate` / `ias29_reversal`, next-day reversal, idempotent per date; earlier IAS 29 postings are excluded from the movements). A month with activity but no price index fails with 422.
- IFRS 9 hedge accounting (FX forwards): `packages/shared/src/finance/accountingHedges.ts` values the forward as notional × (closing − contract rate); for cash flow hedges the effective part is the lower of that and a hypothetical derivative at the designation-date market forward rate (only when they offset), posted to the reserve (OCI) with the rest to P&L; fair value hedges go wholly to P&L. `accounting/use-cases/hedgeUseCases.ts` posts valuations with a next-day reversal (`hedge_val` / `hedge_val_rev`, one per hedge and date), settles in cash after the last valuation (`hedge_settle`, reserve kept as `settled_reserve`) and reclassifies the reserve into P&L (`hedge_reclass`). Discontinuation (IFRS 9.6.5.6) is modelled as a status but has no action yet.
- Generated fee invoices bill in the session's `currency` when it is an enabled foreign currency (`generatedInvoiceCurrency`), at the SPOT rate on the due date (`applyGeneratedInvoiceFx` in `finance/use-cases/financeDocumentFx.ts`); otherwise they stay in the functional currency.
- FX report (Accounting → Reports → Foreign exchange, `GET /api/accounting/fx-report?from&asOf`): exposure by currency at the closing rate (`summarizeFxExposure`), realized FX on payments grouped by invoice currency, and revaluations posted in the period (`accounting/use-cases/fxReportUseCases.ts`).
- UI: `apps/frontend/src/tenant/features/accounting/`; cross-module reads through `apps/frontend/src/tenant/hooks/collections/accounting.ts` and `apps/frontend/src/tenant/hooks/collections/finance.ts`.

Journal lines carry IAS 21 dual amounts: `txn_currency` / `txn_debit` / `txn_credit` (decimal strings) at `exchange_rate`, and `debit` / `credit` as the **functional** amount the ledger balances on (still two-decimal numbers, so the functional currency is limited to ≤ 2 minor units until the DTOs move to strings). New money code uses `@mms/shared` `Money` / `parseMoney` / `convertMoney`, never float arithmetic. Rate lookup is "latest on or before the date": tenant rate, its inverse, then the reference feed triangulated via its base; a missing rate fails the write with 422 and is never assumed to be 1. The functional currency (`accounting_currency_settings`) is immutable once anything is posted. Lines written without FX fields are booked in the functional currency at rate 1 by the persist layer.

## Workflow

1. Trace every writer for the operation: interactive form, bulk API, specialized fee/salary entry, finance posting, worker retry, import, and restore. Use the same domain guards for equivalent mutations.
2. Specify the expected entry, source identity, date/period, account eligibility, and report effect. Separate draft storage from posting and external payment authorization from ledger recognition.
3. Make validation and persistence atomic with an explicit concurrency strategy. A transaction alone does not serialize a read-check-upsert sequence. Preserve tenant scope across locks, source keys, audit rows, and artifacts.
4. Implement the smallest compatible change through shared contracts, use cases, and repositories. Ordinary edits do not own lifecycle, source, approval, or close metadata. Posted corrections use linked reversals/adjustments, not overwrites.
5. Verify financial effects through the ledger and all affected consumers: subledger, trial balance, income statement, balance sheet, cash flow, dashboard, and export. A balanced journal alone does not prove correct recognition, classification, authorization, or completeness.
6. Run the applicable evidence matrix and report what was actually tested, any skipped checks, and remaining capability gaps. Do not describe a mocked repository test as proof of PostgreSQL locking or RLS.

## Completion

Use [verification](references/verification.md) for exact scoped commands, then the completion review in `mms-completion-review.md`. Standards-only edits use `bash .agent/scripts/sync-all.sh` and `node scripts/verify-rules-integrity.mjs`; they do not by themselves require financial data changes or deployment.

## Related skills

`mms-schema-migrate`, `mms-backend-api`, `mms-audit-trail`, `mms-reports-export`, `mms-soft-delete`.
