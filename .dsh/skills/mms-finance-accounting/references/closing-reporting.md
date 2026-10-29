# Closing, reconciliation, and reporting

Advisory workflow; consult [policy applicability](policies-2026.md) and [verification](verification.md). These checks are not a claim that every capability already exists in MMS.

## Close and opening workflow

1. Establish the fiscal interval and accounting basis. Reconcile cash/bank, receivables, payables, payroll liabilities, advances, restricted funds where applicable, and suspense/clearing accounts. Explain unresolved differences; do not post an unexplained balancing plug.
2. Identify draft/unposted items, late invoices, accruals, deferrals, depreciation, impairment/bad debts, FX remeasurement, and subsequent-event adjustments that are relevant to the adopted policy. Retain reviewer decisions and cutoff evidence.
3. Serialize closing against all postings and period edits that could change the interval. Recheck status and account eligibility under that protocol; atomically post the closing entry and change the period status. A failed close leaves neither a partial journal nor a closed-but-unposted year.
4. Resolve an active tenant-owned Equity account for current MMS retained earnings. For nonprofit fund balances or different frameworks, obtain the approved mapping rather than relabeling cash or revenue as equity. Define whether P&L is closed separately per fund/currency/segment before adding those dimensions.
5. Preserve the posted close reference and audit evidence. Generic fiscal-year edits must not close, reopen, hide, delete, or move the dates of a closed period. Explicit reopening is a separate policy-controlled feature, not a generic status update.
6. Carry permanent-account balances consistently into the next period. In a continuous ledger, prior balances already exist: do not duplicate them with a new opening journal. Migration opening balances require a cutoff, complete balanced control totals, source evidence, and an idempotent posting identity.
7. An unchanged opening/closing replay can return the original result; changed content needs an authorized correction. Do not report success while silently keeping different previously posted balances. Corrections to a prior period may require comparative restatement under the adopted framework; software immutability alone does not decide the reporting treatment.

Fiscal-year and monthly posting-period controls are separate. A posting-period table or a disabled button does not prove monthly locks are enforced on every writer. Test the containing date interval as well as the declared fiscal-year ID, and reject or explicitly handle overlapping fiscal calendars.

## Bank and subledger reconciliation

- Scope every bank statement to tenant, bank account, currency, interval, and immutable import identity. Verify opening balance plus signed movements equals closing balance. Preserve statement lines; correction/matching metadata should not rewrite bank evidence.
- Match only eligible posted journal lines for the same bank account and currency. Enforce uniqueness and remaining amount at the database boundary; two reviewers must not consume the same line twice.
- Where supported, represent one-to-many, many-to-one, partial settlements, fees, transfers in transit, outstanding cheques, and deposits in transit explicitly. A date/amount similarity is a suggestion, not proof. Unmatch/re-match needs an audit trail.
- Reconcile the statement balance plus supported timing differences to the ledger balance. Never clear an unexplained residual by mutating amounts or silently creating a journal. Post a separately reviewed adjustment when justified.
- Reconcile invoice allocations to AR, supplier balances to AP, payroll deductions to liabilities, and payment-provider clearing balances to settlements. Use a cutoff-consistent dataset and investigate aged unmatched/suspense items.

## Distinguish report semantics

| Output | Population and time basis |
|---|---|
| General ledger / trial balance | Posted ledger through the specified interval/as-of date; include closing entries. Clearly label a movement trial balance versus a cumulative balance. |
| Income / expenditure statement | Recognition-period flows excluding year-end closing transfers; retain actual reversals and corrections according to policy. |
| Balance sheet / financial position | Cumulative stock through the as-of date, including prior-period balances and closing transfers. Include unclosed surplus in equity exactly once. |
| Cash-flow statement | Actual cash-equivalent movements classified as operating, investing, financing; separate noncash disclosures and relevant FX reconciliation. |
| Budget / fund report | Actuals on the stated basis with budget version, restrictions, transfers, and allocation policy; do not mix cash collections with accrual revenue. |

MMS exposes `trialBalance`, `incomeStatementTrialBalance`, and `balanceSheetTrialBalance` in `packages/shared/src/finance/accountingReportAggregates.ts`. Follow each consumer through financial panels, dashboards, command metrics, charts, exports, and drilldowns. Independent metrics queries may still use different filters; do not infer their correctness from the report endpoint.

For IAS 7-style reporting when applicable, transfers between cash-equivalent accounts are not external inflow/outflow. Do not count opening or closing journals as operating cash. Direct and indirect **operating** cash flow should reconcile after all applicable adjustments; neither should be equated to total cash movement when investing/financing activity exists. Account-code/name guesses are legacy heuristics, not authoritative classification. Cash-flow and income-statement classifications are distinct mappings.

Use the same cutoff/snapshot across multi-query report sections to avoid a concurrent posting changing one subtotal but not another. Record accounting date separately from UTC creation/approval timestamps. Never derive fiscal dates from a viewer's timezone or localize persisted ISO dates.

## Export and review evidence

Saved report definitions remain live queries under existing report rules. A formally issued/exported financial pack is different: retain the authorized artifact, filters, period, basis, currency/units, policy/mapping version, generation time, actor, and source cutoff under the agreed retention policy. A checksum detects alteration; it does not prove accounting correctness or constitute an audit opinion.

Verify that screens, CSV/XLSX, PDF, and printed totals agree. Export exact numeric values with currency metadata; neutralize untrusted text formula prefixes without converting legitimate negative amounts into text. Make provisional/unreconciled data explicit and surface unavailable data as an error rather than a zero balance.
