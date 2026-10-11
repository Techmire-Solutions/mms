import { getDenominationPoints, matchesWidgetFilter, type Denomination } from "@mms/shared";
import type { CustomCard } from "./reportCollectionTypes.js";

/** Compares the current 30-day window to the preceding 30 days for a custom card trend. */
export function calculateCustomCardDynamicTrend(
  card: CustomCard,
  collectionRows: Record<string, unknown>[],
  collectionName: string,
  denoms?: Denomination[],
): number {
  const dateField = {
    students: "registeredDate",
    faculty: "joinDate",
    sessions: "startDate",
    enrollments: "enrolledDate",
    finance_invoices: "dueDate",
    attendance_records: "date",
    hasanat_distributions: "issuedDate",
    contacts: "createdAt",
    questions: "",
    tests: "createdAt",
    assessment_results: "submittedAt",
  }[collectionName];

  if (!dateField || collectionRows.length === 0) return 0;

  let maxTime = 0;
  collectionRows.forEach((collectionRow) => {
    const dateValue = collectionRow[dateField];
    if (dateValue) {
      const time = new Date(String(dateValue)).getTime();
      if (!isNaN(time) && time > maxTime) {
        maxTime = time;
      }
    }
  });

  if (maxTime === 0) return 0;

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const pivotTime = maxTime - thirtyDays;
  const startTime = maxTime - 2 * thirtyDays;

  const computePeriodValue = (periodRows: Record<string, unknown>[]) => {
    const filteredRows = periodRows.filter((periodRow) =>
      matchesWidgetFilter(periodRow, card.filterField, card.filterOperator, card.filterValue),
    );

    if (card.operation === "count") {
      return filteredRows.length;
    }

    if (card.operation === "percentage") {
      return periodRows.length > 0 ? (filteredRows.length / periodRows.length) * 100 : 0;
    }

    const targetMetricField = card.targetField || "";
    let sum = 0;
    let count = 0;
    filteredRows.forEach((filteredRow) => {
      if (card.collection === "hasanat_distributions" && targetMetricField === "points") {
        const points = getDenominationPoints(
          typeof filteredRow.denominationId === "string" ? filteredRow.denominationId : null,
          typeof filteredRow.denominationName === "string" ? filteredRow.denominationName : null,
          denoms,
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

    return card.operation === "sum" ? sum : count > 0 ? sum / count : 0;
  };

  const currentItems: Record<string, unknown>[] = [];
  const previousItems: Record<string, unknown>[] = [];

  collectionRows.forEach((collectionRow) => {
    const dateValue = collectionRow[dateField];
    if (dateValue) {
      const time = new Date(String(dateValue)).getTime();
      if (!isNaN(time)) {
        if (time >= pivotTime && time <= maxTime) {
          currentItems.push(collectionRow);
        } else if (time >= startTime && time < pivotTime) {
          previousItems.push(collectionRow);
        }
      }
    }
  });

  const currentValue = computePeriodValue(currentItems);
  const previousValue = computePeriodValue(previousItems);

  if (currentValue === 0 && previousValue === 0) return 0;
  if (previousValue === 0) return 100;

  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}
