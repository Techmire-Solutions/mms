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
  findMessageLogsByIds,
  saveMessageLog,
  bulkSaveMessageLogs,
  replaceMessageLogsForWorkspace,
  insertMessageLogs,
  queryFilteredMessageLogs,
  queryMessagingMetrics,
  softDeleteActiveMessageLogs,
  restoreArchivedMessageLog,
  claimMessageLogForDelivery,
  updateMessageLogDeliveryStatus,
  saveMessageLogDeliveryOutcomes,
} from "./db/messagingRepository.js";
import {
  getWhatsappIntegrationRow,
  upsertWhatsappIntegrationConfigRow,
  upsertWhatsappIntegrationSecretsRow,
} from "./db/whatsappIntegrationRepository.js";
import {
  loadMessagingPreferences,
  saveMessagingPreferences,
} from "./db/messagingPreferencesRepository.js";

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
  findMessageLogsByIds,
  saveMessageLog,
  bulkSaveMessageLogs,
  replaceMessageLogsForWorkspace,
  insertMessageLogs,
  queryFilteredMessageLogs,
  queryMessagingMetrics,
  softDeleteActiveMessageLogs,
  restoreArchivedMessageLog,
  claimMessageLogForDelivery,
  updateMessageLogDeliveryStatus,
  saveMessageLogDeliveryOutcomes,
  getWhatsappIntegrationRow,
  upsertWhatsappIntegrationConfigRow,
  upsertWhatsappIntegrationSecretsRow,
  loadMessagingPreferences,
  saveMessagingPreferences,
};
