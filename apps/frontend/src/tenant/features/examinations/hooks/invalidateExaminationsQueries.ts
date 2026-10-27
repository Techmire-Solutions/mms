import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  EXAMINATIONS_EXAMS_QUERY_KEY,
  EXAMINATIONS_METRICS_QUERY_KEY,
  EXAMINATIONS_RESULTS_QUERY_KEY,
} from "@/tenant/features/examinations/hooks/examinationsQueryKeys";
import { EXAMINATIONS_PREFERENCES_QUERY_KEY } from "@/tenant/features/examinations/hooks/useExaminationSetupConfig";

/** Invalidate Examinations exams/results/metrics/setup Query keys (mutations + live push). */
export const invalidateExaminationsQueries = createModuleQueryInvalidator({
  list: EXAMINATIONS_EXAMS_QUERY_KEY,
  lists: [EXAMINATIONS_RESULTS_QUERY_KEY],
  metrics: EXAMINATIONS_METRICS_QUERY_KEY,
  preferences: EXAMINATIONS_PREFERENCES_QUERY_KEY,
});
