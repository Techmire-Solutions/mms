import React from "react";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { SectionLabel } from "@/components/app/SectionLabel";
import { ReportMoneyCard } from "@/components/reports/ReportMoneyCard";
import { ReportMoneyCardsGrid } from "@/components/reports/ReportMoneyCardsGrid";
import { ReportMoneySummaryTile } from "@/components/reports/ReportMoneySummaryTile";
import { balanceToneClass } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
interface CashFlowStatementPanelProps {
  netSurplus: number;
  depreciationAdjustment: number;
  receivablesChange: number;
  payablesChange: number;
  /** Indirect-method subtotal (`netCashFlowIndirect`), server-computed. */
  netCashFlowIndirect: number;
  /** Direct-method net movement on cash/bank accounts within the window. */
  netCashFlow: number;
  cashInflow: number;
  cashOutflow: number;
  viewMode?: WorkDirectoryViewMode;
}

/**
 * Cash Flow statement panel.
 *
 * The indirect subtotal (`netCashFlowIndirect`) and the actual cash movement
 * (`netCashFlow`, direct method over cash accounts) are computed independently
 * server-side, so they can legitimately disagree. Both are shown — with an
 * explicit difference line when they do — instead of presenting the indirect
 * rows as if they summed to the cash movement.
 */
export function CashFlowStatementPanel({
  netSurplus,
  depreciationAdjustment,
  receivablesChange,
  payablesChange,
  netCashFlowIndirect,
  netCashFlow,
  cashInflow,
  cashOutflow,
  viewMode: propViewMode,
}: CashFlowStatementPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const adjustments = [
    { label: t("accounting.reports.cashflow.depreciation"), amount: depreciationAdjustment },
    { label: t("accounting.reports.cashflow.receivables"), amount: receivablesChange },
    { label: t("accounting.reports.cashflow.payables"), amount: payablesChange },
  ];
  // Display-only difference of two server-computed figures.
  const reconciliationDifference = Math.abs(netCashFlowIndirect - netCashFlow);
  const hasReconciliationDifference = reconciliationDifference >= 0.01;

  return (
    <section aria-label={t("accounting.reports.views.cashflow")} className="space-y-4">
      <div>
        <header className="px-4 py-2.5 bg-info/10 border-b border-border">
          <SectionLabel as="h3" weight="bold" tracking="wide" tone="foreground" className="m-0">
            {t("accounting.reports.cashflow.title")}
          </SectionLabel>
        </header>
        {viewMode === "cards" ? (
          <ReportMoneyCardsGrid>
            <ReportMoneySummaryTile
              tone="muted"
              label={t("accounting.reports.cashflow.netSurplusOrDeficit")}
              value={formatCurrency(netSurplus)}
            />
            {adjustments.map((item) => (
              <ReportMoneyCard
                key={item.label}
                header={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                }
              />
            ))}
            <ReportMoneySummaryTile
              tone="muted"
              label={t("accounting.reports.cashflow.netCashOperations")}
              value={formatCurrency(netCashFlowIndirect)}
            />
            <ReportMoneySummaryTile
              label={t("accounting.reports.cashflow.netCashFlow")}
              value={
                <>
                  {formatCurrency(Math.abs(netCashFlow))}
                  <span
                    className={`text-xs ms-1 ${netCashFlow >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {netCashFlow >= 0
                      ? t("accounting.reports.cashflow.inflow")
                      : t("accounting.reports.cashflow.outflow")}
                  </span>
                </>
              }
            />
          </ReportMoneyCardsGrid>
        ) : (
          <WorkBatchTable
            caption={t("accounting.reports.cashflow.breakdownCaption")}
            className="[&_thead]:hidden border-t-0"
            data={[
              {
                id: "netSurplus",
                label: t("accounting.reports.cashflow.netSurplusOrDeficit"),
                amount: netSurplus,
                type: "header",
              },
              ...adjustments.map((a) => ({
                id: a.label,
                label: a.label,
                amount: a.amount,
                type: "indent",
              })),
              {
                id: "netCashOperations",
                label: t("accounting.reports.cashflow.netCashOperations"),
                amount: netCashFlowIndirect,
                type: "header",
              },
            ]}
            columns={[
              {
                id: "label",
                label: "Label",
                cellClassName: (row) =>
                  row.type === "header"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground ps-8",
                render: (row) => row.label,
              },
              {
                id: "amount",
                label: "Amount",
                variant: "currency",
                cellClassName: (row) => (row.type === "header" ? "" : "text-muted-foreground"),
                render: (row) => formatCurrency(row.amount),
              },
            ]}
            rowClassName={(row) => (row.type === "header" ? "bg-muted/10" : "")}
            footerRow={{
              cells: [
                {
                  className: "font-bold text-foreground",
                  content: t("accounting.reports.cashflow.netCashFlow"),
                },
                {
                  className: "table-amount-cell text-foreground text-base",
                  align: "end",
                  content: (
                    <>
                      {formatCurrency(Math.abs(netCashFlow))}
                      <span
                        className={`text-xs ms-1 ${netCashFlow >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {netCashFlow >= 0
                          ? t("accounting.reports.cashflow.inflow")
                          : t("accounting.reports.cashflow.outflow")}
                      </span>
                    </>
                  ),
                },
              ],
            }}
          />
        )}
      </div>

      {hasReconciliationDifference && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold",
            balanceToneClass(false),
          )}
          role="status"
        >
          {t("accounting.dashboard.difference", {
            amount: formatCurrency(reconciliationDifference),
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-border px-4 py-3 bg-success/10 text-center">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.reports.cashflow.cashInflow")}
          </h4>
          <p className="font-mono font-bold text-success text-lg mt-1 m-0">
            {formatCurrency(cashInflow)}
          </p>
        </article>
        <article className="rounded-xl border border-border px-4 py-3 bg-destructive/10 text-center">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.reports.cashflow.cashOutflow")}
          </h4>
          <p className="font-mono font-bold text-destructive text-lg mt-1 m-0">
            {formatCurrency(cashOutflow)}
          </p>
        </article>
        <article
          className={`rounded-xl border border-border px-4 py-3 text-center ${netCashFlow >= 0 ? "bg-primary/5" : "bg-destructive/10"}`}
        >
          <h4 className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.reports.cashflow.netCashFlow")}
          </h4>
          <p
            className={`font-mono font-bold text-lg mt-1 m-0 ${netCashFlow >= 0 ? "text-primary" : "text-destructive"}`}
          >
            {formatCurrency(Math.abs(netCashFlow))}
          </p>
        </article>
      </div>
    </section>
  );
}
