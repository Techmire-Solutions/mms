import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiContract } from "@/lib/api";
import { facultyWidgetQueryFromWidget } from "@mms/shared";
import {
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  type FacultyWidgetAggregateWidgetInput,
} from "@/tenant/features/faculty/hooks/facultyQueryKeys";

function facultyWidgetAggregateQueries(widgets: FacultyWidgetAggregateWidgetInput[]) {
  return widgets
    .filter((widget) => widget.collection === "faculty")
    .map((widget) => facultyWidgetQueryFromWidget(widget));
}

function facultyWidgetAggregateSignature(
  queries: ReturnType<typeof facultyWidgetAggregateQueries>,
): string {
  return JSON.stringify(
    [...queries]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((query) => ({
        id: query.id,
        target: query.targetField,
        filter: query.filterValue,
        filterOperator: query.filterOperator,
        xAxis: query.xAxisField,
      })),
  );
}

export function facultyWidgetAggregatesQueryOptions(
  widgets: FacultyWidgetAggregateWidgetInput[],
  options?: { enabled?: boolean; isAuthenticated?: boolean },
) {
  const queries = facultyWidgetAggregateQueries(widgets);
  const querySignature = facultyWidgetAggregateSignature(queries);
  const enabled = options?.enabled ?? true;
  const isAuthenticated = options?.isAuthenticated ?? true;

  return queryOptions({
    queryKey: [...FACULTY_WIDGET_AGGREGATES_QUERY_KEY, querySignature] as const,
    queryFn: async ({ signal }) => {
      const res = await apiContract.faculty.widgetAggregates({
        body: { widgets: queries },
        fetchOptions: { signal },
      });
      return (
        (
          res.body as {
            results?: Record<
              string,
              {
                value?: number;
                totalCount?: number;
                chartData?: Array<{ name: string; value: number }>;
              }
            >;
          } | null
        )?.results ?? {}
      );
    },
    enabled: isAuthenticated && enabled && queries.length > 0,
    staleTime: 30_000,
  });
}

export function useFacultyWidgetAggregates(
  widgets: FacultyWidgetAggregateWidgetInput[],
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const query = useQuery(
    facultyWidgetAggregatesQueryOptions(widgets, {
      enabled: options?.enabled,
      isAuthenticated,
    }),
  );

  return { ...query, data: query.data ?? {} };
}
