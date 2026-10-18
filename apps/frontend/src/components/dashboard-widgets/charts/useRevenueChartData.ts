import {
  getCollectedAmountForInvoice,
  getRecentMonthsList,
  buildBucketedSeries,
  type Account,
  type JournalEntry,
  FINANCE_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
} from "@mms/shared";
import { useFinanceInvoicesPaginated } from "@/tenant/hooks/collections/finance";
import {
  useAccountingEntriesPaginated,
  useAccountingAccountsPaginated,
} from "@/tenant/hooks/collections/accounting";

export interface RevenuePoint {
  month: string;
  revenue: number;
  expenses: number;
}

export function useRevenueChartData() {
  const invoices =
    useFinanceInvoicesPaginated({ page: 1, limit: FINANCE_MODULE_MANIFEST.maxPageSize }).data
      ?.invoices ?? [];
  const entriesQueryResult = useAccountingEntriesPaginated({
    page: 1,
    limit: ACCOUNTING_MODULE_MANIFEST.maxPageSize,
  }).data;
  const accountsQueryResult = useAccountingAccountsPaginated({
    page: 1,
    limit: ACCOUNTING_MODULE_MANIFEST.maxPageSize,
  }).data;
  const entriesEnvelope = entriesQueryResult as {
    body?: { entries?: JournalEntry[] };
    entries?: JournalEntry[];
  } | null;
  const accountsEnvelope = accountsQueryResult as {
    body?: { accounts?: Account[] };
    accounts?: Account[];
  } | null;
  const entries: JournalEntry[] = entriesEnvelope?.body?.entries ?? entriesEnvelope?.entries ?? [];
  const accounts: Account[] = accountsEnvelope?.body?.accounts ?? accountsEnvelope?.accounts ?? [];
  const months = ((): { key: string; label: string }[] => getRecentMonthsList(10))();

  const revenueData: RevenuePoint[] = (() => {
    const postedEntries = entries.filter((journalEntry) => journalEntry.status === "posted");
    const hasAccountingData = postedEntries.length > 0 && accounts.length > 0;
    const accountMap = new Map(accounts.map((acc) => [acc.id, acc]));

    if (hasAccountingData) {
      const monthTotalsMap = new Map<string, { revenue: number; expenses: number }>();
      postedEntries.forEach((journalEntry) => {
        const entryMonth = journalEntry.date.slice(0, 7);
        let totals = monthTotalsMap.get(entryMonth);
        if (!totals) {
          totals = { revenue: 0, expenses: 0 };
          monthTotalsMap.set(entryMonth, totals);
        }
        journalEntry.lines.forEach((journalLine) => {
          const account = accountMap.get(journalLine.account_id);
          if (account?.type === "Revenue") {
            totals!.revenue += journalLine.credit - journalLine.debit;
          } else if (account?.type === "Expense") {
            totals!.expenses += journalLine.debit - journalLine.credit;
          }
        });
      });

      return buildBucketedSeries(months, monthTotalsMap, (monthDefinition, totals) => ({
        month: monthDefinition.label,
        revenue: totals?.revenue ?? 0,
        expenses: totals?.expenses ?? 0,
      }));
    }

    const monthInvoiceTotalsMap = new Map<string, { revenue: number; expenses: number }>();
    invoices.forEach((invoice) => {
      if (!invoice || invoice.status === "cancelled") return;
      const invoiceMonth = (invoice.paidDate || invoice.dueDate || "").slice(0, 7);
      if (invoiceMonth) {
        let totals = monthInvoiceTotalsMap.get(invoiceMonth);
        if (!totals) {
          totals = { revenue: 0, expenses: 0 };
          monthInvoiceTotalsMap.set(invoiceMonth, totals);
        }
        totals.revenue += getCollectedAmountForInvoice(invoice);
        totals.expenses += Number(invoice.discountAmt || 0);
      }
    });

    return buildBucketedSeries(months, monthInvoiceTotalsMap, (monthDefinition, totals) => ({
      month: monthDefinition.label,
      revenue: totals?.revenue ?? 0,
      expenses: totals?.expenses ?? 0,
    }));
  })();

  return { revenueData };
}
