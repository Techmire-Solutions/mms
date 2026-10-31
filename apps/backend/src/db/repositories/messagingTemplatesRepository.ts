import { and, eq, inArray, sql } from "drizzle-orm";
import { messageTemplates } from "../schema.js";
import { dedupeTrimmedIds, type MessageTemplate } from "@mms/shared";
import { withTenant } from "../tenant-context.js";

type TemplateRow = typeof messageTemplates.$inferSelect;

export function templateRowToRecord(row: TemplateRow): MessageTemplate {
  const template: MessageTemplate = {
    id: row.id,
    label: row.label,
    body: row.body,
    category: row.category as MessageTemplate["category"],
    channel: row.channel as MessageTemplate["channel"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.labelKey) template.labelKey = row.labelKey;

  return template;
}

export async function listMessageTemplatesByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<MessageTemplate[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: messageTemplates.id,
        workspaceSubdomain: messageTemplates.workspaceSubdomain,
        label: messageTemplates.label,
        labelKey: messageTemplates.labelKey,
        body: messageTemplates.body,
        category: messageTemplates.category,
        channel: messageTemplates.channel,
        createdAt: messageTemplates.createdAt,
        updatedAt: messageTemplates.updatedAt,
      })
      .from(messageTemplates)
      .where(eq(messageTemplates.workspaceSubdomain, subdomain))
      .orderBy(messageTemplates.id)
      .limit(limit)
      .offset(offset);
    return rows.map(templateRowToRecord);
  });
}

export async function findMessageTemplateById(
  tenant: string,
  id: string,
): Promise<MessageTemplate | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: messageTemplates.id,
        workspaceSubdomain: messageTemplates.workspaceSubdomain,
        label: messageTemplates.label,
        labelKey: messageTemplates.labelKey,
        body: messageTemplates.body,
        category: messageTemplates.category,
        channel: messageTemplates.channel,
        createdAt: messageTemplates.createdAt,
        updatedAt: messageTemplates.updatedAt,
      })
      .from(messageTemplates)
      .where(
        and(eq(messageTemplates.workspaceSubdomain, subdomain), eq(messageTemplates.id, cleanId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? templateRowToRecord(row) : null;
  });
}

export async function findMessageTemplatesByIds(
  tenant: string,
  ids: string[],
): Promise<MessageTemplate[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: messageTemplates.id,
        workspaceSubdomain: messageTemplates.workspaceSubdomain,
        label: messageTemplates.label,
        labelKey: messageTemplates.labelKey,
        body: messageTemplates.body,
        category: messageTemplates.category,
        channel: messageTemplates.channel,
        createdAt: messageTemplates.createdAt,
        updatedAt: messageTemplates.updatedAt,
      })
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.workspaceSubdomain, subdomain),
          inArray(messageTemplates.id, cleanIds),
        ),
      );
    return rows.map(templateRowToRecord);
  });
}

export function messageTemplateWriteValues(
  subdomain: string,
  record: MessageTemplate,
): typeof messageTemplates.$inferInsert {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    label: record.label,
    labelKey: record.labelKey ?? null,
    body: record.body,
    category: record.category ?? "general",
    channel: record.channel ?? "all",
    createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
    updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
  };
}

export async function saveMessageTemplate(tenant: string, record: MessageTemplate): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messageTemplates)
      .values(messageTemplateWriteValues(subdomain, record))
      .onConflictDoUpdate({
        target: [messageTemplates.workspaceSubdomain, messageTemplates.id],
        set: {
          label: sql`excluded.label`,
          labelKey: sql`excluded.label_key`,
          body: sql`excluded.body`,
          category: sql`excluded.category`,
          channel: sql`excluded.channel`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveMessageTemplates(
  tenant: string,
  records: MessageTemplate[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, MessageTemplate>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(messageTemplates)
      .values(uniqueRecords.map((record) => messageTemplateWriteValues(subdomain, record)))
      .onConflictDoUpdate({
        target: [messageTemplates.workspaceSubdomain, messageTemplates.id],
        set: {
          label: sql`excluded.label`,
          labelKey: sql`excluded.label_key`,
          body: sql`excluded.body`,
          category: sql`excluded.category`,
          channel: sql`excluded.channel`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceMessageTemplatesForWorkspace(
  tenant: string,
  records: MessageTemplate[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, MessageTemplate>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(messageTemplates).where(eq(messageTemplates.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx
        .insert(messageTemplates)
        .values(uniqueRecords.map((record) => messageTemplateWriteValues(subdomain, record)));
    }
  });
}

export async function deleteMessageTemplateById(tenant: string, id: string): Promise<boolean> {
  const cleanId = id?.trim();
  if (!cleanId) return false;
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await tx
      .delete(messageTemplates)
      .where(
        and(eq(messageTemplates.workspaceSubdomain, subdomain), eq(messageTemplates.id, cleanId)),
      );
    return true;
  });
}
