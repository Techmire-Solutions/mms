import { formatMoney, formatNumber, formatPercent } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { CustomWidget } from "@mms/mod-analytics/frontend/tenant/lib/pinnedWidgetTypes";
import type { useDashboardData } from "./useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export interface MetricResolverOptions {
  formatCurrency?: (amount: number | string | null | undefined) => string;
  t?: TranslationFunction;
}

export type CollectionMetricResolver = (
  widget: CustomWidget,
  data: DashboardData,
  options?: MetricResolverOptions,
) => { value: string; sub?: string } | null;

/**
 * Fallback currency formatter when a caller does not inject `useFinanceCurrency()`.
 * Keeps symbol-prefixed output consistent with summary widgets.
 */
const defaultMoney = (value: number | string | null | undefined): string =>
  formatMoney(value, undefined, { useSymbol: true });

/** Counts and percentages use the active locale's numeral system (UX-06). */
const count = (value: number | null | undefined): string => formatNumber(value ?? 0);

/**
 * A resolver returns `null` when its source snapshot is absent. Rendering an
 * authoritative `0` for a failed, filtered, or still-loading section misreports
 * the workspace, so the card surfaces "unavailable" instead.
 */
function resolveQuestionBankMetric(
  widget: CustomWidget,
  data: DashboardData,
): { value: string } | null {
  const { questionBankMetrics } = data;
  if (!questionBankMetrics) return null;
  if (widget.collection === "tests") return { value: count(questionBankMetrics.totalTests) };
  if (widget.collection === "assessment_results")
    return { value: count(questionBankMetrics.totalResults) };
  return { value: count(questionBankMetrics.total) };
}

const COLLECTION_METRIC_RESOLVERS: Record<string, CollectionMetricResolver> = {
  contacts: (_widget, data) => (data.contactMetrics ? { value: count(data.contactsTotal) } : null),
  students: (widget, data, options) => {
    if (!data.studentMetrics) return null;
    if (widget.filterValue === "active") {
      return { value: count(data.studentMetricsActive) };
    }
    const showActiveBreakdown =
      widget.id === "def-card-admin-students" &&
      typeof data.studentMetrics.active === "number" &&
      data.studentMetrics.active !== data.studentsTotal &&
      options?.t;
    return {
      value: count(data.studentsTotal),
      ...(showActiveBreakdown
        ? {
            sub: options.t!("widget.subtitle.activeStudentsCount", {
              active: count(data.studentMetricsActive),
              total: count(data.studentsTotal),
            }),
          }
        : {}),
    };
  },
  faculty: (_widget, data) => (data.facultyMetrics ? { value: count(data.facultyTotal) } : null),
  sessions: (widget, data) => {
    const { sessionsMetrics } = data;
    if (!sessionsMetrics) return null;
    if (widget.filterValue === "active" || widget.id.includes("sessions")) {
      return { value: count(sessionsMetrics.active), sub: undefined };
    }
    if (widget.id.includes("classes")) {
      return { value: count(sessionsMetrics.totalClasses) };
    }
    return { value: count(sessionsMetrics.total) };
  },
  attendance_records: (widget, data, options) => {
    const { attendanceMetrics } = data;
    if (!attendanceMetrics) return null;
    const isTodayCard = widget.id === "def-card-admin-attendance";
    const hasTodayBreakdown =
      typeof attendanceMetrics.selectedDatePresent === "number" &&
      typeof attendanceMetrics.selectedDateAbsent === "number" &&
      typeof attendanceMetrics.selectedDateLate === "number" &&
      typeof attendanceMetrics.selectedDateExcused === "number";
    if (isTodayCard && widget.operation === "percentage" && hasTodayBreakdown) {
      const todayCount =
        attendanceMetrics.selectedDatePresent +
        attendanceMetrics.selectedDateAbsent +
        attendanceMetrics.selectedDateLate +
        attendanceMetrics.selectedDateExcused;
      if (todayCount === 0) {
        return {
          value: "—",
          sub: options?.t?.("dashboard.widgets.noAttendanceRecorded"),
        };
      }
      return { value: formatPercent(attendanceMetrics.selectedDatePresentRate) };
    }
    const rate = attendanceMetrics.overallPresentRate ?? attendanceMetrics.selectedDatePresentRate;
    if (rate === undefined) return null;
    if (widget.operation === "percentage") {
      return { value: formatPercent(rate) };
    }
    return { value: count(attendanceMetrics.total) };
  },
  finance_invoices: (widget, data, options) => {
    const money = options?.formatCurrency ?? defaultMoney;
    const { financeMetrics, accountingMetrics } = data;
    if (widget.id.includes("revenue") || widget.id.includes("expenses")) {
      if (!accountingMetrics) return null;
      if (widget.id.includes("revenue")) {
        return { value: money(accountingMetrics.revenue) };
      }
      return { value: money(accountingMetrics.expenses) };
    }
    if (!financeMetrics) return null;
    if (widget.targetField === "paidAmt" || widget.filterValue === "paid") {
      return { value: money(financeMetrics.collectedTotal) };
    }
    if (
      widget.targetField === "finalAmt" &&
      (widget.filterValue === "unpaid" || widget.id.includes("outstanding"))
    ) {
      return { value: money(financeMetrics.outstandingBalance) };
    }
    if (widget.targetField === "discountAmt") {
      return { value: money(financeMetrics.discountTotal) };
    }
    if (widget.operation === "percentage" && widget.filterValue === "paid") {
      const total = financeMetrics.totalInvoices ?? 0;
      const paid = financeMetrics.paid ?? 0;
      return { value: formatPercent(total > 0 ? (paid / total) * 100 : 0) };
    }
    if (widget.operation === "count") {
      return { value: count(financeMetrics.totalInvoices) };
    }
    return { value: money(financeMetrics.collectedTotal) };
  },
  hasanat_distributions: (_widget, data) =>
    data.hasanatMetrics ? { value: count(data.hasanatMetrics.totalPointsDistributed) } : null,
  questions: resolveQuestionBankMetric,
  tests: resolveQuestionBankMetric,
  assessment_results: resolveQuestionBankMetric,
};

export function resolveServerMetricValue(
  widget: CustomWidget,
  data: DashboardData,
  options?: MetricResolverOptions,
): { value: string; sub?: string } | null {
  const resolver = COLLECTION_METRIC_RESOLVERS[widget.collection];
  return resolver ? resolver(widget, data, options) : null;
}
