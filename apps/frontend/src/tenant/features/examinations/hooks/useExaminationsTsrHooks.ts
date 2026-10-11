/**
 * Phase 7: Contract-driven query/mutation hooks for the Examinations module.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "@/tenant/features/examinations/hooks/useExaminationsApi";
import { invalidateExaminationsQueries } from "@/tenant/features/examinations/hooks/invalidateExaminationsQueries";

export function examinationsExamsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...EXAMINATIONS_EXAMS_QUERY_KEY, "contract-list", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.examinations.listExams({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch exams");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useExaminationsContractList(query: Record<string, unknown> = {}, enabled = true) {
  return tsrClient.examinations.listExams.useQuery({
    queryKey: [...EXAMINATIONS_EXAMS_QUERY_KEY, "contract-list", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useExaminationsContractResults(
  query: Record<string, unknown> = {},
  enabled = true,
) {
  return tsrClient.examinations.listResults.useQuery({
    queryKey: [...EXAMINATIONS_RESULTS_QUERY_KEY, "contract-results", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useExaminationsContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.bulkDeleteExams.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}

export function useExaminationsContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.bulkRestoreExams.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}

export function useExaminationsContractBulkUpdateExams() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.bulkUpdateExams.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}

export function useExaminationsContractBulkUpdateResults() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.bulkUpdateResults.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}

export function useExaminationsContractDeleteExam() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.deleteExam.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}

export function useExaminationsContractRestoreExam() {
  const queryClient = useQueryClient();
  return tsrClient.examinations.restoreExam.useMutation({
    onSuccess: () => invalidateExaminationsQueries(queryClient),
  });
}
