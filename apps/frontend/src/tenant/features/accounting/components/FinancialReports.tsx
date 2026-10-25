import React from "react";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ReportDataGridContainer } from "@/tenant/components/moduleReports";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountingDateFilterBar } from "./AccountingDateFilterBar";
import {
  BalanceSheetPanel,
  CashFlowStatementPanel,
  IncomeStatementPanel,
} from "./FinancialStatementPanels";
import { PinnedWidgets } from "@/tenant/components/reports";
import { FxReportPanel } from "./FxReportPanel";
import { useFinancialReportsModel } from "../hooks/useFinancialReportsModel";

/**
 * FinancialReports component.
 *
 * Displays Income Statement, Balance Sheet, and Cash Flow reports.
 * Powered by server-side SQL report aggregates with Query-caching.
 */
export function FinancialReports(): React.JSX.Element {
  const {
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
    refetchAggregates,
    refetchFiscalYears,
  } = useFinancialReportsModel();

  const reportViews = [
    { key: "income" as const, label: t("accounting.reports.views.income") },
    { key: "balance" as const, label: t("accounting.reports.views.balance") },
    { key: "cashflow" as const, label: t("accounting.reports.views.cashflow") },
    { key: "fx" as const, label: t("accounting.reports.views.fx") },
  ];

  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("accounting.loadFailed")}
          description={t("accounting.loadFailedHint")}
          onRetry={() => {
            void refetchAggregates();
            void refetchFiscalYears();
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <section aria-label={t("accounting.reports.aria")} className="space-y-5">
      <AccountingDateFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
        activeFiscalYear={activeFiscalYear}
        idPrefix="report"
        variant="bordered"
      />

      <div className="space-y-4">
        <SubTabBar
          tabs={reportViews}
          value={view}
          onChange={setView}
          panelIdPrefix="financial-report"
        />

        {view === "fx" ? (
          <FxReportPanel dateFrom={dateFrom} dateTo={dateTo} />
        ) : (
        <ReportDataGridContainer
          title={t("accounting.reports.export.label", { view })}
          filename={`${view}_report`}
          moduleId="accounting"
          columns={exportColumns}
          rows={exportRows}
        >
          {view === "income" && (
            <IncomeStatementPanel
              revenueRows={getRowsByAccountType("Revenue")}
              expenseRows={getRowsByAccountType("Expense")}
              revenue={metrics.revenue}
              expenses={metrics.expenses}
              netSurplus={metrics.netSurplus}
            />
          )}

          {view === "balance" && (
            <BalanceSheetPanel
              assetRows={getBalanceSheetRowsByAccountType("Asset")}
              liabilityRows={getBalanceSheetRowsByAccountType("Liability")}
              equityRows={getBalanceSheetRowsByAccountType("Equity")}
              assets={metrics.assets}
              liabilities={metrics.liabilities}
              equity={metrics.equity}
            />
          )}

          {view === "cashflow" && (
            <CashFlowStatementPanel
              netSurplus={metrics.netSurplus}
              depreciationAdjustment={metrics.cashFlowAdjustments.depreciation}
              receivablesChange={metrics.cashFlowAdjustments.receivables}
              payablesChange={metrics.cashFlowAdjustments.payables}
              netCashFlowIndirect={metrics.netCashFlowIndirect}
              netCashFlow={metrics.netCashFlow}
              cashInflow={metrics.cashInflow}
              cashOutflow={metrics.cashOutflow}
            />
          )}
        </ReportDataGridContainer>
        )}
      </div>

      <PinnedWidgets category="accounting" />
    </section>
  );
}
