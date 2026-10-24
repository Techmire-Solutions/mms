import { formatMoney } from "@mms/shared";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export type CollectionMetricResolver = (
  widget: CustomWidget,
  data: DashboardData,
) => { value: string; sub?: string } | null;

function resolveQuestionBankMetric(widget: CustomWidget, data: DashboardData): { value: string } {
  const { questionBankMetrics } = data;
  if (widget.collection === "tests") return { value: String(questionBankMetrics?.totalTests ?? 0) };
  if (widget.collection === "assessment_results")
    return { value: String(questionBankMetrics?.totalResults ?? 0) };
  return { value: String(questionBankMetrics?.total ?? 0) };
}

const COLLECTION_METRIC_RESOLVERS: Record<string, CollectionMetricResolver> = {
  contacts: (_widget, data) => ({ value: String(data.contactsTotal) }),
  students: (widget, data) => {
    if (widget.filterValue === "active") {
      return { value: String(data.studentMetricsActive) };
    }
    return { value: String(data.studentsTotal) };
  },
  faculty: (_widget, data) => ({ value: String(data.facultyTotal) }),
  sessions: (widget, data) => {
    const { sessionsMetrics } = data;
    if (widget.filterValue === "active" || widget.id.includes("sessions")) {
      return { value: String(sessionsMetrics?.active ?? 0), sub: undefined };
    }
    if (widget.id.includes("classes")) {
      return { value: String(sessionsMetrics?.totalClasses ?? 0) };
    }
    return { value: String(sessionsMetrics?.total ?? 0) };
  },
  attendance_records: (widget, data) => {
    const { attendanceMetrics } = data;
    const rate =
      attendanceMetrics?.overallPresentRate ?? attendanceMetrics?.selectedDatePresentRate ?? 0;
    if (widget.operation === "percentage") {
      return { value: `${rate}%` };
    }
    return { value: String(attendanceMetrics?.total ?? 0) };
  },
  finance_invoices: (widget, data) => {
    const { financeMetrics, accountingMetrics } = data;
    if (widget.id.includes("revenue") || widget.id.includes("expenses")) {
      if (widget.id.includes("revenue")) {
        return { value: formatMoney(accountingMetrics?.revenue ?? 0) };
      }
      return { value: formatMoney(accountingMetrics?.expenses ?? 0) };
    }
    if (widget.targetField === "paidAmt" || widget.filterValue === "paid") {
      return { value: formatMoney(financeMetrics?.collectedTotal ?? 0) };
    }
    if (
      widget.targetField === "finalAmt" &&
      (widget.filterValue === "unpaid" || widget.id.includes("outstanding"))
    ) {
      return { value: formatMoney(financeMetrics?.outstandingBalance ?? 0) };
    }
    if (widget.targetField === "discountAmt") {
      return { value: formatMoney(financeMetrics?.discountTotal ?? 0) };
    }
    if (widget.operation === "percentage" && widget.filterValue === "paid") {
      const total = financeMetrics?.totalInvoices ?? 0;
      const paid = financeMetrics?.paid ?? 0;
      return { value: `${total > 0 ? Math.round((paid / total) * 100) : 0}%` };
    }
    if (widget.operation === "count") {
      return { value: String(financeMetrics?.totalInvoices ?? 0) };
    }
    return { value: formatMoney(financeMetrics?.collectedTotal ?? 0) };
  },
  hasanat_distributions: (_widget, data) => ({
    value: String(data.hasanatMetrics?.totalPointsDistributed ?? 0),
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
