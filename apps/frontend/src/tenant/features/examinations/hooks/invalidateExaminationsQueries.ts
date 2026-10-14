import type { QueryClient } from "@tanstack/react-query";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "@/tenant/features/examinations/hooks/examinationsQueryKeys";

/** Invalidate Examinations exams/results/metrics Query keys (mutations + live push). */
export function invalidateExaminationsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_EXAMS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_RESULTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_METRICS_QUERY_KEY });
}
