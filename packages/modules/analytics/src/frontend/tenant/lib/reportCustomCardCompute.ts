import {
  type Contact,
  type Enrollment,
  formatMoney,
  formatNumber,
  resolveDistributionPoints,
  matchesWidgetFilter,
  type QuestionBankQuestion,
  type QuestionBankResult,
  type QuestionBankTest,
} from "@mms/contracts";
import type { Student } from "@mms/contracts";
import type { Faculty } from "@mms/contracts";
import type { Session } from "@mms/contracts";
import type { Invoice } from "@mms/contracts";
import type { AttendanceRecord } from "@mms/contracts";
import type { Distribution, Denomination } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
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

  const filteredRows = collectionRows.filter((collectionRow: any) =>
    matchesWidgetFilter(collectionRow, card.filterField, card.filterOperator, card.filterValue),
  );

  let numericValue = 0;
  if (card.operation === "sum" || card.operation === "avg") {
    const targetMetricField = card.targetField || "";
    let sum = 0;
    let count = 0;
    filteredRows.forEach((filteredRow: any) => {
      if (card.collection === "hasanat_distributions" && targetMetricField === "points") {
        sum += resolveDistributionPoints(
          {
            pointsSnapshot:
              typeof filteredRow.pointsSnapshot === "number" ? filteredRow.pointsSnapshot : null,
            denominationId:
              typeof filteredRow.denominationId === "string" ? filteredRow.denominationId : null,
            quantity: typeof filteredRow.quantity === "number" ? filteredRow.quantity : 1,
          },
          collections.hasanat_denoms,
        );
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
