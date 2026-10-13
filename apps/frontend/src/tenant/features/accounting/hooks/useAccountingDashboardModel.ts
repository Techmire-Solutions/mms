import { formatMonthName } from "@mms/shared";
import { computeFinancials, type Account, type JournalEntry } from "@/lib/data/accountingData";

export function useAccountingDashboardModel(accounts: Account[], entries: JournalEntry[]) {
  const financials = (() => computeFinancials(accounts, entries))();

  const { postedEntries, draftEntries } = (() => {
    const posted: JournalEntry[] = [];
    const draft: JournalEntry[] = [];
    for (const journalEntry of entries) {
      if (journalEntry.status === "posted") posted.push(journalEntry);
      else if (journalEntry.status === "draft") draft.push(journalEntry);
    }
    return { postedEntries: posted, draftEntries: draft };
  })();

  const monthlyData = (() => {
    const accountTypeById = new Map<string, string>();
    for (const account of accounts) {
      accountTypeById.set(account.id, account.type);
    }

    const totalsByMonth: Record<string, { month: string; revenue: number; expenses: number }> = {};
    for (const journalEntry of postedEntries) {
      const monthKey = journalEntry.date.slice(0, 7);
      if (!totalsByMonth[monthKey])
        totalsByMonth[monthKey] = { month: monthKey, revenue: 0, expenses: 0 };
      const monthRecord = totalsByMonth[monthKey];
      for (const journalLine of journalEntry.lines) {
        const type = accountTypeById.get(journalLine.account_id);
        if (type === "Revenue") monthRecord.revenue += journalLine.credit - journalLine.debit;
        else if (type === "Expense") monthRecord.expenses += journalLine.debit - journalLine.credit;
      }
    }
    return Object.values(totalsByMonth)
      .sort((firstMonth, secondMonth) => firstMonth.month.localeCompare(secondMonth.month))
      .slice(-6)
      .map((monthTotal) => ({
        ...monthTotal,
        month: formatMonthName(`${monthTotal.month}-01`),
      }));
  })();

  const recentEntries = (() =>
    [...entries]
      .sort((firstEntry, secondEntry) => secondEntry.date.localeCompare(firstEntry.date))
      .slice(0, 5))();

  /**
   * `netCashFlow` is deliberately NOT surfaced: the client derived it as
   * `assets - liabilities`, which is not a cash-flow figure (buying a building
   * would read as a cash inflow). The dashboard takes the real cash-account
   * movement from the server's report aggregates; `expenseBreakdown` likewise
   * comes from the server's trial balance.
   */
  const { netCashFlow: _unusedNetCashFlow, ...flows } = financials;

  return {
    ...flows,
    postedEntries,
    draftEntries,
    monthlyData,
    recentEntries,
  };
}
