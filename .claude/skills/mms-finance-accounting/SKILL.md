---
name: mms-finance-accounting
description: Implements or audits MMS finance and accounting workflows — invoices, payments, double-entry bookkeeping, chart of accounts, fiscal years, fee structures, and financial reports. Use when modifying finance or accounting features, payment gateways, invoice templates, or ledger entries. Do NOT use for general custom form building (use mms-form-architecture), generic data querying (use mms-query-factories), or low-level database audit hash chains (use mms-audit-trail).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-04
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
- UI: `apps/frontend/src/tenant/features/accounting/`; cross-module reads through `apps/frontend/src/tenant/hooks/collections/accounting.ts` and `apps/frontend/src/tenant/hooks/collections/finance.ts`.

The existing journal DTO uses two-decimal **numbers**, `moneyToCents` returns a JavaScript number, and database amounts use numeric columns. This is a compatibility boundary, not proof of arbitrary precision or multicurrency support. Follow the exact-money migration guidance in the ledger reference; do not copy a floating-point summation or invent a parallel money validator.

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
