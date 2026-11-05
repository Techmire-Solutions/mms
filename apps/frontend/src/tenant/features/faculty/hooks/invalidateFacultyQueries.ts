import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import { invalidateContactsQueries } from "@/tenant/hooks/collections/contacts";
import {
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/faculty/hooks/facultyQueryKeys";
import { FACULTY_PREFERENCES_QUERY_KEY } from "@/tenant/features/faculty/hooks/useFacultySetupConfig";
import { FACULTY_LOOKUPS_QUERY_KEY } from "@/tenant/features/faculty/hooks/useFacultyLookups";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: FACULTY_QUERY_KEY,
  metrics: FACULTY_METRICS_QUERY_KEY,
  widgetAggregates: FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: FACULTY_PREFERENCES_QUERY_KEY,
  lookups: FACULTY_LOOKUPS_QUERY_KEY,
});

/**
 * Invalidate Faculty list/metrics/setup/lookups Query keys (mutations + live push).
 * The backend reconciles contact-derived tags (`Faculty`) on every faculty write
 * (`reconcileContactSystemTags`), and the reconciler emits no live event of its
 * own, so the Contacts caches must refresh alongside the faculty ones.
 */
export function invalidateFacultyQueries(queryClient: QueryClient): void {
  invalidateModuleQueries(queryClient);
  invalidateContactsQueries(queryClient);
}
