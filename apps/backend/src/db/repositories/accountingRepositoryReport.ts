import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  moneyToCents,
  type AccountingReportAggregates,
  type LedgerPostingAccounts,
} from "@mms/shared";
import { accountingEntries, accountingJournalLines } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import {
  buildCashFlowFigures,
  isCashAccount,
  toReportRow,
  type CashEntryMovement,
  type ReportAccountRow,
} from "./accountingReportCashFlow.js";

export interface AccountingReportQuery {
  dateFrom?: string;
  dateTo?: string;
  /**
   * Posting rules supply the authoritative AR / cash accounts. Without them the
   * report falls back to name/subtype heuristics, which is why they are passed
   * in rather than hard-coded as chart-of-accounts codes.
   */
  postingRules?: Partial<LedgerPostingAccounts>;
}

/**
 * SQL aggregates for the Accounting Reports tier (Trial Balance & Financial
 * Statements).
 *
 * Two period semantics are produced deliberately:
 *
 * - **Range** (`[dateFrom, dateTo]`) drives the flow figures — revenue,
 *   expenses, netSurplus, cash movements and the `trialBalance` rows — because
 *   an Income Statement reports movement over a window.
 * - **As-of `dateTo`** drives the stock figures — assets, liabilities, equity
 *   and `balanceSheetTrialBalance` — because a Balance Sheet reports cumulative
 *   balances. `dateFrom` is intentionally ignored there: filtering a balance
 *   sheet by a start date silently drops every asset acquired before the window.
 *
 * Identity check: every posted entry balances, so within either window
 * `Σ(debit − credit) = 0` across all accounts and therefore
 * `assets = liabilities + equity` holds for each set independently.
 */
export async function aggregateAccountingReport(
  tenant: string,
  query: AccountingReportQuery = {},
): Promise<AccountingReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  const postingRules = query.postingRules ?? {};

  return withTenantRead(subdomain, async (tx) => {
    const dateFrom = query.dateFrom?.trim() || undefined;
    const dateTo = query.dateTo?.trim() || undefined;

    /**
     * Only posted, non-deleted entries may contribute. These filters live in the
     * INNER join rather than the ON clause of a LEFT JOIN: the previous shape
     * retained every journal line with NULL entry columns and summed draft,
     * deleted and out-of-period rows.
     *
     * The three report sets are computed in **one** pass with conditional
     * aggregates instead of three separate scans:
     * - as-of: every posted line up to `dateTo` (stock figures);
     * - range: lines inside `[dateFrom, dateTo]` (Trial Balance rows);
     * - flow: the range excluding closing journals (Income Statement + cash flow).
     */
    const asOfFilter = dateTo ? sql`pl.entry_date <= ${dateTo}` : sql`true`;
    const rangeFilter = sql`${dateFrom ? sql`pl.entry_date >= ${dateFrom}` : sql`true`} AND ${asOfFilter}`;
    const notClosing = sql`pl.source_type IS DISTINCT FROM 'closing'`;

    // One pass for all three windows via conditional aggregates. Raw SQL because
    // three FILTER predicates over the same derived table are clearer to read (and
    // to verify against EXPLAIN) than three separate aggregate queries.
    const result = await tx.execute(sql`
      SELECT a.id,
             a.code,
             a.name,
             a.type,
             a.subtype,
             coalesce(sum(pl.debit) FILTER (WHERE ${asOfFilter}), 0)::numeric::text AS as_of_debit,
             coalesce(sum(pl.credit) FILTER (WHERE ${asOfFilter}), 0)::numeric::text AS as_of_credit,
             coalesce(sum(pl.debit) FILTER (WHERE ${rangeFilter}), 0)::numeric::text AS range_debit,
             coalesce(sum(pl.credit) FILTER (WHERE ${rangeFilter}), 0)::numeric::text AS range_credit,
             coalesce(sum(pl.debit) FILTER (WHERE ${rangeFilter} AND ${notClosing}), 0)::numeric::text AS flow_debit,
             coalesce(sum(pl.credit) FILTER (WHERE ${rangeFilter} AND ${notClosing}), 0)::numeric::text AS flow_credit
        FROM accounting_accounts a
        LEFT JOIN (
          SELECT l.workspace_subdomain,
                 l.account_id,
                 l.debit,
                 l.credit,
                 e.date AS entry_date,
                 e.source_type
            FROM accounting_journal_lines l
            JOIN accounting_entries e
              ON e.workspace_subdomain = l.workspace_subdomain
             AND e.id = l.entry_id
           WHERE e.status = 'posted'
             AND e.deleted_at IS NULL
        ) pl
          ON pl.workspace_subdomain = a.workspace_subdomain
         AND pl.account_id = a.id
       WHERE a.workspace_subdomain = ${subdomain}
         AND a.deleted_at IS NULL
       GROUP BY a.id, a.code, a.name, a.type, a.subtype
       ORDER BY a.code
    `);
    const rows = result.rows as Array<{
      id: string;
      code: string;
      name: string;
      type: string;
      subtype: string;
      as_of_debit: string;
      as_of_credit: string;
      range_debit: string;
      range_credit: string;
      flow_debit: string;
      flow_credit: string;
    }>;

    const asOfRows: ReportAccountRow[] = [];
    const rangeRows: ReportAccountRow[] = [];
    const flowRows: ReportAccountRow[] = [];
    for (const row of rows) {
      asOfRows.push(toReportRow(row, Number(row.as_of_debit), Number(row.as_of_credit)));
      if (dateFrom) {
        rangeRows.push(toReportRow(row, Number(row.range_debit), Number(row.range_credit)));
      } else {
        // Without a start date the range set is the as-of set.
        rangeRows.push(toReportRow(row, Number(row.as_of_debit), Number(row.as_of_credit)));
      }
      // The flow set always excludes closing journals.
      flowRows.push(toReportRow(row, Number(row.flow_debit), Number(row.flow_credit)));
    }

    const centsByType = (list: readonly ReportAccountRow[], type: string): number =>
      list.reduce((total, row) => (row.type === type ? total + row.balanceCents : total), 0);

    const revenueCents = centsByType(flowRows, "Revenue");
    const expensesCents = centsByType(flowRows, "Expense");
    const netSurplusCents = revenueCents - expensesCents;
    const assetsCents = centsByType(asOfRows, "Asset");
    const liabilitiesCents = centsByType(asOfRows, "Liability");
    const equityAccountsCents = centsByType(asOfRows, "Equity");
    const asOfSurplusCents = centsByType(asOfRows, "Revenue") - centsByType(asOfRows, "Expense");

    const cashMovements = await loadCashEntryMovements(
      tx,
      subdomain,
      flowRows.filter((row) => isCashAccount(row, postingRules.cashAccountId)).map((row) => row.id),
      dateFrom,
      dateTo,
    );
    const cash = buildCashFlowFigures(flowRows, cashMovements, netSurplusCents, postingRules);
    const centsToAmount = (cents: number): number => cents / 100;

    return {
      revenue: centsToAmount(revenueCents),
      expenses: centsToAmount(expensesCents),
      netSurplus: centsToAmount(netSurplusCents),
      assets: centsToAmount(assetsCents),
      liabilities: centsToAmount(liabilitiesCents),
      // Unclosed P&L is not yet in a retained-earnings account, so equity only
      // reconciles with assets once the as-of surplus is included. When a
      // closing entry IS inside the window the P&L accounts net to zero and this
      // term correctly contributes nothing.
      equity: centsToAmount(equityAccountsCents + asOfSurplusCents),
      cashInflow: centsToAmount(cash.cashInflowCents),
      cashOutflow: centsToAmount(cash.cashOutflowCents),
      netCashFlow: centsToAmount(cash.netCashFlowCents),
      netCashFlowIndirect: centsToAmount(cash.netCashFlowIndirectCents),
      cashFlowAdjustments: {
        depreciation: centsToAmount(cash.adjustments.depreciationCents),
        // A receivable increase consumes cash, so the working-capital adjustment
        // is the negated movement; a payable increase releases cash.
        receivables: centsToAmount(cash.adjustments.receivablesCents),
        payables: centsToAmount(cash.adjustments.payablesCents),
        other: centsToAmount(cash.adjustments.otherCents),
      },
      trialBalance: rangeRows.map(toTrialBalanceRow),
      incomeStatementTrialBalance: flowRows.map(toTrialBalanceRow),
      balanceSheetTrialBalance: asOfRows
        .filter((row) => row.type === "Asset" || row.type === "Liability" || row.type === "Equity")
        .map(toTrialBalanceRow),
    };
  });
}

/** Trial-balance DTO row from the cents-integer representation. */
function toTrialBalanceRow(row: ReportAccountRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype,
    totalDebit: row.totalDebitCents / 100,
    totalCredit: row.totalCreditCents / 100,
    balance: row.balanceCents / 100,
  };
}

/**
 * Cash debit/credit per entry for the window, restricted to the classified cash
 * accounts. Grouping by entry is what removes internal transfers from the gross
 * figures (`buildCashFlowFigures` splits the net leg).
 */
async function loadCashEntryMovements(
  tx: TenantTransaction,
  subdomain: string,
  cashAccountIds: readonly string[],
  dateFrom: string | undefined,
  dateTo: string | undefined,
): Promise<CashEntryMovement[]> {
  if (cashAccountIds.length === 0) return [];
  const dateFilter = and(
    dateFrom ? sql`${accountingEntries.date} >= ${dateFrom}` : undefined,
    dateTo ? sql`${accountingEntries.date} <= ${dateTo}` : undefined,
  );
  const result = await tx
    .select({
      entryId: accountingJournalLines.entryId,
      cashDebit: sql<string>`coalesce(sum(${accountingJournalLines.debit}), 0)::numeric::text`,
      cashCredit: sql<string>`coalesce(sum(${accountingJournalLines.credit}), 0)::numeric::text`,
    })
    .from(accountingJournalLines)
    .innerJoin(
      accountingEntries,
      and(
        eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
        eq(accountingJournalLines.entryId, accountingEntries.id),
        isNull(accountingEntries.deletedAt),
        eq(accountingEntries.status, "posted"),
        sql`${accountingEntries.sourceType} IS DISTINCT FROM 'closing'`,
        dateFilter,
      ),
    )
    .where(
      and(
        eq(accountingJournalLines.workspaceSubdomain, subdomain),
        inArray(accountingJournalLines.accountId, [...cashAccountIds]),
      ),
    )
    .groupBy(accountingJournalLines.entryId);
  return result.map((row) => ({
    entryId: row.entryId,
    cashDebitCents: moneyToCents(Number(row.cashDebit)),
    cashCreditCents: moneyToCents(Number(row.cashCredit)),
  }));
}
