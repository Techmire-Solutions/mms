import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiContract } from "@/lib/api";
import { reportClientError } from "@/lib/clientErrorReporting";
import { SUMMARY_STALE_TIME } from "@/lib/queryClient";
import type { WidgetQuery, WidgetAggregateResult } from "@mms/shared";

export interface DynamicWidgetInput {
  id: string;
  collection: string;
  operation: WidgetQuery["operation"];
  targetField?: string;
  filterField?: string;
  filterOperator?: WidgetQuery["filterOperator"];
  filterValue?: string;
  xAxisField?: string;
  chartLimit?: number;
}

/** Collection → `rootContract` domain whose `widgetAggregates` route serves it. */
const COLLECTION_TO_DOMAIN: Record<string, string> = {
  contacts: "contacts",
  students: "students",
  faculty: "faculty",
  sessions: "sessions",
  enrollments: "enrollments",
  finance_invoices: "finance",
  attendance_records: "attendance",
  hasanat_distributions: "hasanat",
  questions: "questionBank",
  tests: "questionBank",
  assessment_results: "questionBank",
  exams: "examinations",
  exam_results: "examinations",
};

/**
 * Some domains' `widgetAggregates` response is a bare `Record<id, result>`; others wrap it as
 * `{ results: Record<id, result> }`. Accept both so the merge keyed by widget id always works.
 */
function unwrapAggregates(body: unknown): Record<string, WidgetAggregateResult> {
  if (!body || typeof body !== "object") return {};
  const wrapped = (body as { results?: Record<string, WidgetAggregateResult> }).results;
  if (wrapped && typeof wrapped === "object") return wrapped;
  return body as Record<string, WidgetAggregateResult>;
}

export function useModuleWidgetAggregates(
  widgets: DynamicWidgetInput[],
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;

  const groupedWidgets = (() => {
    const groups: Record<string, WidgetQuery[]> = {};
    for (const widget of widgets) {
      const domain = COLLECTION_TO_DOMAIN[widget.collection];
      if (!domain) continue;
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push({
        id: widget.id,
        operation: widget.operation,
        targetField: widget.targetField,
        filterField: widget.filterField,
        filterOperator: widget.filterOperator,
        filterValue: widget.filterValue,
        xAxisField: widget.xAxisField,
        chartLimit: widget.chartLimit,
      });
    }
    return groups;
  })();

  const querySignature = (() => {
    return JSON.stringify(
      widgets
        .map((w) => ({
          id: w.id,
          col: w.collection,
          op: w.operation,
          tf: w.targetField,
          ff: w.filterField,
          fo: w.filterOperator,
          fv: w.filterValue,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  })();

  const query = useQuery({
    queryKey: ["dynamic_widget_aggregates", querySignature] as const,
    queryFn: async ({ signal }) => {
      const results: Record<string, WidgetAggregateResult> = {};

      const responses = await Promise.all(
        Object.entries(groupedWidgets).map(async ([domain, reqWidgets]) => {
          try {
            const response = await apiContract[domain].widgetAggregates({
              body: { widgets: reqWidgets },
              signal,
              fetchOptions: { signal },
            });
            if (response.status !== 200) return {};
            return unwrapAggregates(response.body);
          } catch (e) {
            reportClientError(e, { context: "reports.widgetAggregates", domain });
            return {};
          }
        }),
      );

      responses.forEach((res) => Object.assign(results, res));
      return results;
    },
    enabled: isAuthenticated && enabled && widgets.length > 0,
    staleTime: SUMMARY_STALE_TIME,
  });

  return { ...query, data: query.data ?? {} };
}
