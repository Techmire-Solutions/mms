import type { QueryClient } from "@tanstack/react-query";
import { invalidateEnrollmentsQueries } from "../host/invalidation.js";
import { invalidateSessionsQueries } from "../host/invalidation.js";
import { invalidateStudentsQueries } from "../host/invalidation.js";
import { invalidateFinanceQueries } from "../host/invalidation.js";
import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@mms/fe-core/query/dashboardQueryKeys";
import { DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY } from "@mms/fe-core/query/dynamicWidgetAggregatesQueryKey";
import {
  invalidateRegistrationQueries,
  PUBLIC_REGISTRATION_QUERY_KEY,
} from "../hooks/registrationQueries.js";
import { getEnrollmentPlacementsQueryKey } from "../host/invalidation.js";

export interface EnrollmentImpactOptions {
  /** Enrollment list/detail/metrics/widgets/report caches (default true). */
  enrollments?: boolean;
  /** Student directory + `enrolledSessions` (schedule) caches (default true). */
  students?: boolean;
  /** Session list/detail + class/section seat counts and rosters (default true). */
  sessions?: boolean;
  /** Placement history of the affected enrollment (default false). */
  placements?: boolean;
  /** Invoices cancelled/reviewed by a withdrawal (default false). */
  finance?: boolean;
  /** Admissions list/metrics/waitlist offers (default false). */
  admissions?: boolean;
  /** Dashboard summary + dynamic report widgets (default true). */
  dashboard?: boolean;
}

/**
 * Fan-out for an enrollment write.
 *
 * The realtime dispatcher already refreshes students + sessions + dashboard when an
 * `enrollments` event arrives; local mutations used to refresh only the enrollment family,
 * leaving seat counts and student schedules stale until a manual reload. Every write path
 * calls this instead of `invalidateEnrollmentsQueries` directly.
 */
export function invalidateEnrollmentImpacts(
  queryClient: QueryClient,
  options: EnrollmentImpactOptions = {},
): void {
  const {
    enrollments = true,
    students = true,
    sessions = true,
    placements = false,
    finance = false,
    admissions = false,
    dashboard = true,
  } = options;

  if (enrollments) invalidateEnrollmentsQueries(queryClient);
  if (students) invalidateStudentsQueries(queryClient);
  if (sessions) invalidateSessionsQueries(queryClient);
  if (placements)
    void queryClient.invalidateQueries({ queryKey: getEnrollmentPlacementsQueryKey() });
  if (finance) invalidateFinanceQueries(queryClient);
  if (admissions) {
    invalidateRegistrationQueries(queryClient);
    void queryClient.invalidateQueries({ queryKey: PUBLIC_REGISTRATION_QUERY_KEY });
  }
  if (dashboard) {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
    void queryClient.invalidateQueries({ queryKey: DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY });
  }
}
