import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { messageLogs } from "../schema.js";
import { dedupeTrimmedIds, type Message, type RepositoryListOptions } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { mapAuditToInsert } from "./repositoryMappers.js";
import {
  logRowToRecord,
  mapMessageToInsertRow,
  type LogRow,
  type LogSelectRow,
} from "./messagingLogsMapper.js";

export { logRowToRecord, type LogRow, type LogSelectRow };

export type ListMessageLogsOptions = RepositoryListOptions;

/** `inArray` id fetches are chunked to bound the bind list (`mms-performance` §1). */
const MESSAGING_ID_BATCH_SIZE = 250;

export async function listMessageLogsByWorkspace(
  tenant: string,
  options?: ListMessageLogsOptions,
): Promise<Message[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 500);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: messageLogs.id,
        workspaceSubdomain: messageLogs.workspaceSubdomain,
        userId: messageLogs.userId,
        contactId: messageLogs.contactId,
        channel: messageLogs.channel,
        body: messageLogs.body,
        sentAt: messageLogs.sentAt,
        status: messageLogs.status,
        subject: messageLogs.subject,
        category: messageLogs.category,
        errorMessage: messageLogs.errorMessage,
        deletedAt: messageLogs.deletedAt,
        deletedBy: messageLogs.deletedBy,
        deletionReason: messageLogs.deletionReason,
        restoredAt: messageLogs.restoredAt,
        restoredBy: messageLogs.restoredBy,
        createdAt: messageLogs.createdAt,
        updatedAt: messageLogs.updatedAt,
      })
      .from(messageLogs)
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), isNull(messageLogs.deletedAt)))
      .orderBy(messageLogs.id)
      .limit(limit)
      .offset(offset);
    return rows.map((r) => logRowToRecord(r as LogRow));
  });
}

/**
 * Backup snapshot loader — every log row, including soft-archived ones.
 *
 * A workspace backup restores by hard-replacing this table
 * (`replaceMessageLogsForWorkspace` under `app.allow_hard_purge`), so an
 * active-only snapshot would silently destroy the 365-day archived window the
 * Reports tier offers to restore (`docs/soft-delete.md` §13.4). Ordered by `id`
 * so the streamed snapshot can page without gaps or duplicates.
 */
export async function listAllMessageLogsByWorkspace(
  tenant: string,
  options?: ListMessageLogsOptions,
): Promise<Message[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 250), 1000);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: messageLogs.id,
        workspaceSubdomain: messageLogs.workspaceSubdomain,
        userId: messageLogs.userId,
        contactId: messageLogs.contactId,
        channel: messageLogs.channel,
        body: messageLogs.body,
        sentAt: messageLogs.sentAt,
        status: messageLogs.status,
        subject: messageLogs.subject,
        category: messageLogs.category,
        errorMessage: messageLogs.errorMessage,
        deletedAt: messageLogs.deletedAt,
        deletedBy: messageLogs.deletedBy,
        deletionReason: messageLogs.deletionReason,
        restoredAt: messageLogs.restoredAt,
        restoredBy: messageLogs.restoredBy,
        createdAt: messageLogs.createdAt,
        updatedAt: messageLogs.updatedAt,
      })
      .from(messageLogs)
      .where(eq(messageLogs.workspaceSubdomain, subdomain))
      .orderBy(messageLogs.id)
      .limit(limit)
      .offset(offset);
    return rows.map((r) => logRowToRecord(r as LogRow));
  });
}

export async function findMessageLogsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Message[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const isDeletedOnly = options?.deleted === "deleted" || options?.includeDeleted === true;
  const isAll = options?.deleted === "all";
  return withTenant(subdomain, async (tx) => {
    const results: Message[] = [];
    for (let i = 0; i < cleanIds.length; i += MESSAGING_ID_BATCH_SIZE) {
      const chunk = cleanIds.slice(i, i + MESSAGING_ID_BATCH_SIZE);
      const conditions = [
        eq(messageLogs.workspaceSubdomain, subdomain),
        inArray(messageLogs.id, chunk),
      ];
      if (isDeletedOnly) {
        conditions.push(isNotNull(messageLogs.deletedAt));
      } else if (!isAll) {
        conditions.push(isNull(messageLogs.deletedAt));
      }

      const rows = await tx
        .select({
          id: messageLogs.id,
          workspaceSubdomain: messageLogs.workspaceSubdomain,
          userId: messageLogs.userId,
          contactId: messageLogs.contactId,
          channel: messageLogs.channel,
          body: messageLogs.body,
          sentAt: messageLogs.sentAt,
          status: messageLogs.status,
          subject: messageLogs.subject,
          category: messageLogs.category,
          errorMessage: messageLogs.errorMessage,
          deletedAt: messageLogs.deletedAt,
          deletedBy: messageLogs.deletedBy,
          deletionReason: messageLogs.deletionReason,
          restoredAt: messageLogs.restoredAt,
          restoredBy: messageLogs.restoredBy,
          createdAt: messageLogs.createdAt,
          updatedAt: messageLogs.updatedAt,
        })
        .from(messageLogs)
        .where(and(...conditions));
      results.push(...rows.map((r) => logRowToRecord(r as LogRow)));
    }
    return results;
  });
}

export function messageLogWriteValues(
  subdomain: string,
  record: Message,
): typeof messageLogs.$inferInsert {
  const audit = mapAuditToInsert(record);
  return {
    id: String(record.id),
    workspaceSubdomain: subdomain,
    userId: record.userId ?? "",
    contactId: String(record.contactId),
    channel: record.channel,
    body: record.body,
    sentAt: new Date(record.sentAt),
    status: record.status ?? "sent",
    subject: record.subject ?? null,
    category: record.category ?? "general",
    errorMessage: record.errorMessage ?? null,
    deletedAt: audit.deletedAt,
    deletedBy: audit.deletedBy,
    deletionReason: audit.deletionReason,
    createdAt: audit.createdAt ?? new Date(),
    updatedAt: audit.updatedAt,
  };
}

export async function saveMessageLog(tenant: string, record: Message): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messageLogs)
      .values(messageLogWriteValues(subdomain, record))
      .onConflictDoUpdate({
        target: [messageLogs.workspaceSubdomain, messageLogs.id],
        set: {
          userId: sql`excluded.user_id`,
          contactId: sql`excluded.contact_id`,
          channel: sql`excluded.channel`,
          body: sql`excluded.body`,
          sentAt: sql`excluded.sent_at`,
          status: sql`excluded.status`,
          subject: sql`excluded.subject`,
          category: sql`excluded.category`,
          errorMessage: sql`excluded.error_message`,
          // Soft-delete columns are intentionally NOT copied here: archive and
          // restore own that lifecycle (with attribution + audit). Copying them
          // made a content save able to resurrect a row unattributed.
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceMessageLogsForWorkspace(
  tenant: string,
  records: Message[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, Message>();
  for (const record of records) {
    dedupedMap.set(String(record.id), record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(messageLogs).where(eq(messageLogs.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(messageLogs)
        .values(uniqueRecords.map((record) => messageLogWriteValues(subdomain, record)));
    }
  });
}

export async function bulkSaveMessageLogs(tenant: string, records: Message[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, Message>();
  for (const record of records) {
    dedupedMap.set(String(record.id), record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messageLogs)
      .values(uniqueRecords.map((record) => messageLogWriteValues(subdomain, record)))
      .onConflictDoUpdate({
        target: [messageLogs.workspaceSubdomain, messageLogs.id],
        set: {
          userId: sql`excluded.user_id`,
          contactId: sql`excluded.contact_id`,
          channel: sql`excluded.channel`,
          body: sql`excluded.body`,
          sentAt: sql`excluded.sent_at`,
          status: sql`excluded.status`,
          subject: sql`excluded.subject`,
          category: sql`excluded.category`,
          errorMessage: sql`excluded.error_message`,
          // Soft-delete columns are intentionally NOT copied here: archive and
          // restore own that lifecycle (with attribution + audit). Copying them
          // made a content save able to resurrect a row unattributed.
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * Insert-only log write — never overwrite an existing dispatch audit row.
 * Returns the number of rows actually persisted.
 */
export async function insertMessageLogs(
  workspaceSubdomain: string,
  logs: Message[],
): Promise<number> {
  if (logs.length === 0) return 0;
  const subdomain = workspaceSubdomain.trim().toLowerCase();

  const dedupedMap = new Map<string, Message>();
  for (const record of logs) {
    dedupedMap.set(String(record.id), record);
  }
  const uniqueLogs = Array.from(dedupedMap.values());

  const values = uniqueLogs.map((record) => mapMessageToInsertRow(record, subdomain));

  return withTenant(subdomain, async (tx) => {
    const inserted = await tx
      .insert(messageLogs)
      .values(values)
      .onConflictDoNothing({
        target: [messageLogs.workspaceSubdomain, messageLogs.id],
      })
      .returning({ id: messageLogs.id });
    return inserted.length;
  });
}
