import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { Exam, ExamResult, ExaminationsCommandMetricsSnapshot } from "@mms/shared";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examResultsPageResponseSchema,
  examsFromResponse,
} from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiContract, tsrClient } from "@/lib/api";
import { apiContractError } from "@/lib/apiContractError";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
} from "./examinationsQueryKeys";
import { invalidateExaminationsQueries } from "./invalidateExaminationsQueries";

export function examinationsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<ExaminationsCommandMetricsSnapshot>({
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    apiPath: EXAMINATIONS_MODULE_MANIFEST.restBasePath,
  });
}

export {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
};

export const EXAMINATIONS_API = EXAMINATIONS_MODULE_MANIFEST.restBasePath;

export function useExaminationsExams(options?: { enabled?: boolean; includeDeleted?: boolean }) {
  const { isAuthenticated: _isAuthenticated } = useAuth();
  const includeDeleted = options?.includeDeleted ?? false;
  return tsrClient.examinations.listExams.useQuery({
    queryKey: [...EXAMINATIONS_EXAMS_QUERY_KEY, { includeDeleted }],
    queryData: { query: { includeDeleted: includeDeleted ? "true" : undefined } },
    staleTime: 30_000,
  });
}

export function useExaminationsExamsCollection(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}): Exam[] {
  const query = useExaminationsExams(options);
  if (!query.data || query.data.status !== 200) return [];
  return examsFromResponse(query.data.body);
}

/** Safety bound for the marks pager: 20 × 500 = 10,000 marks per workspace read. */
const RESULTS_MAX_PAGES = 20;
const RESULTS_PAGE_SIZE = 500;

/**
 * Every mark in the workspace.
 *
 * The endpoint is keyset-paginated (a single array response used to truncate at 500 rows, silently
 * corrupting ranks and averages). This hook walks the pages once and returns the complete set in
 * the same `{ status, body: { results } }` shape the rest of the module already consumes.
 */
export function useExaminationsResults(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: EXAMINATIONS_RESULTS_QUERY_KEY,
    staleTime: 30_000,
    enabled: options?.enabled ?? isAuthenticated,
    queryFn: async () => {
      const results: ExamResult[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < RESULTS_MAX_PAGES; page += 1) {
        const response = await apiContract.examinations.listResults({
          query: { limit: RESULTS_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        });
        if (response.status !== 200) {
          // Preserve the status/type on the query error (the repo-wide contract ratchet).
          throw apiContractError(response, "Failed to load exam results");
        }
        const body = examResultsPageResponseSchema.parse(response.body);
        results.push(...body.results);
        if (!body.hasMore) break;
        cursor = body.results[body.results.length - 1]?.id;
        if (!cursor) break;
      }
      // `hasMore: true` when the safety cap stopped the walk: callers must not present a truncated
      // set as complete (rankings/averages would be silently wrong beyond 10,000 marks).
      const truncated = results.length >= RESULTS_MAX_PAGES * RESULTS_PAGE_SIZE;
      return { status: 200 as const, body: { results, hasMore: truncated } };
    },
  });
}

export function useExaminationsResultsCollection(options?: { enabled?: boolean }): ExamResult[] {
  const query = useExaminationsResults(options);
  if (!query.data || query.data.status !== 200) return [];
  return query.data.body.results;
}

export function useExaminationsMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<ExaminationsCommandMetricsSnapshot>({
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    apiPath: EXAMINATIONS_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export function useExaminationsMutations() {
  const queryClient = useQueryClient();

  const invalidateExams = () => {
    invalidateExaminationsQueries(queryClient);
  };

  const replaceExams = tsrClient.examinations.bulkUpdateExams.useMutation({
    onSuccess: () => {
      invalidateExams();
    },
  });

  const replaceExamResults = tsrClient.examinations.bulkUpdateResults.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });

  const deleteExam = tsrClient.examinations.deleteExam.useMutation({
    onSuccess: () => invalidateExams(),
  });

  const restoreExam = tsrClient.examinations.restoreExam.useMutation({
    onSuccess: () => invalidateExams(),
  });

  const bulkDeleteExams = tsrClient.examinations.bulkDeleteExams.useMutation({
    onSuccess: () => invalidateExams(),
  });

  const bulkRestoreExams = tsrClient.examinations.bulkRestoreExams.useMutation({
    onSuccess: () => invalidateExams(),
  });

  return {
    replaceExams: {
      ...replaceExams,
      mutate: (exams: Exam[], opts?: MutateOptions) => replaceExams.mutate({ body: exams }, opts),
      mutateAsync: (exams: Exam[]) => replaceExams.mutateAsync({ body: exams }),
    },
    replaceExamResults: {
      ...replaceExamResults,
      mutate: (results: ExamResult[], opts?: MutateOptions) =>
        replaceExamResults.mutate({ body: results }, opts),
      mutateAsync: (results: ExamResult[]) => replaceExamResults.mutateAsync({ body: results }),
    },
    deleteExam: {
      ...deleteExam,
      mutate: (id: string, opts?: MutateOptions) => deleteExam.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => deleteExam.mutateAsync({ params: { id } }),
    },
    restoreExam: {
      ...restoreExam,
      mutate: (id: string, opts?: MutateOptions) => restoreExam.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => restoreExam.mutateAsync({ params: { id } }),
    },
    bulkDeleteExams: {
      ...bulkDeleteExams,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteExams.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteExams.mutateAsync({ body: { ids } }),
    },
    bulkRestoreExams: {
      ...bulkRestoreExams,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreExams.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreExams.mutateAsync({ body: { ids } }),
    },
  };
}
