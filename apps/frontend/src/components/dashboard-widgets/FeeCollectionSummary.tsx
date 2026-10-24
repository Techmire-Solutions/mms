import React from "react";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetCardHeader } from "@/components/app/WidgetCardHeader";
import { ProgressBar } from "@/components/app/ProgressBar";
import { LegendChip } from "@/components/app/LegendChip";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useFinanceInvoicesPaginated } from "@/tenant/hooks/collections/finance";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatMonthYear,
  formatMonthName,
  getCollectedAmountForMonth,
  getOutstandingAmountForMonth,
  FINANCE_MODULE_MANIFEST,
} from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { percentChange } from "@/tenant/hooks/collections/dashboard";

/**
 * FeeCollectionSummary Component
 *
 * Displays a summary of fee collections for the current month, including
 * a breakdown by class and overall target vs collected metrics.
 *
 * @returns {React.ReactElement} The fee collection summary widget.
 */
export default function FeeCollectionSummary({ title }: { title?: string }) {
  const { t } = useTranslation();
  const invoicesData = useFinanceInvoicesPaginated({
    page: 1,
    limit: FINANCE_MODULE_MANIFEST.maxPageSize,
  }).data?.invoices;
  const invoices = React.useMemo(() => invoicesData ?? [], [invoicesData]);
  const { formatCurrency } = useFinanceCurrency();

  const {
    totalCollected,
    collectedPct,
    outstandingPct,
    breakdown,
    byClass,
    displayDate,
    comparisonMonthName,
    displayTrendPct,
    isPositiveTrend,
  } = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    // Calculate overall metrics for current month
    const collected = getCollectedAmountForMonth(invoices, currentYear, currentMonth);
    const outstanding = getOutstandingAmountForMonth(invoices, currentYear, currentMonth);

    const target = collected + outstanding;
    const colPct = target > 0 ? Math.round((collected / target) * 100) : 0;
    const outPct = target > 0 ? 100 - colPct : 0;

    const bDown = [
      {
        label: t("finance.report.collected"),
        value: collected,
        total: target,
        color: "bg-success",
        pct: colPct,
      },
      {
        label: t("finance.report.outstanding"),
        value: outstanding,
        total: target,
        color: "bg-destructive",
        pct: outPct,
      },
    ];

    // Group by Class for current month
    const map: Record<string, { name: string; collected: number; target: number }> = {};
    invoices.forEach((inv) => {
      if (!inv || inv.status === "cancelled") return;
      const dateStr = inv.paidDate || inv.dueDate || "";
      if (!dateStr) return;
      const invYear = Number(dateStr.slice(0, 4));
      const invMonth = Number(dateStr.slice(5, 7)) - 1;

      if (invYear === currentYear && invMonth === currentMonth) {
        const className = inv.class || t("common.other");
        if (!map[className]) {
          map[className] = { name: className, collected: 0, target: 0 };
        }
        map[className].target += inv.finalAmt;
        if (inv.status === "paid") {
          map[className].collected += inv.finalAmt;
        } else if (inv.status === "partial") {
          map[className].collected += inv.paidAmt || 0;
        }
      }
    });

    const prevCol = getCollectedAmountForMonth(invoices, prevYear, prevMonth);
    const chgPct = percentChange(collected, prevCol);

    return {
      totalCollected: collected,
      totalOutstanding: outstanding,
      totalTarget: target,
      collectedPct: colPct,
      outstandingPct: outPct,
      breakdown: bDown,
      byClass: Object.values(map),
      displayDate: formatMonthYear(now, "long"),
      comparisonMonthName: formatMonthName(prevMonthDate),
      displayTrendPct: Math.abs(chgPct),
      isPositiveTrend: chgPct >= 0,
    };
  }, [invoices, t]);

  return (
    <WidgetCard ariaLabelledby="fee-collection-heading" accentColor="primary">
      <WidgetCardHeader
        variant="tinted"
        headingId="fee-collection-heading"
        title={title || t("dashboard.widgets.feeCollectionSummary")}
        subtitle={displayDate}
        actions={
          <div className="text-end shrink-0">
            <p className="text-base font-black text-foreground m-0 tabular-nums">
              {formatCurrency(totalCollected)}
            </p>
            <div
              className={`flex items-center gap-1 justify-end mt-0.5 ${isPositiveTrend ? "text-success" : "text-destructive"}`}
            >
              {isPositiveTrend ? (
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="text-xs font-bold">
                {t("dashboard.widgets.comparisonTrend", {
                  value: displayTrendPct,
                  month: comparisonMonthName,
                })}
              </span>
            </div>
          </div>
        }
      />

      <section className="p-5 space-y-4">
        {/* Stacked progress bar */}
        <div
          className="h-3 rounded-full overflow-hidden bg-muted flex mb-4.5 shadow-inner"
          aria-hidden="true"
        >
          <div
            className="bg-success h-full transition-all duration-700 ease-out"
            style={{ width: `${collectedPct}%` }}
          />
          <div
            className="bg-destructive h-full transition-all duration-700 ease-out"
            style={{ width: `${outstandingPct}%` }}
          />
        </div>
        <div
          className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 select-none"
          aria-label={t("dashboard.widgets.feeSplitAria", {
            collected: collectedPct,
            outstanding: outstandingPct,
          })}
        >
          {breakdown.map((b) => (
            <LegendChip
              key={b.label}
              dotClassName={b.color}
              label={b.label}
              labelClassName="text-muted-foreground font-medium"
              value={`${b.pct}%`}
            />
          ))}
        </div>

        {/* By-class breakdown */}
        <div className="space-y-4">
          {byClass.map((classSummary) => {
            const pct =
              classSummary.target > 0
                ? Math.round((classSummary.collected / classSummary.target) * 100)
                : 0;
            return (
              <article key={classSummary.name} className="space-y-1.5">
                <header className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-foreground font-semibold">
                    {classSummary.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground font-medium tabular-nums">
                    {formatCurrency(classSummary.collected)} / {formatCurrency(classSummary.target)}
                  </span>
                </header>
                <ProgressBar
                  value={pct}
                  size="md"
                  fillClassName={`${
                    pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-destructive"
                  } duration-700 ease-out`}
                  aria-label={t("dashboard.widgets.classCollectionAria", {
                    name: classSummary.name,
                    pct,
                  })}
                />
              </article>
            );
          })}
        </div>
      </section>
    </WidgetCard>
  );
}
