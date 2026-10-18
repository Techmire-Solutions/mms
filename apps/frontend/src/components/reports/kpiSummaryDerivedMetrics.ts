import { formatNumber } from "@mms/shared";
import type {
  AttendanceCommandMetricsSnapshot,
  FinanceCommandMetricsSnapshot,
  HasanatCommandMetricsSnapshot,
  SessionsCommandMetricsSnapshot,
  ExaminationsCommandMetricsSnapshot,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ContactKPIAnalytics, EntityKPIMetrics } from "./kpiSummaryTypes";

interface DerivedKpiMetrics {
  attendanceRate: number;
  collected: number;
  outstanding: number;
  outstandingInvoiceCount: number;
  totalHasanat: number;
  passRate: number;
  capacityUsed: number;
  classesCount: number;
  growthValue: string;
  growthTrend: "up" | "down" | "flat";
  growthSub: string;
  totalStudentsValue: string;
  totalStudentsSub: string;
  totalStudentsTrend: "up" | "down" | "flat";
  totalStudentsVelocity?: string;
  attendanceTrend: "up" | "down" | "flat";
  feesTrend: "up" | "down" | "flat";
  outstandingTrend: "up" | "down" | "flat";
  hasanatTrend: "up" | "down" | "flat";
  sessionsTrend: "up" | "down" | "flat";
  hasAttendanceData: boolean;
  hasFinanceData: boolean;
  hasHasanatData: boolean;
  hasExamData: boolean;
  hasSessionsData: boolean;
}

function trendFromDelta(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function trendFromChange(current: number, previous: number): "up" | "down" | "flat" {
  if (previous > 0) {
    const delta = current - previous;
    return trendFromDelta(delta);
  }
  return current > 0 ? "up" : "flat";
}

interface ComputeDerivedKpiMetricsOptions {
  category: string;
  contactAnalytics?: ContactKPIAnalytics;
  studentMetrics?: EntityKPIMetrics;
  auxiliaryStudentMetrics?: EntityKPIMetrics;
  attendanceMetrics?: AttendanceCommandMetricsSnapshot;
  financeMetrics?: FinanceCommandMetricsSnapshot;
  hasanatMetrics?: HasanatCommandMetricsSnapshot;
  sessionsMetrics?: SessionsCommandMetricsSnapshot;
  examinationsMetrics?: ExaminationsCommandMetricsSnapshot;
  t: TranslationFunction;
}

export function computeDerivedKpiMetrics({
  category,
  contactAnalytics,
  studentMetrics,
  auxiliaryStudentMetrics,
  attendanceMetrics,
  financeMetrics,
  hasanatMetrics,
  sessionsMetrics,
  examinationsMetrics,
  t,
}: ComputeDerivedKpiMetricsOptions): DerivedKpiMetrics {
  const isStudentsCategory = category === "students";
  const needsContactAnalytics =
    category === "contacts" || category === "students" || category === "sessions";

  let totalStudentsValue = "0";
  let totalStudentsSub = t("reports.kpi.sub.noStudents");
  let totalStudentsTrend: DerivedKpiMetrics["totalStudentsTrend"] = "flat";
  let totalStudentsVelocity: string | undefined;
  if (category === "contacts" && contactAnalytics) {
    totalStudentsValue = String(contactAnalytics.total);
    totalStudentsSub = t("reports.kpi.sub.newRecentlyCount", {
      count: contactAnalytics.newLast30Days,
    });
    totalStudentsTrend =
      contactAnalytics.newLast30Days >= contactAnalytics.newPrior30Days ? "up" : "down";
    totalStudentsVelocity =
      contactAnalytics.newPrior30Days > 0
        ? `${Math.round(((contactAnalytics.newLast30Days - contactAnalytics.newPrior30Days) / contactAnalytics.newPrior30Days) * 100)}%`
        : `+${contactAnalytics.newLast30Days}`;
  } else if (category === "contacts") {
    totalStudentsSub = t("reports.kpi.sub.noContacts");
  } else {
    const metrics = isStudentsCategory ? studentMetrics : auxiliaryStudentMetrics;
    totalStudentsValue = String(metrics?.total ?? 0);
    totalStudentsSub = t("reports.kpi.sub.activeNow", { count: metrics?.active ?? 0 });
    totalStudentsTrend = (metrics?.newThisPeriod ?? 0) > 0 ? "up" : "flat";
  }

  const attendanceRate =
    attendanceMetrics?.overallPresentRate ?? attendanceMetrics?.selectedDatePresentRate ?? 0;
  const collected = financeMetrics?.collectedTotal ?? 0;
  const outstanding = financeMetrics?.outstandingBalance ?? 0;
  const outstandingInvoiceCount = financeMetrics?.outstanding ?? 0;
  const totalHasanat = hasanatMetrics?.totalPointsDistributed ?? 0;
  const passRate = examinationsMetrics?.passRate ?? 0;

  const capacity = sessionsMetrics?.totalCapacity ?? 0;
  const enrolled = sessionsMetrics?.totalEnrolled ?? 0;
  const capacityUsed = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const classesCount = sessionsMetrics?.totalClasses ?? 0;

  let growthValue = "+0%";
  let growthTrend: DerivedKpiMetrics["growthTrend"] = "flat";
  let growthSub = t("reports.kpi.sub.noSignupDates");
  if (needsContactAnalytics && contactAnalytics?.hasSignupDates) {
    const recent = contactAnalytics.growthRecentSignups30d;
    const prior = contactAnalytics.growthPriorSignups30d;
    if (prior === 0) {
      growthValue = recent > 0 ? `+${recent * 100}%` : "0%";
      growthTrend = recent > 0 ? "up" : "flat";
      growthSub = t("reports.kpi.sub.growthNewLast30d", { count: recent });
    } else {
      const percentage = Math.round(((recent - prior) / prior) * 100);
      growthValue = `${percentage >= 0 ? "+" : ""}${percentage}%`;
      growthTrend = percentage > 0 ? "up" : percentage < 0 ? "down" : "flat";
      growthSub = t("reports.kpi.sub.growthVsPrevious", { recent, prior });
    }
  }

  return {
    attendanceRate,
    collected,
    outstanding,
    outstandingInvoiceCount,
    totalHasanat,
    passRate,
    capacityUsed,
    classesCount,
    growthValue,
    growthTrend,
    growthSub,
    totalStudentsValue,
    totalStudentsSub,
    totalStudentsTrend,
    totalStudentsVelocity,
    attendanceTrend: trendFromDelta(
      (attendanceMetrics?.selectedDatePresentRate ?? 0) -
        (attendanceMetrics?.priorDatePresentRate ?? 0),
    ),
    feesTrend: trendFromChange(
      financeMetrics?.collectedThisMonth ?? 0,
      financeMetrics?.collectedPrevMonth ?? 0,
    ),
    outstandingTrend: trendFromChange(
      financeMetrics?.outstandingThisMonth ?? 0,
      financeMetrics?.outstandingPrevMonth ?? 0,
    ),
    hasanatTrend: trendFromChange(
      hasanatMetrics?.pointsThisWeek ?? 0,
      hasanatMetrics?.pointsLastWeek ?? 0,
    ),
    sessionsTrend: trendFromChange(
      sessionsMetrics?.sessionsThisWeek ?? 0,
      sessionsMetrics?.sessionsLastWeek ?? 0,
    ),
    hasAttendanceData: (attendanceMetrics?.total ?? 0) > 0,
    hasFinanceData: (financeMetrics?.totalInvoices ?? 0) > 0,
    hasHasanatData: (hasanatMetrics?.distributed ?? 0) > 0 || totalHasanat > 0,
    hasExamData:
      (examinationsMetrics?.totalResults ?? 0) > 0 && (examinationsMetrics?.total ?? 0) > 0,
    hasSessionsData: (sessionsMetrics?.total ?? 0) > 0,
  };
}

export { formatNumber };
