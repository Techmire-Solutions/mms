import { matchesWidgetFilter } from "../core/utils.js";
import type { WidgetQuery, WidgetAggregateResult } from "../dashboard/widgetAggregateTypes.js";

export type SessionsWidgetOperation = "count" | "sum" | "avg" | "percentage";
export type SessionsWidgetFilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt";

export type SessionsWidgetQuery = WidgetQuery;
export type SessionsWidgetAggregateResult = WidgetAggregateResult;

type SessionRow = Record<string, unknown>;

function sessionFieldValue(session: SessionRow, field: string): unknown {
  return session[field];
}

function filterSessionsForWidget(sessions: SessionRow[], query: SessionsWidgetQuery): SessionRow[] {
  return sessions.filter((session) =>
    matchesWidgetFilter(session, query.filterField, query.filterOperator, query.filterValue),
  );
}

function aggregateNumericField(
  items: SessionRow[],
  operation: "sum" | "avg",
  targetField: string,
): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const numericFieldValue = Number(sessionFieldValue(items[i], targetField));
    if (!Number.isNaN(numericFieldValue)) {
      sum += numericFieldValue;
      count += 1;
    }
  }
  if (operation === "sum") return sum;
  return count > 0 ? Math.round(sum / count) : 0;
}

function buildChartData(
  items: SessionRow[],
  query: SessionsWidgetQuery,
): { name: string; value: number }[] {
  const xAxisField = query.xAxisField || "status";
  const isNumeric = query.operation === "sum" || query.operation === "avg";
  const targetField = query.targetField || "";
  const groupStats = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const groupValue = sessionFieldValue(item, xAxisField);
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
      const numericVal = Number(sessionFieldValue(item, targetField));
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

/** Server/client widget aggregate for sessions collection. */
export function computeSessionsWidgetAggregate(
  sessions: SessionRow[],
  query: SessionsWidgetQuery,
): SessionsWidgetAggregateResult {
  const totalCount = sessions.length;
  const filtered = filterSessionsForWidget(sessions, query);

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

export function computeSessionsWidgetAggregates(
  sessions: SessionRow[],
  queries: SessionsWidgetQuery[],
): Record<string, SessionsWidgetAggregateResult> {
  const results: Record<string, SessionsWidgetAggregateResult> = {};
  for (const query of queries) {
    results[query.id] = computeSessionsWidgetAggregate(sessions, query);
  }
  return results;
}

export function sessionsWidgetQueryFromWidget(widget: {
  id: string;
  operation: SessionsWidgetOperation;
  targetField?: string;
  filterField?: string;
  filterOperator?: SessionsWidgetFilterOperator;
  filterValue?: string;
  xAxisField?: string;
}): SessionsWidgetQuery {
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
