import type { MessageTemplate, Message, MessagingMetricsDto } from "@mms/shared";
import type {
  MessageLogsFilterQuery,
  MessageLogsPageResult,
} from "../../db/repositories/messagingRepository.js";

/**
 * Sole storage gateway for the messaging module (templates + logs).
 *
 * Mirrors the `contacts`/`sessions`/`enrollments`/`finance`/`attendance`/`hasanat`/
 * `questionBank`/`examinations`/`obligations`/`accounting` reference pattern:
 * routes and use-cases depend on this interface (never on Drizzle directly), and
 * the Drizzle-backed adapter is the only implementation. Tests can inject a fake
 * repository at the seam.
 */
export interface MessagingRepository {
  // Templates
  listMessageTemplatesByWorkspace(tenant: string): Promise<MessageTemplate[]>;
  findMessageTemplateById(tenant: string, id: string): Promise<MessageTemplate | null>;
  findMessageTemplatesByIds(tenant: string, ids: string[]): Promise<MessageTemplate[]>;
  saveMessageTemplate(tenant: string, record: MessageTemplate): Promise<void>;
  bulkSaveMessageTemplates(tenant: string, records: MessageTemplate[]): Promise<void>;
  replaceMessageTemplatesForWorkspace(tenant: string, records: MessageTemplate[]): Promise<void>;
  deleteMessageTemplateById(tenant: string, id: string): Promise<boolean>;

  // Logs
  listMessageLogsByWorkspace(tenant: string): Promise<Message[]>;
  findMessageLogById(tenant: string, id: string): Promise<Message | null>;
  findMessageLogsByIds(
    tenant: string,
    ids: string[],
    options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
  ): Promise<Message[]>;
  saveMessageLog(tenant: string, record: Message): Promise<void>;
  bulkSaveMessageLogs(tenant: string, records: Message[]): Promise<void>;
  replaceMessageLogsForWorkspace(tenant: string, records: Message[]): Promise<void>;
  insertMessageLogs(tenant: string, logs: Message[]): Promise<void>;
  queryFilteredMessageLogs(
    tenant: string,
    query?: MessageLogsFilterQuery,
  ): Promise<MessageLogsPageResult>;
  queryMessagingMetrics(
    tenant: string,
    filters?: { startDate?: string; endDate?: string },
  ): Promise<MessagingMetricsDto>;
  softDeleteActiveMessageLogs(tenant: string): Promise<void>;
}
