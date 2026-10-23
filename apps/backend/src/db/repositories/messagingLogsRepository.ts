import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { messageTemplates, messageLogs } from "../schema.js";
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
      })
      .from(messageLogs)
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), isNull(messageLogs.deletedAt)))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => logRowToRecord(r as LogRow));
  });
}

export async function findMessageLogById(tenant: string, id: string): Promise<Message | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
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
        createdAt: messageLogs.createdAt,
        updatedAt: messageLogs.updatedAt,
      })
      .from(messageLogs)
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), eq(messageLogs.id, cleanId)))
      .limit(1);
    const row = rows[0];
    return row ? logRowToRecord(row as LogRow) : null;
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
  return withTenant(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted" || options?.includeDeleted === true;
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(messageLogs.deletedAt)
      : isAll
        ? null
        : isNull(messageLogs.deletedAt);

    const conditions = [
      eq(messageLogs.workspaceSubdomain, subdomain),
      inArray(messageLogs.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

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
        createdAt: messageLogs.createdAt,
        updatedAt: messageLogs.updatedAt,
      })
      .from(messageLogs)
      .where(and(...conditions));
    return rows.map((r) => logRowToRecord(r as LogRow));
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
    sentAt: record.sentAt,
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
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
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
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function deleteMessageLogsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(messageLogs).where(eq(messageLogs.workspaceSubdomain, subdomain));
    await tx.delete(messageTemplates).where(eq(messageTemplates.workspaceSubdomain, subdomain));
  });
}

/** Insert-only log write — never overwrite an existing dispatch audit row. */
export async function insertMessageLogs(
  workspaceSubdomain: string,
  logs: Message[],
): Promise<void> {
  if (logs.length === 0) return;
  const subdomain = workspaceSubdomain.trim().toLowerCase();

  const dedupedMap = new Map<string, Message>();
  for (const record of logs) {
    dedupedMap.set(String(record.id), record);
  }
  const uniqueLogs = Array.from(dedupedMap.values());

  const values = uniqueLogs.map((record) => mapMessageToInsertRow(record, subdomain));

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messageLogs)
      .values(values)
      .onConflictDoNothing({
        target: [messageLogs.workspaceSubdomain, messageLogs.id],
      });
  });
}
