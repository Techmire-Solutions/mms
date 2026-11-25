import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import { invalidateContactsQueries } from "../host/contactsCollection";
import { getEnrollmentsQueryKey } from "../host/enrollmentsCollection";
import { getSessionsQueryKey } from "../host/sessionsCollection";
import {
  STUDENTS_FIELD_CONFIG_QUERY_KEY,
  STUDENTS_PREFERENCES_QUERY_KEY,
} from "./useStudentSetupConfig";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "./studentsQueryKeys";
import { STUDENTS_LOOKUPS_QUERY_KEY } from "./useStudentLookups";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: STUDENTS_QUERY_KEY,
  metrics: STUDENTS_METRICS_QUERY_KEY,
  widgetAggregates: STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: STUDENTS_PREFERENCES_QUERY_KEY,
  lookups: STUDENTS_LOOKUPS_QUERY_KEY,
  related: [STUDENTS_FIELD_CONFIG_QUERY_KEY],
});

/**
 * Invalidate Students list/metrics/setup/lookups Query keys (mutations + live push).
 * The backend reconciles contact-derived tags (`Student` / `Guardian`) on every
 * student write, so the Contacts caches must refresh alongside the student ones.
 */
export function invalidateStudentsQueries(queryClient: QueryClient): void {
  invalidateModuleQueries(queryClient);
  // Contact-derived tags still refresh; the student keys were invalidated above.
  invalidateContactsQueries(queryClient, { includeStudents: false });
}

/** Bulk enrollment also changes session rosters and Enrollment records. */
export function invalidateStudentsBulkEnrollQueries(queryClient: QueryClient): void {
  invalidateStudentsQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: getSessionsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getEnrollmentsQueryKey() });
}
