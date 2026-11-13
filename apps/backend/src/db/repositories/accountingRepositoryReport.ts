import { and, eq, isNull, sql } from "drizzle-orm";
import {
  accountTypeFromDb,
  isDebitNormalAccountType,
  moneyToCents,
  type AccountingAccountType,
  type AccountingReportAggregates,
  type LedgerPostingAccounts,
} from "@mms/shared";
import { accountingAccounts, accountingEntries, accountingJournalLines } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

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

interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: AccountingAccountType;
  subtype: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

/**
 * Accounts that look like cash/bank but are explicitly NOT, so a code-prefix
 * heuristic cannot pull them into the cash-flow statement.
 */
const NON_CASH_ASSET_RE = /receiv|prepaid|accumulated|contra|deposit|advance/i;

/**
 * Cash/bank classification.
 *
 * Two rules compose, deliberately asymmetrically:
 *
 * - A configured `cashAccountId` is always cash, even when its code and name do
 *   not look like it. It is **additive** with the heuristic below, because a
 *   workspace may bank in several accounts while the posting rule holds only one,
 *   and gross cash flow should not under-report.
 * - Otherwise an Asset account is cash when its subtype/name says so, or when it
 *   sits in the conventional `10xx` block — minus the non-cash asset carve-outs
 *   above, which previously leaked receivables, prepaids and accumulated
 *   depreciation into cash flow.
 */
function isCashAccount(
  row: { id: string; type: string; code: string; name: string; subtype: string },
  configuredCashAccountId?: string | null,
): boolean {
  // An explicitly configured cash/bank account wins outright, even when its code
  // or name would not match the conventional heuristic.
  if (configuredCashAccountId && row.id === configuredCashAccountId) return true;
  if (row.type !== "Asset") return false;
  const haystack = `${row.name} ${row.subtype}`.toLowerCase();
  if (NON_CASH_ASSET_RE.test(haystack)) return false;
  return row.code.startsWith("10") || haystack.includes("cash") || haystack.includes("bank");
}

/** Accounts-receivable accounts, used only when no AR account is configured. */
function isReceivableAccount(row: { type: string; name: string; subtype: string }): boolean {
  return row.type === "Asset" && /receiv/i.test(`${row.name} ${row.subtype}`);
}

/** Current-liability payable accounts for the working-capital adjustment. */
function isPayableAccount(row: { type: string; name: string; subtype: string }): boolean {
  return row.type === "Liability" && /payab/i.test(`${row.name} ${row.subtype}`);
}

/** Non-cash expense add-backs. */
function isDepreciationAccount(row: { type: string; name: string; subtype: string }): boolean {
  return row.type === "Expense" && /depreciat|amorti/i.test(`${row.name} ${row.subtype}`);
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
     */
    const buildTrialBalance = async (
      rangeStart: string | undefined,
      rangeEnd: string | undefined,
      excludeClosing = false,
    ): Promise<TrialBalanceRow[]> => {
      const entryDateFilter = and(
        rangeStart ? sql`${accountingEntries.date} >= ${rangeStart}` : undefined,
        rangeEnd ? sql`${accountingEntries.date} <= ${rangeEnd}` : undefined,
      );

      const postedLines = tx
        .select({
          workspaceSubdomain: accountingJournalLines.workspaceSubdomain,
          accountId: accountingJournalLines.accountId,
          debit: accountingJournalLines.debit,
          credit: accountingJournalLines.credit,
        })
        .from(accountingJournalLines)
        .innerJoin(
          accountingEntries,
          and(
            eq(accountingJournalLines.workspaceSubdomain, accountingEntries.workspaceSubdomain),
            eq(accountingJournalLines.entryId, accountingEntries.id),
            isNull(accountingEntries.deletedAt),
            eq(accountingEntries.status, "posted"),
            excludeClosing
              ? sql`${accountingEntries.sourceType} IS DISTINCT FROM 'closing'`
              : undefined,
            entryDateFilter,
          ),
        )
        .as("posted_lines");

      const rows = await tx
        .select({
          id: accountingAccounts.id,
          code: accountingAccounts.code,
          name: accountingAccounts.name,
          type: accountingAccounts.type,
          subtype: accountingAccounts.subtype,
          // Exact decimal text, converted once at the boundary: a float8 sum
          // re-introduces binary rounding into a figure the ledger (and the
          // year-end closing entry) is supposed to balance on.
          totalDebit: sql<string>`coalesce(sum(${postedLines.debit}), 0)::numeric::text`,
          totalCredit: sql<string>`coalesce(sum(${postedLines.credit}), 0)::numeric::text`,
        })
        .from(accountingAccounts)
        .leftJoin(
          postedLines,
          and(
            eq(postedLines.workspaceSubdomain, accountingAccounts.workspaceSubdomain),
            eq(postedLines.accountId, accountingAccounts.id),
          ),
        )
        .where(
          and(
            eq(accountingAccounts.workspaceSubdomain, subdomain),
            isNull(accountingAccounts.deletedAt),
          ),
        )
        .groupBy(
          accountingAccounts.id,
          accountingAccounts.code,
          accountingAccounts.name,
          accountingAccounts.type,
          accountingAccounts.subtype,
        )
        .orderBy(accountingAccounts.code);

      return rows.map((r) => {
        const totalDebit = Number(r.totalDebit);
        const totalCredit = Number(r.totalCredit);
        const totalDebitCents = moneyToCents(totalDebit);
        const totalCreditCents = moneyToCents(totalCredit);
        // Balance in integer cents: a float subtraction here would feed a
        // rounding error into every report total below.
        const balanceCents = isDebitNormalAccountType(r.type)
          ? totalDebitCents - totalCreditCents
          : totalCreditCents - totalDebitCents;
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          type: accountTypeFromDb(r.type),
          subtype: r.subtype,
          totalDebit,
          totalCredit,
          balance: balanceCents / 100,
        };
      });
    };

    const rangeRows = await buildTrialBalance(dateFrom, dateTo);
    const flowRows = await buildTrialBalance(dateFrom, dateTo, true);
    // Cumulative stock figures: everything through dateTo, deliberately ignoring
    // dateFrom so prior-period assets/equity still appear.
    const asOfRows = dateFrom ? await buildTrialBalance(undefined, dateTo) : rangeRows;

    // Every report total is accumulated in integer cents and converted once, so a
    // float sum of 2-dp balances cannot produce 0.30000000000000004 — the reason
    // the aggregate schemas could not enforce a 2-dp money type.
    const sumCentsByType = (rows: readonly TrialBalanceRow[], type: string): number =>
      rows.reduce(
        (total, row) => (row.type === type ? total + moneyToCents(row.balance) : total),
        0,
      );

    const revenueCents = sumCentsByType(flowRows, "Revenue");
    const expensesCents = sumCentsByType(flowRows, "Expense");
    const netSurplusCents = revenueCents - expensesCents;
    const assetsCents = sumCentsByType(asOfRows, "Asset");
    const liabilitiesCents = sumCentsByType(asOfRows, "Liability");
    const equityAccountsCents = sumCentsByType(asOfRows, "Equity");
    const asOfSurplusCents =
      sumCentsByType(asOfRows, "Revenue") - sumCentsByType(asOfRows, "Expense");

    let cashInflowCents = 0;
    let cashOutflowCents = 0;
    let receivableMovementCents = 0;
    let payableMovementCents = 0;
    let depreciationCents = 0;

    for (const row of flowRows) {
      const debitCents = moneyToCents(row.totalDebit);
      const creditCents = moneyToCents(row.totalCredit);
      if (isCashAccount(row, postingRules.cashAccountId)) {
        cashInflowCents += debitCents;
        cashOutflowCents += creditCents;
      }
      // A configured AR account is authoritative and EXCLUSIVE: unlike cash there
      // is exactly one receivable, so the name heuristic must not add further
      // accounts to the working-capital adjustment.
      const isConfiguredAr =
        Boolean(postingRules.arAccountId) && row.id === postingRules.arAccountId;
      if (isConfiguredAr || (!postingRules.arAccountId && isReceivableAccount(row))) {
        receivableMovementCents += debitCents - creditCents;
      }
      if (isPayableAccount(row)) {
        payableMovementCents += creditCents - debitCents;
      }
      if (isDepreciationAccount(row)) {
        depreciationCents += debitCents - creditCents;
      }
    }

    const netCashFlowCents = cashInflowCents - cashOutflowCents;
    const receivablesAdjustmentCents = -receivableMovementCents;
    const netCashFlowIndirectCents =
      netSurplusCents + depreciationCents + receivablesAdjustmentCents + payableMovementCents;
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
      cashInflow: centsToAmount(cashInflowCents),
      cashOutflow: centsToAmount(cashOutflowCents),
      netCashFlow: centsToAmount(netCashFlowCents),
      netCashFlowIndirect: centsToAmount(netCashFlowIndirectCents),
      cashFlowAdjustments: {
        depreciation: centsToAmount(depreciationCents),
        // A receivable increase consumes cash, so the working-capital adjustment
        // is the negated movement; a payable increase releases cash.
        receivables: centsToAmount(receivablesAdjustmentCents),
        payables: centsToAmount(payableMovementCents),
      },
      trialBalance: rangeRows,
      incomeStatementTrialBalance: flowRows,
      balanceSheetTrialBalance: asOfRows.filter(
        (row) => row.type === "Asset" || row.type === "Liability" || row.type === "Equity",
      ),
    };
  });
}
