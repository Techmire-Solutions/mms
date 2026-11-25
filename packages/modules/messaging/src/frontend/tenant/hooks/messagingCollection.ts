/**
 * Cross-module public surface for Messaging Query keys / hooks.
 * Other features must import from here — not `@/tenant/features/messaging/hooks/*`.
 */
export { MESSAGING_CONTACTS_RESOLVE_QUERY_KEY } from "./useMessagingContactsByIds";
export { MESSAGING_RECIPIENTS_QUERY_KEY } from "./useMessagingWorkRecipients";
export { invalidateMessagingQueries } from "./invalidateMessagingQueries";
export {
  MESSAGING_TEMPLATES_QUERY_KEY,
  MESSAGING_LOGS_QUERY_KEY,
  MESSAGING_METRICS_QUERY_KEY,
  useMessageTemplates,
  useMessageLogs,
  useMessagingMetrics,
  useMessagingMutations,
} from "./useMessaging";
// Phase 7: contract-driven query option factories
export {
  messagingLogsListQueryOptions,
  messagingCommandMetricsQueryOptions,
} from "./useMessagingQueries";

export {
  useMessagingPreferencesQuery,
  useMessagingPreferencesMutation,
  MESSAGING_PREFERENCES_QUERY_KEY,
} from "./useMessagingSetupConfig";

export { MESSAGING_CHANNEL_CONFIG, type MessagingChannelConfig } from "../config";
export {
  exportMessagingLogsFiltered,
  messagingExportEndDateBound,
} from "../lib/messagingReportsExport";
