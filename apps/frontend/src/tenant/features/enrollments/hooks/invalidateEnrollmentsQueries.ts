import type { QueryClient } from "@tanstack/react-query";
import { ENROLLMENT_PLACEMENTS_QUERY_KEY } from "@/lib/query/enrollmentOperationsQueries";
import { ADMISSIONS_QUERY_KEY } from "@/lib/query/registrationQueries";
import { EXAMINATIONS_ELIGIBILITY_QUERY_KEY } from "@/tenant/hooks/collections/examinations";
import {
  ENROLLMENTS_METRICS_QUERY_KEY,
  ENROLLMENTS_QUERY_KEY,
  ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY,
  ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "./enrollmentsQueryKeys.js";

/** Invalidate Enrollments list/metrics/widget-aggregates/report-aggregates/setup Query keys. */
export function invalidateEnrollmentsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_WIDGET_AGGREGATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_REPORT_AGGREGATES_QUERY_KEY });
  // Placement history and admissions/waitlist live under sibling `enrollments` roots.
  void queryClient.invalidateQueries({ queryKey: ENROLLMENT_PLACEMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ADMISSIONS_QUERY_KEY });
  // Roster membership gates exam eligibility and the marks roster.
  void queryClient.invalidateQueries({ queryKey: EXAMINATIONS_ELIGIBILITY_QUERY_KEY });
}
