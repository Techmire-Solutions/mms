import { useCallback, useEffect, useState } from "react";
import type { FiscalYear } from "@mms/shared";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useAccountingFiscalYearsPaginated,
  useAccountingReportAggregates,
} from "../hooks/useAccountingApi";
import {
  buildFinancialReportExportRows,
  getFinancialReportExportColumns,
  type TrialBalanceRow,
} from "./financialReportsExportHelpers";

export type FinancialReportViewType = "income" | "balance" | "cashflow";

export function useFinancialReportsModel() {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();

  const fiscalYearsResult = useAccountingFiscalYearsPaginated({ page: 1, limit: 100 });
  const fiscalYears: FiscalYear[] =
    fiscalYearsResult.data?.status === 200 ? fiscalYearsResult.data.body.fiscalYears : [];

  const [view, setView] = useState<FinancialReportViewType>("income");
  const activeFiscalYear = fiscalYears.find((fy) => fy.status === "active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasUserSetRange, setHasUserSetRange] = useState(false);

  useEffect(() => {
    if (hasUserSetRange || !activeFiscalYear) return;
    const { startDate, endDate } = activeFiscalYear;
    setDateFrom((prev) => (prev === startDate ? prev : startDate));
    setDateTo((prev) => (prev === endDate ? prev : endDate));
  }, [activeFiscalYear, hasUserSetRange]);

  const handleDateFromChange = useCallback((value: string) => {
    setHasUserSetRange(true);
    setDateFrom(value);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setHasUserSetRange(true);
    setDateTo(value);
  }, []);

  const aggregatesResult = useAccountingReportAggregates({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const isError = aggregatesResult.isError || fiscalYearsResult.isError;
  const isLoading = aggregatesResult.isLoading || fiscalYearsResult.isLoading;

  const agg = aggregatesResult.data;
  const metrics = agg
    ? {
        revenue: agg.revenue,
        expenses: agg.expenses,
        netSurplus: agg.netSurplus,
        assets: agg.assets,
        liabilities: agg.liabilities,
        equity: agg.equity,
        netCashFlow: agg.netCashFlow,
        netCashFlowIndirect: agg.netCashFlowIndirect,
        cashInflow: agg.cashInflow,
        cashOutflow: agg.cashOutflow,
        tb: (agg.incomeStatementTrialBalance ?? agg.trialBalance) as TrialBalanceRow[],
        balanceSheetTb: agg.balanceSheetTrialBalance as TrialBalanceRow[],
        cashFlowAdjustments: agg.cashFlowAdjustments,
      }
    : {
        revenue: 0,
        expenses: 0,
        netSurplus: 0,
        assets: 0,
        liabilities: 0,
        equity: 0,
        netCashFlow: 0,
        netCashFlowIndirect: 0,
        cashInflow: 0,
        cashOutflow: 0,
        tb: [] as TrialBalanceRow[],
        balanceSheetTb: [] as TrialBalanceRow[],
        cashFlowAdjustments: { depreciation: 0, receivables: 0, payables: 0 },
      };

  const getRowsByAccountType = (type: string) =>
    metrics.tb.filter((trialBalanceRow) => trialBalanceRow.type === type);
  const getBalanceSheetRowsByAccountType = (type: string) =>
    metrics.balanceSheetTb.filter((trialBalanceRow) => trialBalanceRow.type === type);

  const depreciationAdjustment = metrics.cashFlowAdjustments.depreciation;
  const receivablesChange = metrics.cashFlowAdjustments.receivables;
  const payablesChange = metrics.cashFlowAdjustments.payables;

  const exportColumns = getFinancialReportExportColumns(t);
  const exportRows = buildFinancialReportExportRows({
    view,
    tb: metrics.tb,
    balanceSheetTb: metrics.balanceSheetTb,
    revenue: metrics.revenue,
    expenses: metrics.expenses,
    netSurplus: metrics.netSurplus,
    assets: metrics.assets,
    liabilities: metrics.liabilities,
    equity: metrics.equity,
    depreciationAdjustment,
    receivablesChange,
    payablesChange,
    netCashFlowIndirect: metrics.netCashFlowIndirect,
    netCashFlow: metrics.netCashFlow,
    cashInflow: metrics.cashInflow,
    cashOutflow: metrics.cashOutflow,
    formatCurrency,
    t,
  });

  return {
    t,
    view,
    setView,
    dateFrom,
    dateTo,
    handleDateFromChange,
    handleDateToChange,
    isLoading,
    isError,
    metrics,
    getRowsByAccountType,
    getBalanceSheetRowsByAccountType,
    exportColumns,
    exportRows,
    activeFiscalYear,
    refetchAggregates: aggregatesResult.refetch,
    refetchFiscalYears: fiscalYearsResult.refetch,
  };
}
