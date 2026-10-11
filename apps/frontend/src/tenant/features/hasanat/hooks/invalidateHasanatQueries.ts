import type { QueryClient } from "@tanstack/react-query";
import {
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/useHasanatApi";

/** Invalidate Hasanat denoms/batches/distributions/redemptions/metrics/report-aggregates Query keys. */
export function invalidateHasanatQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: HASANAT_DENOMS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HASANAT_BATCHES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HASANAT_DISTRIBUTIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HASANAT_REDEMPTIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HASANAT_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HASANAT_REPORT_AGGREGATES_QUERY_KEY });
}
