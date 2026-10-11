import { matchesWidgetFilter } from "./utils.js";
import type { WidgetQuery, WidgetAggregateResult } from "./widgetAggregateTypes.js";

export type EnrollmentsWidgetOperation = "count" | "sum" | "avg" | "percentage";
export type EnrollmentsWidgetFilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt";

export type EnrollmentsWidgetQuery = WidgetQuery;
export type EnrollmentsWidgetAggregateResult = WidgetAggregateResult;

type EnrollmentRow = Record<string, unknown>;

function enrollmentFieldValue(enrollment: EnrollmentRow, field: string): unknown {
  return enrollment[field];
}

function filterEnrollmentsForWidget(
  enrollments: EnrollmentRow[],
  query: EnrollmentsWidgetQuery,
): EnrollmentRow[] {
  return enrollments.filter((enrollment) =>
    matchesWidgetFilter(enrollment, query.filterField, query.filterOperator, query.filterValue),
  );
}

function aggregateNumericField(
  items: EnrollmentRow[],
  operation: "sum" | "avg",
  targetField: string,
): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const numericFieldValue = Number(enrollmentFieldValue(items[i], targetField));
    if (!Number.isNaN(numericFieldValue)) {
      sum += numericFieldValue;
      count += 1;
    }
  }
  if (operation === "sum") return sum;
  return count > 0 ? Math.round(sum / count) : 0;
}

function buildChartData(
  items: EnrollmentRow[],
  query: EnrollmentsWidgetQuery,
): { name: string; value: number }[] {
  const xAxisField = query.xAxisField || "status";
  const isNumeric = query.operation === "sum" || query.operation === "avg";
  const targetField = query.targetField || "";
  const groupStats = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const groupValue = enrollmentFieldValue(item, xAxisField);
    const groupKey =
      groupValue === undefined || groupValue === null || groupValue === ""
        ? "Unknown"
        : String(groupValue);
    let stat = groupStats.get(groupKey);
    if (!stat) {
      stat = { sum: 0, count: 0 };
      groupStats.set(groupKey, stat);
    }
    if (isNumeric) {
      const numericVal = Number(enrollmentFieldValue(item, targetField));
      if (!Number.isNaN(numericVal)) {
        stat.sum += numericVal;
        stat.count += 1;
      }
    } else {
      stat.count += 1;
    }
  }

  const chartData: { name: string; value: number }[] = [];
  for (const [groupName, stat] of groupStats) {
    const aggregateValue = isNumeric
      ? query.operation === "sum"
        ? stat.sum
        : stat.count > 0
          ? Math.round(stat.sum / stat.count)
          : 0
      : stat.count;
    chartData.push({ name: groupName, value: aggregateValue });
  }

  return chartData.sort((leftPoint, rightPoint) => rightPoint.value - leftPoint.value).slice(0, 8);
}

/** Server/client widget aggregate for enrollments collection. */
export function computeEnrollmentsWidgetAggregate(
  enrollments: EnrollmentRow[],
  query: EnrollmentsWidgetQuery,
): EnrollmentsWidgetAggregateResult {
  const totalCount = enrollments.length;
  const filtered = filterEnrollmentsForWidget(enrollments, query);

  let value = 0;
  if (query.operation === "count") {
    value = filtered.length;
  } else if (query.operation === "percentage") {
    value = totalCount > 0 ? Math.round((filtered.length / totalCount) * 100) : 0;
  } else if (query.operation === "sum" || query.operation === "avg") {
    value = aggregateNumericField(filtered, query.operation, query.targetField || "");
  }

  return {
    value,
    totalCount,
    chartData: buildChartData(filtered, query),
  };
}

export function computeEnrollmentsWidgetAggregates(
  enrollments: EnrollmentRow[],
  queries: EnrollmentsWidgetQuery[],
): Record<string, EnrollmentsWidgetAggregateResult> {
  const results: Record<string, EnrollmentsWidgetAggregateResult> = {};
  for (const query of queries) {
    results[query.id] = computeEnrollmentsWidgetAggregate(enrollments, query);
  }
  return results;
}

export function enrollmentsWidgetQueryFromWidget(widget: {
  id: string;
  operation: EnrollmentsWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: EnrollmentsWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
}): EnrollmentsWidgetQuery {
  return {
    id: widget.id,
    operation: widget.operation,
    targetField: widget.targetField,
    filterField: widget.filterField,
    filterOperator: widget.filterOperator,
    filterValue: widget.filterValue,
    xAxisField: widget.xAxisField,
  };
}
