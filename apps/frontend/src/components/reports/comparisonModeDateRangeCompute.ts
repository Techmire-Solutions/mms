import type {
  AttendanceReportComparison,
  EnrollmentsReportComparison,
  ExaminationsReportComparison,
  FinanceReportComparison,
  HasanatReportComparison,
} from "@mms/shared";

import { COMPARISON_MONTH_NAMES, getComparisonMonthIndex } from "./comparisonModeDateHelpers";
import type { DateRange, DateRangeDataItem } from "./comparisonModeTypes";

export function computeDynamicDateRangeComparison(
  category: string,
  enrollmentMonthly: EnrollmentsReportComparison["monthly"] | undefined,
  attendanceMonthly: AttendanceReportComparison["monthly"] | undefined,
  financeMonthly: FinanceReportComparison["monthly"] | undefined,
  hasanatMonthly: HasanatReportComparison["monthly"] | undefined,
  examinationsMonthly: ExaminationsReportComparison["monthly"] | undefined,
  rangeA: DateRange,
  _rangeB: DateRange,
): DateRangeDataItem[] {
  const bucketA = new Array<number>(12).fill(0);
  const bucketB = new Array<number>(12).fill(0);
  const countA = new Array<number>(12).fill(0);
  const countB = new Array<number>(12).fill(0);

  const lowerCat = category.toLowerCase();

  if (lowerCat === "financial") {
    for (const monthBucket of financeMonthly?.a ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketA[monthIndex] += monthBucket.collected;
    }
    for (const monthBucket of financeMonthly?.b ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketB[monthIndex] += monthBucket.collected;
    }
  } else if (lowerCat === "attendance") {
    for (const monthBucket of attendanceMonthly?.a ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) {
        bucketA[monthIndex] += monthBucket.presentCount;
        countA[monthIndex] += monthBucket.total;
      }
    }
    for (const monthBucket of attendanceMonthly?.b ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) {
        bucketB[monthIndex] += monthBucket.presentCount;
        countB[monthIndex] += monthBucket.total;
      }
    }
  } else if (lowerCat === "hasanat") {
    for (const monthBucket of hasanatMonthly?.a ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketA[monthIndex] += monthBucket.points;
    }
    for (const monthBucket of hasanatMonthly?.b ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketB[monthIndex] += monthBucket.points;
    }
  } else if (lowerCat === "students" || lowerCat === "enrollments") {
    for (const monthBucket of enrollmentMonthly?.a ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketA[monthIndex] += monthBucket.count;
    }
    for (const monthBucket of enrollmentMonthly?.b ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) bucketB[monthIndex] += monthBucket.count;
    }
  } else if (lowerCat === "examinations") {
    for (const monthBucket of examinationsMonthly?.a ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) {
        bucketA[monthIndex] += monthBucket.passCount;
        countA[monthIndex] += monthBucket.totalCount;
      }
    }
    for (const monthBucket of examinationsMonthly?.b ?? []) {
      const monthIndex = getComparisonMonthIndex(`${monthBucket.monthKey}-01`);
      if (monthIndex >= 0) {
        bucketB[monthIndex] += monthBucket.passCount;
        countB[monthIndex] += monthBucket.totalCount;
      }
    }
  } else {
    return [];
  }

  const dateRangeData: DateRangeDataItem[] = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const hasData =
      countA[monthIndex] > 0 ||
      countB[monthIndex] > 0 ||
      bucketA[monthIndex] > 0 ||
      bucketB[monthIndex] > 0;
    if (hasData) {
      let valueA = bucketA[monthIndex];
      let valueB = bucketB[monthIndex];

      if (lowerCat === "attendance" || lowerCat === "examinations") {
        valueA =
          countA[monthIndex] > 0 ? Math.round((bucketA[monthIndex] / countA[monthIndex]) * 100) : 0;
        valueB =
          countB[monthIndex] > 0 ? Math.round((bucketB[monthIndex] / countB[monthIndex]) * 100) : 0;
      }

      dateRangeData.push({
        month: COMPARISON_MONTH_NAMES[monthIndex],
        a: valueA,
        b: valueB,
      });
    }
  }

  if (dateRangeData.length === 0) {
    const startMonth = getComparisonMonthIndex(rangeA.from);
    const endMonth = getComparisonMonthIndex(rangeA.to);
    const startIndex = startMonth >= 0 ? startMonth : 0;
    const endIndex = endMonth >= 0 ? endMonth : 2;
    for (let monthIndex = startIndex; monthIndex <= endIndex; monthIndex++) {
      dateRangeData.push({ month: COMPARISON_MONTH_NAMES[monthIndex], a: 0, b: 0 });
    }
  }

  return dateRangeData;
}

export function buildContactsDateRangeComparison(
  monthlyByYear: Array<{ year: number; months: { month: string; count: number }[] }> | undefined,
  rangeA: DateRange,
  rangeB: DateRange,
): DateRangeDataItem[] {
  const yearA = rangeA.from.slice(0, 4);
  const yearB = rangeB.from.slice(0, 4);
  const seriesA =
    monthlyByYear?.find((monthlySeries) => String(monthlySeries.year) === yearA)?.months ?? [];
  const seriesB =
    monthlyByYear?.find((monthlySeries) => String(monthlySeries.year) === yearB)?.months ?? [];
  return seriesA.map((monthBucket, index) => ({
    month: monthBucket.month,
    a: monthBucket.count,
    b: seriesB[index]?.count ?? 0,
  }));
}
