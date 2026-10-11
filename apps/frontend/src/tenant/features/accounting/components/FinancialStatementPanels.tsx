import React from "react";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { balanceToneClass } from "@/lib/semanticTone";
import { ReportSection, type ReportRow } from "./FinancialReportSection";
import { CashFlowStatementPanel } from "./CashFlowStatementPanel";

interface IncomeStatementPanelProps {
  revenueRows: ReportRow[];
  expenseRows: ReportRow[];
  revenue: number;
  expenses: number;
  netSurplus: number;
}

export function IncomeStatementPanel({
  revenueRows,
  expenseRows,
  revenue,
  expenses,
  netSurplus,
}: IncomeStatementPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();

  return (
    <section aria-label={t("accounting.reports.views.income")} className="space-y-4">
      <ReportSection
        title={t("accounting.reports.revenue")}
        rows={revenueRows}
        totalLabel={t("accounting.reports.totalRevenue")}
        total={revenue}
        debitNormal={false}
        color="bg-success/10"
      />
      <ReportSection
        title={t("accounting.reports.expenses")}
        rows={expenseRows}
        totalLabel={t("accounting.reports.totalExpenses")}
        total={expenses}
        debitNormal
        color="bg-destructive/10"
      />
      <div
        className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 font-bold text-lg ${netSurplus >= 0 ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
      >
        <span>
          {netSurplus >= 0
            ? `📈 ${t("accounting.reports.netSurplus")}`
            : `📉 ${t("accounting.reports.netDeficit")}`}
        </span>
        <span className="font-mono">{formatCurrency(Math.abs(netSurplus))}</span>
      </div>
    </section>
  );
}

interface BalanceSheetPanelProps {
  assetRows: ReportRow[];
  liabilityRows: ReportRow[];
  equityRows: ReportRow[];
  assets: number;
  liabilities: number;
  /** Cumulative (as-of `dateTo`) equity — the server figure, incl. unclosed P&L. */
  equity: number;
}

export function BalanceSheetPanel({
  assetRows,
  liabilityRows,
  equityRows,
  assets,
  liabilities,
  equity,
}: BalanceSheetPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const balanceDifference = Math.abs(assets - (liabilities + equity));

  return (
    <section aria-label={t("accounting.reports.views.balance")} className="space-y-4">
      <ReportSection
        title={t("accounting.reports.assets")}
        rows={assetRows}
        totalLabel={t("accounting.reports.totalAssets")}
        total={assets}
        debitNormal
        color="bg-info/10"
      />
      <ReportSection
        title={t("accounting.reports.liabilities")}
        rows={liabilityRows}
        totalLabel={t("accounting.reports.totalLiabilities")}
        total={liabilities}
        debitNormal={false}
        color="bg-destructive/10"
      />
      <ReportSection
        title={t("accounting.reports.equity")}
        rows={equityRows}
        totalLabel={t("accounting.reports.totalEquity")}
        total={equity}
        debitNormal={false}
        color="bg-primary/10"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <article className="px-5 py-3 rounded-xl border border-border bg-info/10 text-end">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.reports.totalAssets")}
          </h4>
          <p className="font-mono font-bold text-info text-lg m-0">{formatCurrency(assets)}</p>
        </article>
        <article className="px-5 py-3 rounded-xl border border-border bg-primary/10 text-end">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.reports.liabilitiesAndEquity")}
          </h4>
          <p className="font-mono font-bold text-primary text-lg m-0">
            {formatCurrency(liabilities + equity)}
          </p>
        </article>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold",
          balanceToneClass(balanceDifference < 1),
        )}
        role="status"
      >
        {balanceDifference < 1
          ? t("accounting.reports.balanceSheetBalanced")
          : t("accounting.reports.balanceSheetDifference", {
              diff: formatCurrency(balanceDifference),
            })}
      </div>
    </section>
  );
}

export { CashFlowStatementPanel };
