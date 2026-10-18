import { queryClientInstance } from "@/lib/queryClient";
import {
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/contacts";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/students";
import {
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/faculty";
import {
  SESSIONS_METRICS_QUERY_KEY,
  SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/sessions";
import {
  ENROLLMENTS_METRICS_QUERY_KEY,
  ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/hooks/collections/enrollments";
import type { CustomWidget } from "./pinnedWidgetTypes";
import {
  type ContactsWidgetAggregateResult,
  type StudentsWidgetAggregateResult,
  type FacultyWidgetAggregateResult,
  type SessionsWidgetAggregateResult,
  type EnrollmentsWidgetAggregateResult,
  formatMoney,
  formatNumber,
} from "@mms/shared";

function readWidgetAggregateFromCache<T>(
  queryKey: readonly unknown[],
  widgetId: string,
): T | undefined {
  const queries = queryClientInstance.getQueriesData<Record<string, T>>({
    queryKey,
  });
  for (const [, aggregateByWidgetId] of queries) {
    if (aggregateByWidgetId?.[widgetId]) return aggregateByWidgetId[widgetId];
  }
  return undefined;
}

function readTotalFromMetricsQuery(queryKey: readonly unknown[]): number {
  const metrics = queryClientInstance.getQueryData<{ total: number }>(queryKey);
  return metrics?.total ?? 0;
}

export function readContactsWidgetAggregate(
  widgetId: string,
): ContactsWidgetAggregateResult | undefined {
  return readWidgetAggregateFromCache<ContactsWidgetAggregateResult>(
    CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
    widgetId,
  );
}

export function readContactsTotalFromMetrics(): number {
  return readTotalFromMetricsQuery(CONTACTS_METRICS_QUERY_KEY);
}

export function readStudentsWidgetAggregate(
  widgetId: string,
): StudentsWidgetAggregateResult | undefined {
  return readWidgetAggregateFromCache<StudentsWidgetAggregateResult>(
    STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
    widgetId,
  );
}

export function readStudentsTotalFromMetrics(): number {
  return readTotalFromMetricsQuery(STUDENTS_METRICS_QUERY_KEY);
}

export function readFacultyWidgetAggregate(
  widgetId: string,
): FacultyWidgetAggregateResult | undefined {
  return readWidgetAggregateFromCache<FacultyWidgetAggregateResult>(
    FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
    widgetId,
  );
}

export function readFacultyTotalFromMetrics(): number {
  return readTotalFromMetricsQuery(FACULTY_METRICS_QUERY_KEY);
}

export function readSessionsWidgetAggregate(
  widgetId: string,
): SessionsWidgetAggregateResult | undefined {
  return readWidgetAggregateFromCache<SessionsWidgetAggregateResult>(
    SESSIONS_WIDGET_AGGREGATES_QUERY_KEY,
    widgetId,
  );
}

export function readSessionsTotalFromMetrics(): number {
  return readTotalFromMetricsQuery(SESSIONS_METRICS_QUERY_KEY);
}

export function readEnrollmentsWidgetAggregate(
  widgetId: string,
): EnrollmentsWidgetAggregateResult | undefined {
  return readWidgetAggregateFromCache<EnrollmentsWidgetAggregateResult>(
    ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY,
    widgetId,
  );
}

export function readEnrollmentsTotalFromMetrics(): number {
  return readTotalFromMetricsQuery(ENROLLMENTS_METRICS_QUERY_KEY);
}

export function formatGenericWidgetValue(
  widget: CustomWidget,
  aggregate: { value: number; totalCount: number },
): { value: number; formattedValue: string; isAlert: boolean; totalCount: number } {
  let formattedValue = String(aggregate.value);
  if (widget.widgetType === "progress" || widget.operation === "percentage") {
    formattedValue = `${aggregate.value}%`;
  } else if (widget.collection === "finance_invoices" && widget.operation !== "count") {
    formattedValue = formatMoney(aggregate.value);
  } else {
    formattedValue = formatNumber(aggregate.value);
  }

  let isAlert = false;
  if (widget.thresholdEnabled && widget.thresholdValue !== undefined) {
    const numericValue = Number(aggregate.value);
    const numericThreshold = Number(widget.thresholdValue);
    switch (widget.thresholdCondition) {
      case "lt":
        isAlert = numericValue < numericThreshold;
        break;
      case "gt":
        isAlert = numericValue > numericThreshold;
        break;
      case "equals":
        isAlert = numericValue === numericThreshold;
        break;
    }
  }

  return {
    value: aggregate.value,
    formattedValue,
    isAlert,
    totalCount: aggregate.totalCount,
  };
}

/**
 * Sync snapshot from TanStack Query cache for non-React consumers.
 * Prefer `useWidgetCollections()` in React trees — this helper never invents empty mirrors.
 */
