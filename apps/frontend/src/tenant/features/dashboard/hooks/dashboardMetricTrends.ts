import { calcPercentChange, type DashboardMetricTrends } from "@mms/shared";
import type { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";

/** Percent change helper used by dashboard metric trends. */
export const percentChange = calcPercentChange;

export type { DashboardMetricTrends };

type DashboardData = ReturnType<typeof useDashboardData>;

function computeGrowthTrend(total: number, newCount: number): number {
  if (!total || !newCount) return 0;
  return percentChange(total, Math.max(0, total - newCount));
}

/** Live trends from server `/metrics` snapshots — no full collection dumps. */
export function computeDashboardMetricTrends(data: DashboardData): DashboardMetricTrends {
  const {
    studentsTotal,
    studentMetricsNew,
    facultyTotal,
    facultyMetricsNew,
    contactsTotal,
    contactMetricsNew,
    attendanceMetrics,
    financeMetrics,
    hasanatMetrics,
    sessionsMetrics,
  } = data;

  const studentTrend = computeGrowthTrend(studentsTotal, studentMetricsNew);
  const facultyTrend = computeGrowthTrend(facultyTotal, facultyMetricsNew);
  const contactTrend = computeGrowthTrend(contactsTotal, contactMetricsNew);

  const attendanceTrend =
    (attendanceMetrics?.selectedDatePresentRate ?? 0) -
    (attendanceMetrics?.priorDatePresentRate ?? 0);

  const feesTrend = percentChange(
    financeMetrics?.collectedThisMonth ?? 0,
    financeMetrics?.collectedPrevMonth ?? 0,
  );
  const outstandingTrend = percentChange(
    financeMetrics?.outstandingThisMonth ?? 0,
    financeMetrics?.outstandingPrevMonth ?? 0,
  );
  const hasanatTrend = percentChange(
    hasanatMetrics?.pointsThisWeek ?? 0,
    hasanatMetrics?.pointsLastWeek ?? 0,
  );
  const sessionsTrend = percentChange(
    sessionsMetrics?.sessionsThisWeek ?? 0,
    sessionsMetrics?.sessionsLastWeek ?? 0,
  );

  return {
    studentTrend,
    facultyTrend,
    contactTrend,
    attendanceTrend,
    feesTrend,
    outstandingTrend,
    hasanatTrend,
    sessionsTrend,
  };
}
