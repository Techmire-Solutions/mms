import type { AppTranslationKey } from "@mms/shared";

export interface BuildCashflowExportRowsOptions {
  netSurplus: number;
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

const RECONCILIATION_TOLERANCE = 0.01;

export function buildCashflowExportRows({
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
}: BuildCashflowExportRowsOptions): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const section = t("accounting.reports.views.cashflow");

  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.netSurplusOrDeficit"),
    amount: formatCurrency(netSurplus),
  });
  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.depreciation"),
    amount: formatCurrency(depreciationAdjustment),
  });
  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.receivables"),
    amount: formatCurrency(receivablesChange),
  });
  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.payables"),
    amount: formatCurrency(payablesChange),
  });
  rows.push({
    section: "",
    code: "",
    account: t("accounting.reports.cashflow.netCashOperations"),
    amount: formatCurrency(netCashFlowIndirect),
  });
  rows.push({
    section: "",
    code: "",
    account: t("accounting.reports.cashflow.netCashFlow"),
    amount: formatCurrency(netCashFlow),
  });

  const reconciliationDifference = Math.abs(netCashFlowIndirect - netCashFlow);
  if (reconciliationDifference >= RECONCILIATION_TOLERANCE) {
    rows.push({
      section: "",
      code: "",
      account: t("accounting.dashboard.difference", {
        amount: formatCurrency(reconciliationDifference),
      }),
      amount: formatCurrency(reconciliationDifference),
    });
  }

  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.cashInflow"),
    amount: formatCurrency(cashInflow),
  });
  rows.push({
    section,
    code: "",
    account: t("accounting.reports.cashflow.cashOutflow"),
    amount: formatCurrency(cashOutflow),
  });

  return rows;
}
