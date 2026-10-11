export {
  CONTACTS_QUERY_KEY,
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
  CONTACTS_DUPLICATES_QUERY_KEY,
  contactDetailQueryKey,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";

export {
  fetchContactById,
  useContactById,
  useContactsByIds,
} from "@/tenant/features/contacts/hooks/useContactsListQueries";

export {
  contactsCommandMetricsQueryOptions,
  useContactsMetrics,
  useContactsReportAnalytics,
  useContactsWidgetAggregates,
  useContactsDuplicatePairs,
} from "@/tenant/features/contacts/hooks/useContactsAnalyticsQueries";

export {
  useContactGoogleSyncConfig,
  useContactGoogleSyncMutations,
} from "@/tenant/features/contacts/hooks/useContactGoogleSyncQueries";

export {
  useContactColumnPrefs,
  useContactColumnPrefsMutation,
  useContactsSavedReportsSource,
} from "@/tenant/features/contacts/hooks/useContactPrefsQueries";
