import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  normalizeExaminationsReportComparisonQuery,
  type ExaminationsReportComparisonQuery,
  type ExaminationsReportAggregates,
} from "@mms/shared";

export const EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY = [
  EXAMINATIONS_MODULE_MANIFEST.collectionKey,
  "report-aggregates",
] as const;

export function useExaminationsReportAggregates(options?: {
  enabled?: boolean;
  comparison?: ExaminationsReportComparisonQuery;
}) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;
  const comparison = normalizeExaminationsReportComparisonQuery(options?.comparison);

  const query = {
    ...(comparison?.sessionIds?.length ? { sessionIds: comparison.sessionIds.join(",") } : {}),
    ...(comparison?.rangeAFrom ? { rangeAFrom: comparison.rangeAFrom } : {}),
    ...(comparison?.rangeATo ? { rangeATo: comparison.rangeATo } : {}),
    ...(comparison?.rangeBFrom ? { rangeBFrom: comparison.rangeBFrom } : {}),
    ...(comparison?.rangeBTo ? { rangeBTo: comparison.rangeBTo } : {}),
  };

  return useQuery({
    queryKey: [...EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY, comparison],
    queryFn: async ({ signal }) => {
      const response = await apiContract.examinations.reportAggregates({
        query,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to fetch examinations report aggregates",
          errorBody?.type,
        );
      }
      return response.body as ExaminationsReportAggregates;
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
