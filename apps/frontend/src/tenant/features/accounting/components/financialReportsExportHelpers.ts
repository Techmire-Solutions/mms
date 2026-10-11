import type { AppTranslationKey } from "@mms/shared";
import type { ExportColumn } from "@/components/ui/ExportToolbar";
import { buildCashflowExportRows } from "./financialReportsCashflowExport";

export interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface BuildFinancialReportExportRowsOptions {
  view: "income" | "balance" | "cashflow";
  tb: TrialBalanceRow[];
  balanceSheetTb: TrialBalanceRow[];
  revenue: number;
  expenses: number;
  netSurplus: number;
  assets: number;
  liabilities: number;
  equity: number;
  depreciationAdjustment: number;
  receivablesChange: number;
  payablesChange: number;
  netCashFlowIndirect: number;
  netCashFlow: number;
  cashInflow: number;
  cashOutflow: number;
  formatCurrency: (value: number) => string;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}

export function getFinancialReportExportColumns(
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): ExportColumn[] {
  return [
    { header: t("accounting.reports.export.section"), key: "section" },
    { header: t("accounting.reports.export.code"), key: "code" },
    { header: t("accounting.reports.export.account"), key: "account" },
    { header: t("accounting.reports.export.amount"), key: "amount" },
  ];
}

export function buildFinancialReportExportRows({
  view,
  tb,
  balanceSheetTb,
  revenue,
  expenses,
  netSurplus,
  assets,
  liabilities,
  equity,
  depreciationAdjustment,
  receivablesChange,
  payablesChange,
  netCashFlowIndirect,
  netCashFlow,
  cashInflow,
  cashOutflow,
  formatCurrency,
  t,
}: BuildFinancialReportExportRowsOptions): Record<string, string>[] {
  if (view === "cashflow") {
    return buildCashflowExportRows({
      netSurplus,
      depreciationAdjustment,
      receivablesChange,
      payablesChange,
      netCashFlowIndirect,
      netCashFlow,
      cashInflow,
      cashOutflow,
      formatCurrency,
      t,
    });
  }

  const sourceTb = view === "balance" ? balanceSheetTb : tb;
  const rowsByType = new Map<string, TrialBalanceRow[]>();
  for (const row of sourceTb) {
    let list = rowsByType.get(row.type);
    if (!list) {
      list = [];
      rowsByType.set(row.type, list);
    }
    list.push(row);
  }
  const getRowsByAccountType = (type: string): TrialBalanceRow[] => rowsByType.get(type) ?? [];
  const rows: Record<string, string>[] = [];

  if (view === "income") {
    getRowsByAccountType("Revenue").forEach((row) =>
      rows.push({
        section: t("accounting.reports.revenue"),
        code: row.code,
        account: row.name,
        amount: formatCurrency(row.totalCredit - row.totalDebit),
      }),
    );
    rows.push({
      section: "",
      code: "",
      account: t("accounting.reports.totalRevenue"),
      amount: formatCurrency(revenue),
    });
    getRowsByAccountType("Expense").forEach((row) =>
      rows.push({
        section: t("accounting.reports.expenses"),
        code: row.code,
        account: row.name,
        amount: formatCurrency(row.totalDebit - row.totalCredit),
      }),
    );
    rows.push({
      section: "",
      code: "",
      account: t("accounting.reports.totalExpenses"),
      amount: formatCurrency(expenses),
    });
    rows.push({
      section: "",
      code: "",
      account:
        netSurplus >= 0 ? t("accounting.reports.netSurplus") : t("accounting.reports.netDeficit"),
      amount: formatCurrency(Math.abs(netSurplus)),
    });
  } else if (view === "balance") {
    getRowsByAccountType("Asset").forEach((row) =>
      rows.push({
        section: t("accounting.reports.assets"),
        code: row.code,
        account: row.name,
        amount: formatCurrency(row.balance),
      }),
    );
    rows.push({
      section: "",
      code: "",
      account: t("accounting.reports.totalAssets"),
      amount: formatCurrency(assets),
    });
    getRowsByAccountType("Liability").forEach((row) =>
      rows.push({
        section: t("accounting.reports.liabilities"),
        code: row.code,
        account: row.name,
        amount: formatCurrency(row.totalCredit - row.totalDebit),
      }),
    );
    rows.push({
      section: "",
      code: "",
      account: t("accounting.reports.totalLiabilities"),
      amount: formatCurrency(liabilities),
    });
    getRowsByAccountType("Equity").forEach((row) =>
      rows.push({
        section: t("accounting.reports.equity"),
        code: row.code,
        account: row.name,
        amount: formatCurrency(row.totalCredit - row.totalDebit),
      }),
    );
    rows.push({
      section: "",
      code: "",
      account: t("accounting.reports.totalEquity"),
      amount: formatCurrency(equity),
    });
  }

  return rows;
}
