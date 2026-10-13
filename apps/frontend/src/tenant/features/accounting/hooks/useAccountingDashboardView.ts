import { TrendingUp, TrendingDown, Scale, DollarSign, CheckCircle2, Clock } from "lucide-react";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import type { MetricItem } from "@/components/ui/ModuleCommandMetricsGrid";
import { useAccountingDashboardModel } from "@/tenant/features/accounting/components/useAccountingDashboardModel";
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
  const { data: serverMetrics } = useAccountingMetrics();
  const { data: serverAggregates } = useAccountingReportAggregates();

  const {
    revenue: modelRevenue,
    expenses: modelExpenses,
    netSurplus: modelSurplus,
    assets: modelAssets,
    liabilities: modelLiabilities,
    equity,
    postedEntries,
    draftEntries,
    monthlyData,
    recentEntries,
  } = useAccountingDashboardModel(accounts, entries);

  const revenue = serverMetrics?.revenue ?? modelRevenue;
  const expenses = serverMetrics?.expenses ?? modelExpenses;
  const netSurplus = serverMetrics?.surplus ?? modelSurplus;
  const assets = serverMetrics?.assets ?? modelAssets;
  const liabilities = serverMetrics?.liabilities ?? modelLiabilities;
  const postedCount = serverMetrics?.posted ?? postedEntries.length;
  const draftCount = serverMetrics?.draft ?? draftEntries.length;
  const netCashFlow = serverAggregates?.netCashFlow ?? 0;

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

  const balanceDifference = Math.abs(assets - (liabilities + equity));
  const isBalanced = balanceDifference < 1;

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
  };
}
