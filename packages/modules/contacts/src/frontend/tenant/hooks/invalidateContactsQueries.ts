import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@mms/fe-core/query/createModuleQueryInvalidator";
import {
  CONTACTS_QUERY_KEY,
  CONTACTS_DUPLICATES_QUERY_KEY,
  CONTACTS_GOOGLE_SYNC_QUERY_KEY,
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_REPORT_ANALYTICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "./contactsQueryKeys.js";
import { CONTACTS_LOOKUPS_QUERY_KEY } from "./useContactLookups.js";
import { CONTACTS_PREFERENCES_QUERY_KEY } from "./useContactSetupConfig.js";
import { getContactsCrossModuleQueryKeys } from "@mms/mod-contacts/frontend/tenant/crossModuleQueryKeys";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: CONTACTS_QUERY_KEY,
  metrics: CONTACTS_METRICS_QUERY_KEY,
  widgetAggregates: CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: CONTACTS_PREFERENCES_QUERY_KEY,
  lookups: CONTACTS_LOOKUPS_QUERY_KEY,
});

/**
 * Invalidate Contacts + messaging hydrate Query keys (mutations + live push).
 *
 * `includeStudents` defaults to `true` because contact writes feed student
 * guardian/father/mother names. The Students invalidator passes `false`: it has
 * already invalidated the student keys, so the echo would refetch them twice.
 */
export function invalidateContactsQueries(
  queryClient: QueryClient,
  options?: { includeStudents?: boolean },
): void {
  const crossKeys = getContactsCrossModuleQueryKeys();
  invalidateModuleQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: CONTACTS_REPORT_ANALYTICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: CONTACTS_DUPLICATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: CONTACTS_GOOGLE_SYNC_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: crossKeys.messagingContactsResolve });
  void queryClient.invalidateQueries({ queryKey: crossKeys.messagingRecipients });
  if (options?.includeStudents !== false) {
    // Student rows derive guardian/father/mother names from contact records.
    void queryClient.invalidateQueries({ queryKey: crossKeys.students });
    void queryClient.invalidateQueries({ queryKey: crossKeys.studentsMetrics });
  }
}
