import type { CustomWidget } from "./pinnedWidgetTypes";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import type { Denomination } from "@/lib/data/hasanatData";
import { getDenominationPoints } from "@mms/shared";
import {
  readContactsWidgetAggregate,
  readStudentsWidgetAggregate,
  readFacultyWidgetAggregate,
  readSessionsWidgetAggregate,
  readEnrollmentsWidgetAggregate,
} from "./widgetAggregateReaders";
import { getFilteredRecords } from "./widgetCollectionSnapshot";

export interface WidgetChartDataPoint {
  name: string;
  value: number;
}

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

function computeGroupValue(
  groupRecords: Record<string, unknown>[],
  widget: CustomWidget,
  denominations: Denomination[] | undefined,
): number {
  if (widget.operation === "count") {
    return groupRecords.length;
  }

  const targetField = widget.targetField || "";
  let numericTotal = 0;
  let numericRecordCount = 0;

  for (const record of groupRecords) {
    if (widget.collection === "hasanat_distributions" && targetField === "points") {
      numericTotal += Number(record.quantity || 1) * resolveHasanatPoints(record, denominations);
      numericRecordCount++;
    } else {
      const rawValue = record[targetField];
      if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
        const numericValue = Number(rawValue);
        if (Number.isFinite(numericValue)) {
          numericTotal += numericValue;
          numericRecordCount++;
        }
      }
    }
  }

  if (widget.operation === "sum") {
    return numericTotal;
  }
  return numericRecordCount > 0 ? Math.round(numericTotal / numericRecordCount) : 0;
}

const AGGREGATE_READERS: Record<
  string,
  (widgetId: string) => { chartData?: WidgetChartDataPoint[] } | undefined
> = {
  contacts: readContactsWidgetAggregate,
  students: readStudentsWidgetAggregate,
  faculty: readFacultyWidgetAggregate,
  sessions: readSessionsWidgetAggregate,
  enrollments: readEnrollmentsWidgetAggregate,
};

export function computeWidgetChartData(
  widget: CustomWidget,
  collections: ReportCollectionsSnapshot,
): WidgetChartDataPoint[] {
  const aggregateReader = AGGREGATE_READERS[widget.collection];
  if (aggregateReader) {
    return aggregateReader(widget.id)?.chartData ?? [];
  }

  const filteredRecords = getFilteredRecords(widget, collections);
  const xAxis = widget.xAxisField || "status";

  const groups = Object.groupBy(filteredRecords, (record) => {
    const groupValue = record[xAxis];
    return groupValue === undefined || groupValue === null || groupValue === ""
      ? "Unknown"
      : String(groupValue);
  });

  const chartData: WidgetChartDataPoint[] = [];
  for (const [groupName, groupRecords] of Object.entries(groups)) {
    if (!groupRecords || groupRecords.length === 0) continue;
    chartData.push({
      name: groupName,
      value: computeGroupValue(groupRecords, widget, collections.hasanat_denoms),
    });
  }

  return chartData
    .toSorted((firstItem, secondItem) => secondItem.value - firstItem.value)
    .slice(0, 8);
}
