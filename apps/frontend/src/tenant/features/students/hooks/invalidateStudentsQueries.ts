import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import { invalidateContactsQueries } from "@/tenant/hooks/collections/contacts";
import { ENROLLMENTS_QUERY_KEY } from "@/tenant/hooks/collections/enrollments";
import { SESSIONS_QUERY_KEY } from "@/tenant/hooks/collections/sessions";
import { STUDENTS_PREFERENCES_QUERY_KEY } from "@/tenant/features/students/hooks/useStudentSetupConfig";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/students/hooks/studentsQueryKeys";
import { STUDENTS_LOOKUPS_QUERY_KEY } from "@/tenant/features/students/hooks/useStudentLookups";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: STUDENTS_QUERY_KEY,
  metrics: STUDENTS_METRICS_QUERY_KEY,
  widgetAggregates: STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: STUDENTS_PREFERENCES_QUERY_KEY,
  lookups: STUDENTS_LOOKUPS_QUERY_KEY,
});

/**
 * Invalidate Students list/metrics/setup/lookups Query keys (mutations + live push).
 * The backend reconciles contact-derived tags (`Student` / `Guardian`) on every
 * student write, so the Contacts caches must refresh alongside the student ones.
 */
export function invalidateStudentsQueries(queryClient: QueryClient): void {
  invalidateModuleQueries(queryClient);
  invalidateContactsQueries(queryClient);
}

/** Bulk enrollment also changes session rosters and Enrollment records. */
export function invalidateStudentsBulkEnrollQueries(queryClient: QueryClient): void {
  invalidateStudentsQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
}
