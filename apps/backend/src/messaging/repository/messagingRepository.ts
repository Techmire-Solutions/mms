import type {
  MessageTemplate,
  Message,
  MessagingMetricsDto,
  WhatsappIntegrationConfig,
  WhatsappIntegrationSecrets,
} from "@mms/shared";
import type {
  MessageLogClaim,
  MessageLogsFilterQuery,
  MessageLogsPageResult,
} from "../../db/repositories/messagingRepository.js";
import type { WhatsappIntegrationRow } from "../../db/schema/messaging.js";

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
  /** Restores archived logs (`ids: null` = restore all); returns the restored count. */
  restoreArchivedMessageLog(tenant: string, userId: string, ids: string[] | null): Promise<number>;
  /** Atomically claims one campaign recipient before the gateway send. */
  claimMessageLogForDelivery(tenant: string, claim: MessageLogClaim): Promise<boolean>;
  /** Persists a campaign delivery outcome per recipient. */
  updateMessageLogDeliveryStatus(
    tenant: string,
    id: string,
    status: "sent" | "failed",
    errorMessage?: string | null,
  ): Promise<void>;

  // WhatsApp Integrations
  getWhatsappIntegrationRow(tenant: string): Promise<WhatsappIntegrationRow | null>;
  upsertWhatsappIntegrationConfigRow(
    tenant: string,
    config: WhatsappIntegrationConfig,
  ): Promise<void>;
  upsertWhatsappIntegrationSecretsRow(
    tenant: string,
    secrets: WhatsappIntegrationSecrets,
  ): Promise<void>;
}
