import type { QueryClient } from "@tanstack/react-query";
import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  CONTACTS_QUERY_KEY,
  CONTACTS_DUPLICATES_QUERY_KEY,
  CONTACTS_GOOGLE_SYNC_QUERY_KEY,
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_REPORT_ANALYTICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { CONTACTS_LOOKUPS_QUERY_KEY } from "@/tenant/features/contacts/hooks/useContactLookups";
import {
  MESSAGING_CONTACTS_RESOLVE_QUERY_KEY,
  MESSAGING_RECIPIENTS_QUERY_KEY,
} from "@/tenant/hooks/collections/messaging";

import { CONTACTS_PREFERENCES_QUERY_KEY } from "@/tenant/features/contacts/hooks/useContactSetupConfig";

const invalidateModuleQueries = createModuleQueryInvalidator({
  list: CONTACTS_QUERY_KEY,
  metrics: CONTACTS_METRICS_QUERY_KEY,
  widgetAggregates: CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
  preferences: CONTACTS_PREFERENCES_QUERY_KEY,
  lookups: CONTACTS_LOOKUPS_QUERY_KEY,
});

/** Invalidate Contacts + messaging hydrate Query keys (mutations + live push). */
export function invalidateContactsQueries(queryClient: QueryClient): void {
  invalidateModuleQueries(queryClient);
  void queryClient.invalidateQueries({ queryKey: CONTACTS_REPORT_ANALYTICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: CONTACTS_DUPLICATES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: CONTACTS_GOOGLE_SYNC_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_CONTACTS_RESOLVE_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_RECIPIENTS_QUERY_KEY });
}
