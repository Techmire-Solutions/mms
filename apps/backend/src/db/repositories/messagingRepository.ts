/** Messaging repository public surface — templates, logs, queries, metrics. */
export {
  templateRowToRecord,
  listMessageTemplatesByWorkspace,
  findMessageTemplateById,
  findMessageTemplatesByIds,
  saveMessageTemplate,
  bulkSaveMessageTemplates,
  replaceMessageTemplatesForWorkspace,
  deleteMessageTemplateById,
} from "./messagingTemplatesRepository.js";
export {
  logRowToRecord,
  listMessageLogsByWorkspace,
  findMessageLogsByIds,
  saveMessageLog,
  replaceMessageLogsForWorkspace,
  bulkSaveMessageLogs,
  insertMessageLogs,
} from "./messagingLogsRepository.js";
export type {
  MessageLogsFilterQuery,
  MessageLogsPageResult,
  MessagingMetricsFilterQuery,
} from "./messagingLogsQueryRepository.js";
export { queryFilteredMessageLogs, queryMessagingMetrics } from "./messagingLogsQueryRepository.js";
export {
  softDeleteActiveMessageLogs,
  restoreArchivedMessageLog,
  buildMessageLogClaimId,
  claimMessageLogForDelivery,
  updateMessageLogDeliveryStatus,
  saveMessageLogDeliveryOutcomes,
  STALE_MESSAGE_LOG_CLAIM_MS,
} from "./messagingLogsMutationRepository.js";
export type {
  MessageLogClaim,
  MessageLogDeliveryOutcome,
} from "./messagingLogsMutationRepository.js";
