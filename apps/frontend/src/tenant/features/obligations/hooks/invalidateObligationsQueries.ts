import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
} from "@/tenant/features/obligations/hooks/obligationsQueryKeys";
import { OBLIGATIONS_PREFERENCES_QUERY_KEY } from "@/tenant/features/obligations/hooks/useObligationsSetupConfig";

/** Invalidate Obligations collections/metrics/setup Query keys. */
export const invalidateObligationsQueries = createModuleQueryInvalidator({
  list: OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  lists: [
    OBLIGATIONS_TYPES_QUERY_KEY,
    OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
    OBLIGATIONS_REPS_QUERY_KEY,
    OBLIGATIONS_WAKALA_QUERY_KEY,
    OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  ],
  metrics: OBLIGATIONS_METRICS_QUERY_KEY,
  preferences: OBLIGATIONS_PREFERENCES_QUERY_KEY,
});
