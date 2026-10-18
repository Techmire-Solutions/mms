import type { QueryClient } from "@tanstack/react-query";
import {
  OBLIGATIONS_COLLECTIONS_QUERY_KEY,
  OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY,
  OBLIGATIONS_METRICS_QUERY_KEY,
  OBLIGATIONS_MUJTAHIDS_QUERY_KEY,
  OBLIGATIONS_REPS_QUERY_KEY,
  OBLIGATIONS_TYPES_QUERY_KEY,
  OBLIGATIONS_WAKALA_QUERY_KEY,
} from "@/tenant/features/obligations/hooks/obligationsQueryKeys";

/** Invalidate Obligations types/mujtahids/reps/wakala/distributions/collections/metrics Query keys. */
export function invalidateObligationsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_TYPES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_MUJTAHIDS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_REPS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_WAKALA_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_DISTRIBUTIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_COLLECTIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: OBLIGATIONS_METRICS_QUERY_KEY });
}
