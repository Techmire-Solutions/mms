import type { MessagingRepository } from "../repository/messagingRepository.js";
import { messagingRepository } from "../repository/messagingRepositoryAdapter.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import {
  dedupeTrimmedIds,
  type MessageTemplate,
  type Message,
  type MessagingMetricsDto,
  messageTemplateListSchema,
  messageLogListSchema,
} from "@mms/shared";
import type {
  MessageLogsFilterQuery,
  MessageLogsPageResult,
} from "../../db/repositories/messagingRepository.js";
import {
  loadMessagingRecipients,
  resolveMessagingRecipients,
  matchMessagingRecipients,
} from "./messagingRecipientUseCases.js";

const templateListSchema = messageTemplateListSchema;
const logListSchema = messageLogListSchema;

/**
 * Messaging use-cases — composition root binding a {@link MessagingRepository}
 * to every operation. Production uses the default Drizzle-backed
 * `messagingUseCases`; tests can pass a fake repository to exercise
 * orchestration in isolation.
 */
export function createMessagingUseCases(repo: MessagingRepository = messagingRepository) {
  const templateBulkService = defineTenantBulkCollectionService<MessageTemplate>(
    {
      listByWorkspace: repo.listMessageTemplatesByWorkspace,
      replaceForWorkspace: repo.replaceMessageTemplatesForWorkspace,
    },
    templateListSchema,
    "message_templates",
  );

  const logBulkService = defineTenantBulkCollectionService<Message>(
    {
      listByWorkspace: repo.listMessageLogsByWorkspace,
      replaceForWorkspace: repo.replaceMessageLogsForWorkspace,
    },
    logListSchema,
    "message_logs",
  );

  return {
    loadMessageTemplates: templateBulkService.load,
    loadMessageTemplateById: async (id: string): Promise<MessageTemplate | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findMessageTemplateById(tenant, cleanId);
    },
    loadMessageTemplatesByIds: async (ids: string[]): Promise<MessageTemplate[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findMessageTemplatesByIds(tenant, cleanIds);
    },
    replaceMessageTemplates: templateBulkService.replace,

    getMessageTemplateById: async (
      workspaceSubdomain: string,
      templateId: string,
    ): Promise<MessageTemplate | null> => {
      const cleanId = templateId?.trim();
      const cleanTenant = workspaceSubdomain?.trim().toLowerCase();
      if (!cleanTenant || !cleanId) return null;
      return repo.findMessageTemplateById(cleanTenant, cleanId);
    },

    saveMessageTemplate: async (
      workspaceSubdomainOrRecord: string | MessageTemplate,
      templateOrUndefined?: MessageTemplate,
    ): Promise<MessageTemplate> => {
      let tenant: string | null;
      let record: MessageTemplate;
      if (typeof workspaceSubdomainOrRecord === "string") {
        tenant = workspaceSubdomainOrRecord.trim().toLowerCase();
        record = templateOrUndefined!;
      } else {
        tenant = getRequestTenant();
        record = workspaceSubdomainOrRecord;
      }
      if (!tenant) throw new Error("Tenant context required");
      await repo.saveMessageTemplate(tenant, record);
      await broadcastCollection("message_templates");
      return record;
    },

    removeMessageTemplate: async (
      workspaceSubdomain: string,
      templateId: string,
    ): Promise<void> => {
      const cleanId = templateId?.trim();
      const cleanTenant = workspaceSubdomain?.trim().toLowerCase();
      if (!cleanTenant || !cleanId) return;
      await repo.deleteMessageTemplateById(cleanTenant, cleanId);
      await broadcastCollection("message_templates");
    },

    loadMessageLogs: logBulkService.load,
    loadMessageLogById: async (id: string, includeDeleted = false): Promise<Message | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      const log = await repo.findMessageLogById(tenant, cleanId);
      if (!log) return null;
      if (!includeDeleted && log.deletedAt) return null;
      if (includeDeleted && !log.deletedAt) return null;
      return log;
    },
    loadMessageLogsByIds: async (ids: string[], includeDeleted = false): Promise<Message[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findMessageLogsByIds(tenant, cleanIds, { includeDeleted });
    },
    saveMessageLog: async (record: Message): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await repo.saveMessageLog(tenant, record);
      await broadcastCollection("message_logs");
    },
    replaceMessageLogs: logBulkService.replace,

    loadFilteredMessageLogs: async (
      workspaceSubdomain?: string,
      query?: MessageLogsFilterQuery,
    ): Promise<MessageLogsPageResult> => {
      if (!workspaceSubdomain) {
        return {
          logs: [],
          total: 0,
          page: 1,
          pageSize: 50,
          hasMore: false,
        };
      }
      return repo.queryFilteredMessageLogs(workspaceSubdomain, query ?? {});
    },

    /** Insert-only dispatch audit — never upsert/overwrite existing log rows. */
    recordMessageLogs: async (workspaceSubdomain: string, logs: Message[]): Promise<Message[]> => {
      if (!logs || logs.length === 0) return [];
      await repo.insertMessageLogs(workspaceSubdomain, logs);
      await broadcastCollection("message_logs");
      return logs;
    },

    /** Soft-deletes all active message logs for the workspace (sets deletedAt). */
    clearAllMessageLogs: async (workspaceSubdomain: string): Promise<void> => {
      await repo.softDeleteActiveMessageLogs(workspaceSubdomain);
      await broadcastCollection("message_logs");
    },

    computeMessagingMetrics: async (
      workspaceSubdomain?: string,
      filters?: { startDate?: string; endDate?: string },
    ): Promise<MessagingMetricsDto> => {
      if (!workspaceSubdomain) {
        return {
          total: 0,
          smsCount: 0,
          whatsappCount: 0,
          emailCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          skippedCount: 0,
          queuedCount: 0,
          successRate: 100,
          categoryBreakdown: {
            general: 0,
            academic: 0,
            financial: 0,
            attendance: 0,
            emergency: 0,
          },
        };
      }
      return repo.queryMessagingMetrics(workspaceSubdomain, filters);
    },

    resolveMessagingRecipients,
    loadMessagingRecipients,
    matchMessagingRecipients,
  };
}

export const messagingUseCases = createMessagingUseCases();
