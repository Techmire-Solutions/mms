import { tsrClient, apiContract } from "@/lib/api";
import {
  STUDENTS_MODULE_MANIFEST,
  type StudentDuplicateCheckInput,
  type StudentDuplicateReason,
  type StudentsCommandMetricsSnapshot,
  studentsWidgetQueryFromWidget,
} from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  STUDENTS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
  type StudentNextGrNumberParams,
  type StudentsWidgetAggregateWidgetInput,
} from "@/tenant/features/students/hooks/studentsQueryKeys";
import { assertContractOk } from "@/lib/apiContractError";

export function studentsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<StudentsCommandMetricsSnapshot>({
    moduleId: STUDENTS_MODULE_MANIFEST.moduleId,
    apiPath: STUDENTS_MODULE_MANIFEST.restBasePath,
  });
}

/** Fetches next sequential GR Number based on tenant settings and registration date. */
export function useStudentNextGrNumber(params: StudentNextGrNumberParams) {
  const { isAuthenticated } = useAuth();
  const enabled = params.enabled ?? true;

  const query = tsrClient.students.nextGrNumber.useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, "next-gr-number", params] as const,
    queryData: {
      query: {
        registeredDate: params.registeredDate ?? "",
        template: params.template,
        digits: params.digits != null ? String(params.digits) : undefined,
        restartAnnually:
          params.restartAnnually != null ? String(params.restartAnnually) : undefined,
      },
    },
    enabled: isAuthenticated && enabled && Boolean(params.registeredDate),
    staleTime: 15_000,
  });

  const rawBody: unknown = query.data?.status === 200 ? query.data.body : undefined;
  const grNumber = (rawBody as { grNumber?: string } | undefined)?.grNumber;
  return { ...query, data: grNumber };
}

export async function checkStudentRegistrationDuplicate(
  input: StudentDuplicateCheckInput,
): Promise<StudentDuplicateReason | null> {
  const res = await apiContract.students.duplicateCheck({ body: input });
  assertContractOk(res, "Duplicate check failed");
  return (res.body as { reason?: StudentDuplicateReason | null } | null)?.reason ?? null;
}

export function useStudentsMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<StudentsCommandMetricsSnapshot>({
    moduleId: STUDENTS_MODULE_MANIFEST.moduleId,
    apiPath: STUDENTS_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export function useStudentsWidgetAggregates(
  widgets: StudentsWidgetAggregateWidgetInput[],
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;

  const { queries, querySignature } = useMemo(() => {
    const resolvedQueries = widgets
      .filter((widget) => widget.collection === "students")
      .map((widget) => studentsWidgetQueryFromWidget(widget));

    const signature = JSON.stringify(
      [...resolvedQueries]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((query) => ({
          id: query.id,
          target: query.targetField,
          filter: query.filterValue,
          filterOperator: query.filterOperator,
          xAxis: query.xAxisField,
        })),
    );

    return { queries: resolvedQueries, querySignature: signature };
  }, [widgets]);

  const query = useQuery({
    queryKey: [...STUDENTS_WIDGET_AGGREGATES_QUERY_KEY, querySignature] as const,
    queryFn: async () => {
      const res = await apiContract.students.widgetAggregates({ body: { widgets: queries } });
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

  return { ...query, data: query.data ?? {} };
}
