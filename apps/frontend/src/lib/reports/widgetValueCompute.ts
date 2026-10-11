import type { CustomWidget } from "./pinnedWidgetTypes";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import type { Denomination } from "@/lib/data/hasanatData";
import { getDenominationPoints } from "@mms/shared";
import {
  formatGenericWidgetValue,
  readContactsTotalFromMetrics,
  readContactsWidgetAggregate,
  readStudentsTotalFromMetrics,
  readStudentsWidgetAggregate,
  readFacultyTotalFromMetrics,
  readFacultyWidgetAggregate,
  readSessionsTotalFromMetrics,
  readSessionsWidgetAggregate,
  readEnrollmentsTotalFromMetrics,
  readEnrollmentsWidgetAggregate,
} from "./widgetAggregateReaders.js";
import { getFilteredRecords } from "./widgetCollectionSnapshot.js";
import { computeWidgetChartData, type WidgetChartDataPoint } from "./widgetChartDataCompute.js";

export { computeWidgetChartData, type WidgetChartDataPoint };

export {
  computeContactsCustomCardValue,
  computeStudentsCustomCardValue,
  computeFacultyCustomCardValue,
  computeSessionsCustomCardValue,
  computeEnrollmentsCustomCardValue,
} from "./widgetCustomCardValues";

function resolveHasanatPoints(
  record: Record<string, unknown>,
  denominations: Denomination[] | undefined,
): number {
  return getDenominationPoints(
    typeof record.denominationId === "string" ? record.denominationId : null,
    typeof record.denominationName === "string" ? record.denominationName : null,
    denominations,
  );
}

export function computeWidgetSingleValue(
  widget: CustomWidget,
  collections: ReportCollectionsSnapshot,
): { value: number; formattedValue: string; isAlert: boolean; totalCount: number } {
  if (widget.collection === "contacts") {
    const aggregate = readContactsWidgetAggregate(widget.id);
    if (aggregate) {
      return formatGenericWidgetValue(widget, aggregate);
    }
    const totalCount = readContactsTotalFromMetrics();
    return {
      value: 0,
      formattedValue: widget.operation === "percentage" ? "0%" : "0",
      isAlert: false,
      totalCount,
    };
  }

  if (widget.collection === "students") {
    const aggregate = readStudentsWidgetAggregate(widget.id);
    if (aggregate) {
      return formatGenericWidgetValue(widget, aggregate);
    }
    const totalCount = readStudentsTotalFromMetrics();
    return {
      value: 0,
      formattedValue: widget.operation === "percentage" ? "0%" : "0",
      isAlert: false,
      totalCount,
    };
  }

  if (widget.collection === "faculty") {
    const aggregate = readFacultyWidgetAggregate(widget.id);
    if (aggregate) {
      return formatGenericWidgetValue(widget, aggregate);
    }
    const totalCount = readFacultyTotalFromMetrics();
    return {
      value: 0,
      formattedValue: widget.operation === "percentage" ? "0%" : "0",
      isAlert: false,
      totalCount,
    };
  }

  if (widget.collection === "sessions") {
    const aggregate = readSessionsWidgetAggregate(widget.id);
    if (aggregate) {
      return formatGenericWidgetValue(widget, aggregate);
    }
    const totalCount = readSessionsTotalFromMetrics();
    return {
      value: 0,
      formattedValue: widget.operation === "percentage" ? "0%" : "0",
      isAlert: false,
      totalCount,
    };
  }

  if (widget.collection === "enrollments") {
    const aggregate = readEnrollmentsWidgetAggregate(widget.id);
    if (aggregate) {
      return formatGenericWidgetValue(widget, aggregate);
    }
    const totalCount = readEnrollmentsTotalFromMetrics();
    return {
      value: 0,
      formattedValue: widget.operation === "percentage" ? "0%" : "0",
      isAlert: false,
      totalCount,
    };
  }

  const filteredRecords = getFilteredRecords(widget, collections);
  const totalInCollection = (collections[widget.collection] || []).length;
  let computedValue = 0;

  if (widget.operation === "count") {
    computedValue = filteredRecords.length;
  } else if (widget.operation === "percentage") {
    computedValue =
      totalInCollection > 0 ? Math.round((filteredRecords.length / totalInCollection) * 100) : 0;
  } else {
    const targetField = widget.targetField || "";
    let numericTotal = 0;
    let numericRecordCount = 0;
    filteredRecords.forEach((filteredRecord) => {
      if (widget.collection === "hasanat_distributions" && targetField === "points") {
        numericTotal +=
          Number(filteredRecord.quantity || 1) *
          resolveHasanatPoints(filteredRecord, collections.hasanat_denoms);
        numericRecordCount++;
      } else {
        const numericValue = Number(filteredRecord[targetField]);
        if (!isNaN(numericValue)) {
          numericTotal += numericValue;
          numericRecordCount++;
        }
      }
    });
    computedValue =
      widget.operation === "sum"
        ? numericTotal
        : numericRecordCount > 0
          ? Math.round(numericTotal / numericRecordCount)
          : 0;
  }

  return formatGenericWidgetValue(widget, { value: computedValue, totalCount: totalInCollection });
}
