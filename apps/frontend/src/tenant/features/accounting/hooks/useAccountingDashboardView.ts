import { TrendingUp, TrendingDown, Scale, DollarSign, CheckCircle2, Clock } from "lucide-react";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import type { MetricItem } from "@/components/app/ModuleCommandMetricsGrid";
import { formatMonthName, moneyToCents } from "@mms/shared";
import {
  useAccountingMetrics,
  useAccountingReportAggregates,
} from "@/tenant/features/accounting/hooks/useAccountingApi";

export interface BalanceSheetItem {
  id: string;
  name: string;
  value: number;
  percentage: number;
  colorClass: string;
}

export interface ExpenseBreakdownItem {
  name: string;
  value: number;
}

export function useAccountingDashboardView(accounts: Account[], entries: JournalEntry[]) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { primary, secondary, charts } = useBrandPalette();
  const pieColors = charts;
  const metricsQuery = useAccountingMetrics();
  const aggregatesQuery = useAccountingReportAggregates();
  const serverMetrics = metricsQuery.data;
  const serverAggregates = aggregatesQuery.data;
  // Until both server reads settle, the figures below would be zeros masquerading
  // as real balances; the dashboard renders a skeleton/error state instead.
  const isLoading = metricsQuery.isLoading || aggregatesQuery.isLoading;
  const isError = metricsQuery.isError || aggregatesQuery.isError;
  const refetch = () => {
    void metricsQuery.refetch();
    void aggregatesQuery.refetch();
  };

  /**
   * Every money figure comes from the server: command metrics (totals + the
   * six-month series) and report aggregates (cash flow, equity, expense rows).
   * The browser used to recompute all of this from a paged-through copy of the
   * whole ledger — up to 50 × 100 full vouchers — which is what this replaced.
   * The only local list is the page of recent entries the snapshot renders.
   */
  const revenue = serverMetrics?.revenue ?? 0;
  const expenses = serverMetrics?.expenses ?? 0;
  const netSurplus = serverMetrics?.surplus ?? 0;
  const assets = serverMetrics?.assets ?? 0;
  const liabilities = serverMetrics?.liabilities ?? 0;
  const equity = serverAggregates?.equity ?? 0;
  const postedCount = serverMetrics?.posted ?? 0;
  const draftCount = serverMetrics?.draft ?? 0;
  const netCashFlow = serverAggregates?.netCashFlow ?? 0;
  const monthlyData = (serverMetrics?.monthly ?? []).map((series) => ({
    ...series,
    month: formatMonthName(`${series.month}-01`),
  }));
  const recentEntries = [...entries]
    .sort((firstEntry, secondEntry) => secondEntry.date.localeCompare(firstEntry.date))
    .slice(0, 5);

  const rawExpenseRows =
    serverAggregates?.incomeStatementTrialBalance ?? serverAggregates?.trialBalance ?? [];
  const expenseBreakdown: ExpenseBreakdownItem[] = rawExpenseRows
    .filter((row) => row.type === "Expense" && row.totalDebit > 0)
    .map((row) => ({ name: row.name, value: row.totalDebit - row.totalCredit }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 5);

  const rawBs = [
    {
      id: "Assets",
      name: t("accounting.dashboard.assets"),
      value: Math.max(0, assets),
      colorClass: "bg-info",
    },
    {
      id: "Liabilities",
      name: t("accounting.dashboard.liabilities"),
      value: Math.max(0, liabilities),
      colorClass: "bg-destructive",
    },
    {
      id: "Equity",
      name: t("accounting.dashboard.equity"),
      value: Math.max(0, equity),
      colorClass: "bg-primary",
    },
  ];
  const maxBs = Math.max(...rawBs.map((item) => item.value), 1);
  const bsData: BalanceSheetItem[] = rawBs.map((item) => ({
    ...item,
    percentage: (item.value / maxBs) * 100,
  }));

  // Balance is exact integer cents, never a float tolerance: the old `< 1`
  // threshold called a balance sheet off by 0.99 "balanced".
  const balanceDifferenceCents = Math.abs(
    moneyToCents(assets) - moneyToCents(liabilities) - moneyToCents(equity),
  );
  const balanceDifference = balanceDifferenceCents / 100;
  const isBalanced = balanceDifferenceCents === 0;

  const metricItems: MetricItem[] = [
    {
      key: "revenue",
      label: t("accounting.dashboard.totalRevenue"),
      value: formatCurrency(revenue),
      icon: TrendingUp,
      accent: "success",
    },
    {
      key: "expenses",
      label: t("accounting.dashboard.totalExpenses"),
      value: formatCurrency(expenses),
      icon: TrendingDown,
      accent: "destructive",
    },
    {
      key: "surplus",
      label: t("accounting.dashboard.netSurplus"),
      value: formatCurrency(Math.abs(netSurplus)),
      sub: netSurplus < 0 ? t("accounting.dashboard.deficit") : t("accounting.dashboard.surplus"),
      icon: DollarSign,
      accent: netSurplus >= 0 ? "primary" : "destructive",
    },
    {
      key: "assets",
      label: t("accounting.dashboard.totalAssets"),
      value: formatCurrency(assets),
      icon: Scale,
      accent: "info",
    },
    {
      key: "liabilities",
      label: t("accounting.dashboard.totalLiabilities"),
      value: formatCurrency(liabilities),
      icon: Scale,
      accent: "muted",
    },
    {
      key: "cash-flow",
      label: t("accounting.dashboard.netCashFlow"),
      value: formatCurrency(Math.abs(netCashFlow)),
      sub:
        netCashFlow >= 0 ? t("accounting.dashboard.positive") : t("accounting.dashboard.negative"),
      icon: TrendingUp,
      accent: "primary",
    },
    {
      key: "posted",
      label: t("accounting.dashboard.postedEntries"),
      value: postedCount,
      icon: CheckCircle2,
      accent: "success",
    },
    {
      key: "drafts",
      label: t("accounting.dashboard.pendingDrafts"),
      value: draftCount,
      icon: Clock,
      accent: draftCount > 0 ? "warning" : "muted",
    },
  ];

  return {
    t,
    formatCurrency,
    primary,
    secondary,
    pieColors,
    metricItems,
    monthlyData,
    expenseBreakdown,
    bsData,
    isBalanced,
    balanceDifference,
    recentEntries,
    isLoading,
    isError,
    refetch,
  };
}
