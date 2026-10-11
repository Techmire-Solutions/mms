import { matchesWidgetFilter } from "./utils.js";
import type { WidgetQuery, WidgetAggregateResult, WidgetFilter } from "./widgetAggregateTypes.js";

export type StudentsWidgetOperation = "count" | "sum" | "avg" | "percentage";
export type StudentsWidgetFilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt";
export type StudentsWidgetFilter = WidgetFilter;

export type StudentsWidgetQuery = WidgetQuery;
export type StudentsWidgetAggregateResult = WidgetAggregateResult;

type StudentRow = Record<string, unknown>;

function studentFieldValue(student: StudentRow, field: string): unknown {
  return student[field];
}

function filterStudentsForWidget(students: StudentRow[], query: StudentsWidgetQuery): StudentRow[] {
  return students.filter((student) =>
    matchesWidgetFilter(student, query.filterField, query.filterOperator, query.filterValue),
  );
}

function aggregateNumericField(
  items: StudentRow[],
  operation: "sum" | "avg",
  targetField: string,
): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const numericFieldValue = Number(studentFieldValue(items[i], targetField));
    if (!Number.isNaN(numericFieldValue)) {
      sum += numericFieldValue;
      count += 1;
    }
  }
  if (operation === "sum") return sum;
  return count > 0 ? Math.round(sum / count) : 0;
}

function buildChartData(
  items: StudentRow[],
  query: StudentsWidgetQuery,
): { name: string; value: number }[] {
  const xAxis = query.xAxisField || "status";
  const isNumeric = query.operation === "sum" || query.operation === "avg";
  const targetField = query.targetField || "";
  const groupStats = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const keyVal = studentFieldValue(item, xAxis);
    const key =
      keyVal === undefined || keyVal === null || keyVal === "" ? "Unknown" : String(keyVal);
    let stat = groupStats.get(key);
    if (!stat) {
      stat = { sum: 0, count: 0 };
      groupStats.set(key, stat);
    }
    if (isNumeric) {
      const numericVal = Number(studentFieldValue(item, targetField));
      if (!Number.isNaN(numericVal)) {
        stat.sum += numericVal;
        stat.count += 1;
      }
    } else {
      stat.count += 1;
    }
  }

  const chartRows: { name: string; value: number }[] = [];
  for (const [groupName, stat] of groupStats) {
    const finalVal = isNumeric
      ? query.operation === "sum"
        ? stat.sum
        : stat.count > 0
          ? Math.round(stat.sum / stat.count)
          : 0
      : stat.count;
    chartRows.push({ name: groupName, value: finalVal });
  }

  const limit = Math.max(1, query.chartLimit ?? 8);
  return chartRows.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Server/client widget aggregate for students collection (globle2 §10). */
export function computeStudentsWidgetAggregate(
  students: StudentRow[],
  query: StudentsWidgetQuery,
): StudentsWidgetAggregateResult {
  const totalCount = students.length;
  const filtered = filterStudentsForWidget(students, query);

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

export function studentsWidgetQueryFromWidget(widget: {
  id: string;
  operation: StudentsWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: StudentsWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
  filters?: StudentsWidgetFilter[];
  chartLimit?: number;
}): StudentsWidgetQuery {
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
