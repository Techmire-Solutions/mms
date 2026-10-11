import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiClient";
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

  const queryParams = new URLSearchParams();
  if (comparison?.sessionIds?.length)
    queryParams.append("sessionIds", comparison.sessionIds.join(","));
  if (comparison?.rangeAFrom) queryParams.append("rangeAFrom", comparison.rangeAFrom);
  if (comparison?.rangeATo) queryParams.append("rangeATo", comparison.rangeATo);
  if (comparison?.rangeBFrom) queryParams.append("rangeBFrom", comparison.rangeBFrom);
  if (comparison?.rangeBTo) queryParams.append("rangeBTo", comparison.rangeBTo);

  const queryString = queryParams.toString();
  const url = `${EXAMINATIONS_MODULE_MANIFEST.restBasePath}/report-aggregates${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: [...EXAMINATIONS_REPORT_AGGREGATES_QUERY_KEY, comparison],
    queryFn: async ({ signal }) => {
      return apiJson<ExaminationsReportAggregates>(url, { signal });
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
