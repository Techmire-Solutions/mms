/**
 * Cross-module public surface for Messaging Query keys / hooks.
 * Other features must import from here — not `@/tenant/features/messaging/hooks/*`.
 */
export { MESSAGING_CONTACTS_RESOLVE_QUERY_KEY } from "@/tenant/features/messaging/hooks/useMessagingContactsByIds";
export { MESSAGING_RECIPIENTS_QUERY_KEY } from "@/tenant/features/messaging/hooks/useMessagingWorkRecipients";
export { invalidateMessagingQueries } from "@/tenant/features/messaging/hooks/invalidateMessagingQueries";
export {
  MESSAGING_TEMPLATES_QUERY_KEY,
  MESSAGING_LOGS_QUERY_KEY,
  MESSAGING_METRICS_QUERY_KEY,
  useMessageTemplates,
  useMessageLogs,
  useMessagingMetrics,
  useMessagingMutations,
} from "@/hooks/useMessaging";
// Phase 7: contract-driven query option factories
export {
  messagingLogsListQueryOptions,
  messagingCommandMetricsQueryOptions,
} from "@/tenant/features/messaging/hooks/useMessagingQueries";

export {
  useMessagingPreferencesQuery,
  useMessagingPreferencesMutation,
  MESSAGING_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/messaging/hooks/useMessagingSetupConfig";

export {
  MESSAGING_CHANNEL_CONFIG,
  type MessagingChannelConfig,
} from "@/tenant/features/messaging/config";
export {
  exportMessagingLogsFiltered,
  messagingExportEndDateBound,
} from "@/tenant/features/messaging/lib/messagingReportsExport";
