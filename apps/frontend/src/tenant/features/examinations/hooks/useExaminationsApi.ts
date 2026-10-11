import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { Exam, ExamResult, ExaminationsCommandMetricsSnapshot } from "@mms/shared";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";

export function examinationsCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<ExaminationsCommandMetricsSnapshot>({
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    apiPath: EXAMINATIONS_MODULE_MANIFEST.restBasePath,
  });
}

export const EXAMINATIONS_EXAMS_QUERY_KEY = ["examinations", "exams", "list"] as const;
export const EXAMINATIONS_RESULTS_QUERY_KEY = ["examinations", "results", "list"] as const;
export const EXAMINATIONS_METRICS_QUERY_KEY = ["examinations", "metrics"] as const;

export const EXAMINATIONS_API = EXAMINATIONS_MODULE_MANIFEST.restBasePath;

export function useExaminationsExams(options?: { enabled?: boolean; includeDeleted?: boolean }) {
  const { isAuthenticated } = useAuth();
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
  const body = query.data.body;
  if (Array.isArray(body)) return body as Exam[];
  if (body && typeof body === "object" && "exams" in body && Array.isArray(body.exams)) {
    return body.exams as Exam[];
  }
  return [];
}

export function useExaminationsResults(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  return tsrClient.examinations.listResults.useQuery({
    queryKey: EXAMINATIONS_RESULTS_QUERY_KEY,
    staleTime: 30_000,
  });
}

export function useExaminationsResultsCollection(options?: { enabled?: boolean }): ExamResult[] {
  const query = useExaminationsResults(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as ExamResult[];
  if (body && typeof body === "object" && "results" in body && Array.isArray(body.results)) {
    return body.results as ExamResult[];
  }
  return [];
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
    void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_EXAMS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_METRICS_QUERY_KEY });
  };

  const replaceExams = tsrClient.examinations.bulkUpdateExams.useMutation({
    onSuccess: () => {
      invalidateExams();
    },
  });

  const replaceExamResults = tsrClient.examinations.bulkUpdateResults.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_RESULTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_METRICS_QUERY_KEY });
    },
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
