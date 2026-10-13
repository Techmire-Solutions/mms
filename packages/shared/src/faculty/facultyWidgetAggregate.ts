import { matchesWidgetFilter } from "../core/utils.js";
import type {
  WidgetQuery,
  WidgetAggregateResult,
  WidgetFilter,
} from "../dashboard/widgetAggregateTypes.js";

export type FacultyWidgetOperation = "count" | "sum" | "avg" | "percentage";
export type FacultyWidgetFilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt";
export type FacultyWidgetFilter = WidgetFilter;
export type FacultyWidgetQuery = WidgetQuery;
export type FacultyWidgetAggregateResult = WidgetAggregateResult;

type FacultyRow = Record<string, unknown>;

function facultyFieldValue(faculty: FacultyRow, field: string): unknown {
  return faculty[field];
}

function filterFacultyForWidget(
  facultyList: FacultyRow[],
  query: FacultyWidgetQuery,
): FacultyRow[] {
  return facultyList.filter((faculty) =>
    matchesWidgetFilter(faculty, query.filterField, query.filterOperator, query.filterValue),
  );
}

function aggregateNumericField(
  items: FacultyRow[],
  operation: "sum" | "avg",
  targetField: string,
): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const numericFieldValue = Number(facultyFieldValue(items[i], targetField));
    if (!Number.isNaN(numericFieldValue)) {
      sum += numericFieldValue;
      count += 1;
    }
  }
  if (operation === "sum") return sum;
  return count > 0 ? Math.round(sum / count) : 0;
}

function buildChartData(
  items: FacultyRow[],
  query: FacultyWidgetQuery,
): { name: string; value: number }[] {
  const xAxisField = query.xAxisField || "status";
  const isNumeric = query.operation === "sum" || query.operation === "avg";
  const targetField = query.targetField || "";
  const groupStats = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const groupValue = facultyFieldValue(item, xAxisField);
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
      const numericVal = Number(facultyFieldValue(item, targetField));
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

  const limit = Math.max(1, query.chartLimit ?? 8);
  return chartData
    .sort((leftPoint, rightPoint) => rightPoint.value - leftPoint.value)
    .slice(0, limit);
}

/**
 * In-memory widget aggregate computation for faculty.
 * Prefer SQL backend aggregation in production routes.
 */
export function computeFacultyWidgetAggregate(
  facultyList: FacultyRow[],
  query: FacultyWidgetQuery,
): FacultyWidgetAggregateResult {
  const totalCount = facultyList.length;
  const filtered = filterFacultyForWidget(facultyList, query);

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

export function computeFacultyWidgetAggregates(
  facultyList: FacultyRow[],
  queries: FacultyWidgetQuery[],
): Record<string, FacultyWidgetAggregateResult> {
  const results: Record<string, FacultyWidgetAggregateResult> = {};
  for (const query of queries) {
    results[query.id] = computeFacultyWidgetAggregate(facultyList, query);
  }
  return results;
}

export function facultyWidgetQueryFromWidget(widget: {
  id: string;
  operation: FacultyWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: FacultyWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
  filters?: FacultyWidgetFilter[];
  chartLimit?: number;
}): FacultyWidgetQuery {
  return {
    id: widget.id,
    operation: widget.operation,
    targetField: widget.targetField,
    filterField: widget.filterField,
    filterOperator: widget.filterOperator,
    filterValue: widget.filterValue,
    xAxisField: widget.xAxisField,
    filters: widget.filters,
    chartLimit: widget.chartLimit,
  };
}
