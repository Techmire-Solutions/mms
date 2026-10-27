import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  HASANAT_BATCHES_QUERY_KEY,
  HASANAT_DENOMS_QUERY_KEY,
  HASANAT_DISTRIBUTIONS_QUERY_KEY,
  HASANAT_METRICS_QUERY_KEY,
  HASANAT_REDEMPTIONS_QUERY_KEY,
  HASANAT_REPORT_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/hasanat/hooks/hasanatQueryKeys";
import { HASANAT_PREFERENCES_QUERY_KEY } from "@/tenant/features/hasanat/hooks/useHasanatSetupConfig";

/** Invalidate Hasanat collections/metrics/report-aggregates/setup Query keys. */
export const invalidateHasanatQueries = createModuleQueryInvalidator({
  list: HASANAT_DISTRIBUTIONS_QUERY_KEY,
  lists: [
    HASANAT_DENOMS_QUERY_KEY,
    HASANAT_BATCHES_QUERY_KEY,
    HASANAT_REDEMPTIONS_QUERY_KEY,
    HASANAT_REPORT_AGGREGATES_QUERY_KEY,
  ],
  metrics: HASANAT_METRICS_QUERY_KEY,
  preferences: HASANAT_PREFERENCES_QUERY_KEY,
});
