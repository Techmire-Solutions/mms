import type { Message } from "@mms/shared";
import type { messageLogs } from "../schema.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

export type LogRow = typeof messageLogs.$inferSelect;
/** Row shape accepted by logRowToRecord — purgeAfter is DB-only generated column, not surfaced to app layer. */
export type LogSelectRow = Omit<LogRow, "purgeAfter">;
export type MessageLogInsertValue = typeof messageLogs.$inferInsert;

export function logRowToRecord(row: LogSelectRow): Message {
  const message: Message = {
    id: row.id,
    userId: row.userId,
    contactId: row.contactId,
    channel: row.channel as Message["channel"],
    body: row.body,
    sentAt: row.sentAt,
    status: row.status as Message["status"],
    category: row.category as Message["category"],
    ...mapAuditTimestamps(row),
  };

  if (row.subject) message.subject = row.subject;
  if (row.errorMessage) message.errorMessage = row.errorMessage;

  return message;
}

export function mapMessageToInsertRow(record: Message, subdomain: string): MessageLogInsertValue {
  const id = String(record.id);
  return {
    id,
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
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
    updatedAt: new Date(),
  };
}
