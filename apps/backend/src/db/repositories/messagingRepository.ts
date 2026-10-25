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
  findMessageLogById,
  findMessageLogsByIds,
  saveMessageLog,
  replaceMessageLogsForWorkspace,
  bulkSaveMessageLogs,
  deleteMessageLogsByWorkspace,
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
} from "./messagingLogsMutationRepository.js";
