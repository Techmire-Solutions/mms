import { formatDate, type AppTranslationKey } from "@mms/shared";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useContactsReportAnalytics } from "@/tenant/hooks/collections/contacts";
import { useEnrollmentsReportAggregates } from "@/tenant/hooks/collections/enrollments";
import { useAttendanceReportAggregates } from "@/tenant/hooks/collections/attendance";
import { useFinanceReportAggregates } from "@/tenant/hooks/collections/finance";
import { useHasanatReportAggregates } from "@/tenant/hooks/collections/hasanat";
import { useExaminationsReportAggregates } from "@/tenant/hooks/collections/examinations";
import {
  buildContactsDateRangeComparison,
  computeDynamicDateRangeComparison,
  computeDynamicSessionComparison,
} from "@/components/ui/reports/comparisonModeCompute";
import type {
  ComparisonDataItem,
  DateRange,
  DateRangeDataItem,
} from "@/components/ui/reports/comparisonModeTypes";

interface UseComparisonModeDataParams {
  category: string;
  isContacts: boolean;
  mode: "sessions" | "daterange";
  valA: string;
  valB: string;
  rangeA: DateRange;
  rangeB: DateRange;
  language: string;
  t: (key: AppTranslationKey) => string;
}

export function useComparisonModeData({
  category,
  isContacts,
  mode,
  valA,
  valB,
  rangeA,
  rangeB,
  language,
  t,
}: UseComparisonModeDataParams) {
  const compareYears = (() => {
    if (!isContacts || mode !== "daterange") return undefined;
    const yearA = Number.parseInt(rangeA.from.slice(0, 4), 10);
    const yearB = Number.parseInt(rangeB.from.slice(0, 4), 10);
    return [yearA, yearB].filter((year) => Number.isFinite(year));
  })();

  const { data: reportData } = useContactsReportAnalytics({
    enabled: isContacts,
    compareYears,
    language,
  });

  const nonContactsEnabled = !isContacts;
  const categoryKey = category.toLowerCase();

  const buildComparison = (categoryMatchesDateRange: boolean) => {
    if (!nonContactsEnabled) return undefined;
    if (mode === "sessions") {
      const sessionIds = [valA, valB].filter(Boolean);
      return sessionIds.length > 0 ? { sessionIds } : undefined;
    }
    if (mode === "daterange" && categoryMatchesDateRange) {
      return {
        rangeAFrom: rangeA.from,
        rangeATo: rangeA.to,
        rangeBFrom: rangeB.from,
        rangeBTo: rangeB.to,
      };
    }
    return undefined;
  };

  const enrollmentComparison = (() =>
    buildComparison(categoryKey === "students" || categoryKey === "enrollments"))();

  const financeComparison = (() =>
    buildComparison(categoryKey === "financial" || categoryKey === "finance"))();

  const attendanceComparison = (() => buildComparison(categoryKey === "attendance"))();

  const examinationsComparison = (() => buildComparison(categoryKey === "examinations"))();

  const hasanatComparison = (() => buildComparison(categoryKey === "hasanat"))();

  const { data: enrollmentsReport } = useEnrollmentsReportAggregates({
    enabled: Boolean(enrollmentComparison),
    comparison: enrollmentComparison,
  });

  const { data: financeReport } = useFinanceReportAggregates({
    enabled: Boolean(financeComparison),
    comparison: financeComparison,
  });

  const { data: attendanceReport } = useAttendanceReportAggregates({
    enabled: Boolean(attendanceComparison),
    comparison: attendanceComparison,
  });

  const { data: hasanatReport } = useHasanatReportAggregates({
    enabled: Boolean(hasanatComparison),
    comparison: hasanatComparison,
  });

  const { data: examinationsReport } = useExaminationsReportAggregates({
    enabled: Boolean(examinationsComparison),
    comparison: examinationsComparison,
  });

  const sessions = useSessionsCollection({ enabled: nonContactsEnabled });
  const sessionsOptions = (() =>
    sessions
      .filter((session) => session.id !== "all")
      .map((session) => ({ id: session.id, name: session.name })))() as {
    id: string;
    name: string;
  }[];

  const comparisonData = (() => {
    if (mode === "sessions") {
      if (isContacts) {
        return [];
      }
      return computeDynamicSessionComparison(
        sessions,
        enrollmentsReport?.comparison?.sessions ?? [],
        attendanceReport?.comparison?.sessions ?? [],
        financeReport?.comparison?.sessions ?? [],
        hasanatReport?.comparison?.sessions ?? [],
        examinationsReport?.comparison?.sessions ?? [],
        valA,
        valB,
        t,
      );
    }
    if (isContacts) {
      return buildContactsDateRangeComparison(reportData?.monthlyByYear, rangeA, rangeB);
    }
    return computeDynamicDateRangeComparison(
      category,
      enrollmentsReport?.comparison?.monthly,
      attendanceReport?.comparison?.monthly,
      financeReport?.comparison?.monthly,
      hasanatReport?.comparison?.monthly,
      examinationsReport?.comparison?.monthly,
      rangeA,
      rangeB,
    );
  })() as ComparisonDataItem[] | DateRangeDataItem[];

  const labelA =
    mode === "sessions"
      ? sessionsOptions.find((option) => option.id === valA)?.name
      : `${formatDate(rangeA.from)} → ${formatDate(rangeA.to)}`;
  const labelB =
    mode === "sessions"
      ? sessionsOptions.find((option) => option.id === valB)?.name
      : `${formatDate(rangeB.from)} → ${formatDate(rangeB.to)}`;

  return {
    reportData,
    enrollmentsReport,
    financeReport,
    attendanceReport,
    hasanatReport,
    examinationsReport,
    sessions,
    sessionsOptions,
    comparisonData,
    labelA,
    labelB,
  };
}
