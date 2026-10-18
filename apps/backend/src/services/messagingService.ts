import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";

/**
 * Thin re-export of the messaging use-cases facade.
 *
 * Kept for backward compatibility with existing importers (export service,
 * tests). New code should depend on
 * `messaging/use-cases/messagingUseCases.js` directly.
 */
export const loadMessageTemplates = messagingUseCases.loadMessageTemplates;
export const loadMessageTemplateById = messagingUseCases.loadMessageTemplateById;
export const loadMessageTemplatesByIds = messagingUseCases.loadMessageTemplatesByIds;
export const replaceMessageTemplates = messagingUseCases.replaceMessageTemplates;
export const getMessageTemplateById = messagingUseCases.getMessageTemplateById;
export const saveMessageTemplate = messagingUseCases.saveMessageTemplate;
export const removeMessageTemplate = messagingUseCases.removeMessageTemplate;
export const loadMessageLogs = messagingUseCases.loadMessageLogs;
export const loadMessageLogById = messagingUseCases.loadMessageLogById;
export const loadMessageLogsByIds = messagingUseCases.loadMessageLogsByIds;
export const saveMessageLog = messagingUseCases.saveMessageLog;
export const replaceMessageLogs = messagingUseCases.replaceMessageLogs;
export const loadFilteredMessageLogs = messagingUseCases.loadFilteredMessageLogs;
export const recordMessageLogs = messagingUseCases.recordMessageLogs;
export const clearAllMessageLogs = messagingUseCases.clearAllMessageLogs;
export const computeMessagingMetrics = messagingUseCases.computeMessagingMetrics;
export const resolveMessagingRecipients = messagingUseCases.resolveMessagingRecipients;
export const loadMessagingRecipients = messagingUseCases.loadMessagingRecipients;
export const matchMessagingRecipients = messagingUseCases.matchMessagingRecipients;
