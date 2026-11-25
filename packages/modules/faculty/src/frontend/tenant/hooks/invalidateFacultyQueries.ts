import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import { contactsQueryKey } from "../crossModuleKeys.js";
import {
  FACULTY_DETAIL_QUERY_KEY,
  FACULTY_METRICS_QUERY_KEY,
  FACULTY_QUERY_KEY,
  FACULTY_WIDGET_AGGREGATES_QUERY_KEY,
} from "./facultyQueryKeys";
import { FACULTY_PREFERENCES_QUERY_KEY } from "./useFacultySetupConfig";
import { FACULTY_LOOKUPS_QUERY_KEY } from "./useFacultyLookups";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: FACULTY_QUERY_KEY,
  // Detail-scoped caches (designation assignments) do not nest under the list key.
  lists: [FACULTY_DETAIL_QUERY_KEY],
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
 * We invalidate contactsQueryKey() directly rather than calling invalidateContactsQueries
 * to prevent cascading invalidation into studentsQueryKey() and messaging caches.
 */
export function invalidateFacultyQueries(queryClient: QueryClient): void {
  invalidateModuleQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: contactsQueryKey() });
}
