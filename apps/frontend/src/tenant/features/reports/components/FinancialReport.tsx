import React, { lazy, Suspense, useState } from "react";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useFinanceInvoicesPaginated,
  useFinanceReportAggregates,
} from "@/tenant/hooks/collections/finance";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";

const FinancialReportCharts = lazy(() =>
  import("@/components/reports/FinancialReportSections").then((mod) => ({
    default: mod.FinancialReportCharts,
  })),
);
import { ReportFilterBanner } from "@/components/reports/ReportFilterBanner";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";
import { FinancialInvoiceTable } from "@/components/reports/FinancialReportTable";
import {
  formatMonthYear,
  getCollectedAmountForInvoice,
  getOutstandingAmountForInvoice,
} from "@mms/shared";
import type {
  DiscountUsageByTypeItem,
  MonthlyFeeCollectionItem,
} from "@/components/reports/FinancialReportSections";

/** Active filter state passed down from the parent report view. */
interface FinancialReportFilters {
  /** Invoice status to filter by, or "all" for no filter. */
  status: string;
  /** Substring to match against student names (case-insensitive). */
  student: string;
}

/** Props for the FinancialReport component. */
interface FinancialReportProps {
  /** Active report filters. */
  filters: FinancialReportFilters;
  /** Optional callback to open the visualizer with an existing config. */
  onEditVisual?: (config: unknown) => void;
}

/**
 * Renders the financial reports and charts including revenue trends,
 * collection rates, discount distribution, and a filterable invoice table.
 */
const FinancialReport = function FinancialReport({
  filters,
}: FinancialReportProps): React.JSX.Element {
  const { t } = useTranslation();
  const palette = useBrandPalette();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const PIE_COLORS = (() => [
    palette.primary,
    palette.secondary,
    palette.charts[2],
    palette.charts[3],
    palette.charts[0],
  ])();

  const invoicesQuery = useFinanceInvoicesPaginated({
    page: 1,
    limit: 100,
    search: filters.student || undefined,
  });

  const aggregatesQuery = useFinanceReportAggregates();

  const financeInvoices = invoicesQuery.data?.invoices ?? [];

  const monthlyFeeCollection = (() => {
    if (
      aggregatesQuery.data?.monthlyFeeCollection &&
      aggregatesQuery.data.monthlyFeeCollection.length > 0
    ) {
      return aggregatesQuery.data.monthlyFeeCollection;
    }
    const monthlyTotals: Record<string, { collected: number; outstanding: number; total: number }> =
      {};
    financeInvoices.forEach((invoice) => {
      const dueDate = new Date(invoice.dueDate);
      if (isNaN(dueDate.getTime())) return;
      const monthLabel = formatMonthYear(dueDate);

      if (!monthlyTotals[monthLabel])
        monthlyTotals[monthLabel] = { collected: 0, outstanding: 0, total: 0 };

      const collected = getCollectedAmountForInvoice(invoice);
      const outstanding = getOutstandingAmountForInvoice(invoice);

      monthlyTotals[monthLabel].collected += collected;
      monthlyTotals[monthLabel].outstanding += outstanding;
      monthlyTotals[monthLabel].total += invoice.finalAmt;
    });

    return Object.entries(monthlyTotals)
      .map(([month, monthTotals]) => ({
        month,
        collected: monthTotals.collected,
        outstanding: monthTotals.outstanding,
        total: monthTotals.total,
        rate:
          monthTotals.total > 0 ? Math.round((monthTotals.collected / monthTotals.total) * 100) : 0,
      }))
      .sort(
        (firstMonth, secondMonth) =>
          new Date(firstMonth.month).getTime() - new Date(secondMonth.month).getTime(),
      )
      .slice(-6);
  })() as MonthlyFeeCollectionItem[];

  const discountUsageByType = (() => {
    if (
      aggregatesQuery.data?.discountUsageByType &&
      aggregatesQuery.data.discountUsageByType.length > 0
    ) {
      return aggregatesQuery.data.discountUsageByType;
    }
    const discountTotalsByType: Record<string, { count: number; totalDiscounted: number }> = {};
    let totalDiscountAmount = 0;

    financeInvoices.forEach((invoice) => {
      if (invoice.discountAmt > 0 && invoice.discountType && invoice.status !== "cancelled") {
        const discountType = invoice.discountType;
        if (!discountTotalsByType[discountType])
          discountTotalsByType[discountType] = { count: 0, totalDiscounted: 0 };
        discountTotalsByType[discountType].count++;
        discountTotalsByType[discountType].totalDiscounted += invoice.discountAmt;
        totalDiscountAmount += invoice.discountAmt;
      }
    });

    return Object.entries(discountTotalsByType).map(([discountType, discountTotals]) => ({
      type: discountType,
      count: discountTotals.count,
      totalDiscounted: discountTotals.totalDiscounted,
      percentage:
        totalDiscountAmount > 0
          ? Math.round((discountTotals.totalDiscounted / totalDiscountAmount) * 100)
          : 0,
    }));
  })() as DiscountUsageByTypeItem[];

  const invoices = (() => {
    let filteredInvoices = financeInvoices;
    if (filters.status !== "all") {
      filteredInvoices = filteredInvoices.filter((invoice) => invoice.status === filters.status);
    }
    if (selectedMonth) {
      filteredInvoices = filteredInvoices.filter((invoice) => {
        const dueDate = new Date(invoice.dueDate);
        if (isNaN(dueDate.getTime())) return false;
        return formatMonthYear(dueDate) === selectedMonth;
      });
    }
    return filteredInvoices;
  })();

  const toggleMonthFilter = (month: string) => {
    setSelectedMonth((current) => (current === month ? null : month));
  };

  if (invoicesQuery.isError || aggregatesQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("finance.loadFailed")}
          description={t("finance.loadFailedHint")}
          onRetry={() => {
            void invoicesQuery.refetch();
            void aggregatesQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <FinancialReportCharts
          monthlyFeeCollection={monthlyFeeCollection}
          discountUsageByType={discountUsageByType}
          pieColors={PIE_COLORS}
          selectedMonth={selectedMonth}
          onToggleMonthFilter={toggleMonthFilter}
        />
      </Suspense>
      <ReportFilterBanner
        filters={[
          selectedMonth
            ? {
                key: "month",
                label: t("finance.report.monthFilterLabel"),
                value: selectedMonth,
                onClear: () => setSelectedMonth(null),
                clearLabel: t("finance.report.clearMonthFilter"),
              }
            : null,
        ]}
      />
      <FinancialInvoiceTable invoices={invoices} />
      <PinnedWidgets category="finance" />
    </div>
  );
};

export default FinancialReport;
