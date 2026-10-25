import type { MessagingRepository } from "./messagingRepository.js";
import {
  listMessageTemplatesByWorkspace,
  findMessageTemplateById,
  findMessageTemplatesByIds,
  saveMessageTemplate,
  replaceMessageTemplatesForWorkspace,
  bulkSaveMessageTemplates,
  deleteMessageTemplateById,
  listMessageLogsByWorkspace,
  findMessageLogById,
  findMessageLogsByIds,
  saveMessageLog,
  bulkSaveMessageLogs,
  replaceMessageLogsForWorkspace,
  insertMessageLogs,
  queryFilteredMessageLogs,
  queryMessagingMetrics,
  softDeleteActiveMessageLogs,
  restoreArchivedMessageLog,
} from "../../db/repositories/messagingRepository.js";
import {
  getWhatsappIntegrationRow,
  upsertWhatsappIntegrationConfigRow,
  upsertWhatsappIntegrationSecretsRow,
} from "../../db/repositories/whatsappIntegrationRepository.js";

/**
 * Drizzle-backed adapter for {@link MessagingRepository}. Delegates to the
 * existing concrete repository functions (no SQL rewrite in this pass).
 */
export const messagingRepository: MessagingRepository = {
  listMessageTemplatesByWorkspace,
  findMessageTemplateById,
  findMessageTemplatesByIds,
  saveMessageTemplate,
  bulkSaveMessageTemplates,
  replaceMessageTemplatesForWorkspace,
  deleteMessageTemplateById,
  listMessageLogsByWorkspace,
  findMessageLogById,
  findMessageLogsByIds,
  saveMessageLog,
  bulkSaveMessageLogs,
  replaceMessageLogsForWorkspace,
  insertMessageLogs,
  queryFilteredMessageLogs,
  queryMessagingMetrics,
  softDeleteActiveMessageLogs,
  restoreArchivedMessageLog,
  getWhatsappIntegrationRow,
  upsertWhatsappIntegrationConfigRow,
  upsertWhatsappIntegrationSecretsRow,
};
