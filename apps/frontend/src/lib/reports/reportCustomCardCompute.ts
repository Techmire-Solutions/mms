import {
  type Contact,
  type Enrollment,
  formatMoney,
  formatNumber,
  getDenominationPoints,
  matchesWidgetFilter,
  type QuestionBankQuestion,
  type QuestionBankResult,
  type QuestionBankTest,
} from "@mms/shared";
import type { Student } from "@/lib/data/studentsData";
import type { Faculty } from "@/lib/data/facultyData";
import type { Session } from "@/lib/data/sessionsData";
import type { Invoice } from "@/lib/data/financeData";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type { Distribution, Denomination } from "@/lib/data/hasanatData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CustomCard } from "./reportCollectionTypes";
import { calculateCustomCardDynamicTrend } from "./reportCustomCardTrend";

export function computeCustomCard(
  card: CustomCard,
  collections: {
    students: Student[];
    faculty?: Faculty[];
    sessions: Session[];
    enrollments?: Enrollment[];
    finance_invoices: Invoice[];
    attendance_records: AttendanceRecord[];
    hasanat_distributions: Distribution[];
    contacts: Contact[];
    questions: QuestionBankQuestion[];
    tests: QuestionBankTest[];
    assessment_results: QuestionBankResult[];
    hasanat_denoms?: Denomination[];
  },
  t?: TranslationFunction,
) {
  const collectionKey = card.collection;
  const collectionRows =
    ((collections as Record<string, unknown[]>)[collectionKey] as Record<string, unknown>[]) || [];

  const filteredRows = collectionRows.filter((collectionRow) =>
    matchesWidgetFilter(collectionRow, card.filterField, card.filterOperator, card.filterValue),
  );

  let numericValue = 0;
  if (card.operation === "sum" || card.operation === "avg") {
    const targetMetricField = card.targetField || "";
    let sum = 0;
    let count = 0;
    filteredRows.forEach((filteredRow) => {
      if (card.collection === "hasanat_distributions" && targetMetricField === "points") {
        const points = getDenominationPoints(
          typeof filteredRow.denominationId === "string" ? filteredRow.denominationId : null,
          typeof filteredRow.denominationName === "string" ? filteredRow.denominationName : null,
          collections.hasanat_denoms,
        );
        sum += Number(filteredRow.quantity || 1) * points;
        count++;
      } else {
        const numericFieldValue = Number(filteredRow[targetMetricField]);
        if (!isNaN(numericFieldValue)) {
          sum += numericFieldValue;
          count++;
        }
      }
    });
    numericValue = card.operation === "sum" ? sum : count > 0 ? Math.round(sum / count) : 0;
  }

  let finalValue: string | number = 0;
  if (card.operation === "count") {
    finalValue = filteredRows.length;
  } else if (card.operation === "percentage") {
    finalValue =
      collectionRows.length > 0
        ? `${Math.round((filteredRows.length / collectionRows.length) * 100)}%`
        : "0%";
  } else {
    finalValue = numericValue;
  }

  if (typeof finalValue === "number") {
    if (
      card.collection === "finance_invoices" &&
      (card.targetField === "finalAmt" ||
        card.targetField === "paidAmt" ||
        card.targetField === "baseAmt" ||
        card.targetField === "discountAmt")
    ) {
      finalValue = formatMoney(finalValue);
    } else {
      finalValue = formatNumber(finalValue);
    }
  }

  let subText = "";
  if (card.subTextType === "fixed") {
    subText = card.fixedSubText || "";
  } else {
    subText = t
      ? t("reports.widgets.matchedCountText", {
          matched: filteredRows.length,
          total: collectionRows.length,
        })
      : `${filteredRows.length} of ${collectionRows.length} matched`;
  }

  let trendValue = card.trend || 0;
  if (card.trendType === "database") {
    trendValue = calculateCustomCardDynamicTrend(
      card,
      collectionRows,
      card.collection,
      collections.hasanat_denoms,
    );
  }

  return {
    id: card.id,
    title: card.title,
    value: finalValue,
    sub: subText,
    icon: card.icon,
    color: card.color,
    trend: trendValue,
  };
}
