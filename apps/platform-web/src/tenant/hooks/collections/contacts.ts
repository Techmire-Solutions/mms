/**
 * Cross-module public surface for Contacts Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/contacts/hooks/*`.
 * Prefer paginated / by-id / metrics APIs.
 */
export {
  CONTACTS_QUERY_KEY,
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
  contactsCommandMetricsQueryOptions,
  useContactById,
  useContactsByIds,
  useContactPickerSearch,
  useContactPickerOption,
  useContactMutations,
  useContactsMetrics,
  useContactsReportAnalytics,
  useContactsWidgetAggregates,
  useContactsSavedReportsSource,
  useContactColumnPrefs,
  useContactColumnPrefsMutation,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContacts";
export {
  CONTACTS_LOOKUPS_QUERY_KEY,
  useContactLookupsQuery,
  useContactLookupMutation,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContactLookups";
export { invalidateContactsQueries } from "@mms/mod-contacts/frontend/tenant/hooks/invalidateContactsQueries";
// Contract-driven tsrClient hooks & query factories
export {
  contactsListQueryOptions,
  useContactsContractList,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContactsQueries";
