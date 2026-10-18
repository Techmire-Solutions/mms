import type { MessagingRepository } from "../repository/messagingRepository.js";
import { messagingRepository } from "../repository/messagingRepositoryAdapter.js";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import {
  loadContactsByIdsForTenant,
  loadContactsPageForTenant,
} from "../../services/contactService.js";
import {
  dedupeTrimmedIds,
  type MessageTemplate,
  type Message,
  type MessagingMetricsDto,
  type MessagingRecipientsQueryDto,
  type MessagingRecipientsMatchQueryDto,
  type MessagingRecipientsMatchResponseDto,
  type ContactsListPageResult,
  type StandardMessagingRecipient,
  MESSAGING_RECIPIENTS_MATCH_LIMIT,
  messageTemplateListSchema,
  messageLogListSchema,
  filterActiveContacts,
  toMessagingRecipient,
  getDisplayName,
  getPrimaryPhone,
  getPrimaryEmail,
} from "@mms/shared";
import type {
  MessageLogsFilterQuery,
  MessageLogsPageResult,
} from "../../db/repositories/messagingRepository.js";

const templateListSchema = messageTemplateListSchema;
const logListSchema = messageLogListSchema;
const MATCH_PAGE_SIZE = 500;

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

  const loadMessagingRecipients = async (
    workspaceSubdomain: string,
    query: MessagingRecipientsQueryDto,
  ): Promise<ContactsListPageResult> => {
    const subdomain = workspaceSubdomain.trim().toLowerCase();
    const role = query.role ?? "all";
    const gender = query.gender && query.gender !== "all" ? query.gender : undefined;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim() || undefined;

    const reachability = query.hasPhone
      ? { hasPhone: true as const }
      : query.hasEmail
        ? { hasEmail: true as const }
        : { hasReachable: true as const };

    const baseQuery = {
      page,
      limit: pageSize,
      search,
      gender,
      ...reachability,
    };

    if (role === "students") {
      return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "students" });
    }
    if (role === "faculty") {
      return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "faculty" });
    }
    if (role === "staff") {
      return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "staff" });
    }
    if (role === "contacts") {
      return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "unlinked" });
    }

    return loadContactsPageForTenant(subdomain, baseQuery);
  };

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

    /**
     * Resolve lean messaging recipients under messaging.read (not contacts.read).
     */
    resolveMessagingRecipients: async (
      workspaceSubdomain: string,
      ids: string[],
    ): Promise<StandardMessagingRecipient[]> => {
      if (ids.length === 0) return [];
      const subdomain = workspaceSubdomain.trim().toLowerCase();
      const found = await loadContactsByIdsForTenant(subdomain, ids);
      return filterActiveContacts(found).map((contact) =>
        toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
      );
    },

    loadMessagingRecipients,

    /**
     * Select-all reachable recipients — lean DTOs, server-capped (no FE page-walk).
     */
    matchMessagingRecipients: async (
      workspaceSubdomain: string,
      query: MessagingRecipientsMatchQueryDto,
    ): Promise<MessagingRecipientsMatchResponseDto> => {
      const limit = MESSAGING_RECIPIENTS_MATCH_LIMIT;
      const listQuery: MessagingRecipientsQueryDto = {
        role: query.role,
        gender: query.gender,
        search: query.search,
        page: 1,
        pageSize: MATCH_PAGE_SIZE,
        hasPhone: query.kind === "phone" ? true : undefined,
        hasEmail: query.kind === "email" ? true : undefined,
      };

      const recipients: StandardMessagingRecipient[] = [];
      let total = 0;
      let page = 1;
      let hasMore = true;

      while (hasMore && recipients.length < limit) {
        const result = await loadMessagingRecipients(workspaceSubdomain, {
          ...listQuery,
          page,
          pageSize: MATCH_PAGE_SIZE,
        });
        total = result.total;
        for (const contact of result.contacts) {
          if (recipients.length >= limit) break;
          recipients.push(
            toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
          );
        }
        hasMore = result.hasMore && recipients.length < limit;
        page += 1;
      }

      const truncated = total > recipients.length || (hasMore && recipients.length >= limit);
      return {
        recipients,
        total,
        truncated,
        limit,
      };
    },
  };
}

export const messagingUseCases = createMessagingUseCases();
