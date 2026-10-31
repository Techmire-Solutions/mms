import { formatMoney, formatNumber, formatPercent } from "@mms/shared";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export type CollectionMetricResolver = (
  widget: CustomWidget,
  data: DashboardData,
) => { value: string; sub?: string } | null;

/**
 * Dashboard cards read the same workspace currency as the rest of the product:
 * symbol-prefixed (`Rs 7,250`), matching the summary widgets below them. The
 * default `formatMoney` emits the ISO code (`PKR 7,250`), which made one screen
 * show two different money notations (2026-10-31 review, UX-05).
 */
const money = (value: number | string | null | undefined): string =>
  formatMoney(value, undefined, { useSymbol: true });

/** Counts and percentages use the active locale's numeral system (UX-06). */
const count = (value: number | null | undefined): string => formatNumber(value ?? 0);

function resolveQuestionBankMetric(widget: CustomWidget, data: DashboardData): { value: string } {
  const { questionBankMetrics } = data;
  if (widget.collection === "tests") return { value: count(questionBankMetrics?.totalTests) };
  if (widget.collection === "assessment_results")
    return { value: count(questionBankMetrics?.totalResults) };
  return { value: count(questionBankMetrics?.total) };
}

const COLLECTION_METRIC_RESOLVERS: Record<string, CollectionMetricResolver> = {
  contacts: (_widget, data) => ({ value: count(data.contactsTotal) }),
  students: (widget, data) => {
    if (widget.filterValue === "active") {
      return { value: count(data.studentMetricsActive) };
    }
    return { value: count(data.studentsTotal) };
  },
  faculty: (_widget, data) => ({ value: count(data.facultyTotal) }),
  sessions: (widget, data) => {
    const { sessionsMetrics } = data;
    if (widget.filterValue === "active" || widget.id.includes("sessions")) {
      return { value: count(sessionsMetrics?.active), sub: undefined };
    }
    if (widget.id.includes("classes")) {
      return { value: count(sessionsMetrics?.totalClasses) };
    }
    return { value: count(sessionsMetrics?.total) };
  },
  attendance_records: (widget, data) => {
    const { attendanceMetrics } = data;
    const rate =
      attendanceMetrics?.overallPresentRate ?? attendanceMetrics?.selectedDatePresentRate ?? 0;
    if (widget.operation === "percentage") {
      return { value: formatPercent(rate) };
    }
    return { value: count(attendanceMetrics?.total) };
  },
  finance_invoices: (widget, data) => {
    const { financeMetrics, accountingMetrics } = data;
    if (widget.id.includes("revenue") || widget.id.includes("expenses")) {
      if (widget.id.includes("revenue")) {
        return { value: money(accountingMetrics?.revenue) };
      }
      return { value: money(accountingMetrics?.expenses) };
    }
    if (widget.targetField === "paidAmt" || widget.filterValue === "paid") {
      return { value: money(financeMetrics?.collectedTotal) };
    }
    if (
      widget.targetField === "finalAmt" &&
      (widget.filterValue === "unpaid" || widget.id.includes("outstanding"))
    ) {
      return { value: money(financeMetrics?.outstandingBalance) };
    }
    if (widget.targetField === "discountAmt") {
      return { value: money(financeMetrics?.discountTotal) };
    }
    if (widget.operation === "percentage" && widget.filterValue === "paid") {
      const total = financeMetrics?.totalInvoices ?? 0;
      const paid = financeMetrics?.paid ?? 0;
      return { value: formatPercent(total > 0 ? (paid / total) * 100 : 0) };
    }
    if (widget.operation === "count") {
      return { value: count(financeMetrics?.totalInvoices) };
    }
    return { value: money(financeMetrics?.collectedTotal) };
  },
  hasanat_distributions: (_widget, data) => ({
    value: count(data.hasanatMetrics?.totalPointsDistributed),
  }),
  questions: resolveQuestionBankMetric,
  tests: resolveQuestionBankMetric,
  assessment_results: resolveQuestionBankMetric,
};

export function resolveServerMetricValue(
  widget: CustomWidget,
  data: DashboardData,
): { value: string; sub?: string } | null {
  const resolver = COLLECTION_METRIC_RESOLVERS[widget.collection];
  return resolver ? resolver(widget, data) : null;
}
