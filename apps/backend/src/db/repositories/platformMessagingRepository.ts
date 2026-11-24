import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import type {
  PlatformMessageDto,
  PlatformMessageRecipient,
  PlatformMessageTemplateDto,
} from "@mms/shared";
import { platformMessages, platformMessageTemplates } from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { randomUUID } from "node:crypto";

const messageColumns = {
  id: platformMessages.id,
  channel: platformMessages.channel,
  subject: platformMessages.subject,
  body: platformMessages.body,
  status: platformMessages.status,
  recipientSnapshot: platformMessages.recipientSnapshot,
  scheduledAt: platformMessages.scheduledAt,
  sentAt: platformMessages.sentAt,
  createdAt: platformMessages.createdAt,
  updatedAt: platformMessages.updatedAt,
  deletedAt: platformMessages.deletedAt,
};

const templateColumns = {
  id: platformMessageTemplates.id,
  name: platformMessageTemplates.name,
  channel: platformMessageTemplates.channel,
  subject: platformMessageTemplates.subject,
  body: platformMessageTemplates.body,
  createdAt: platformMessageTemplates.createdAt,
  updatedAt: platformMessageTemplates.updatedAt,
};

function toMessageDto(row: typeof platformMessages.$inferSelect): PlatformMessageDto {
  return {
    id: row.id,
    channel: row.channel as PlatformMessageDto["channel"],
    subject: row.subject ?? null,
    body: row.body,
    status: row.status as PlatformMessageDto["status"],
    recipientSnapshot: (row.recipientSnapshot ?? []) as PlatformMessageRecipient[],
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTemplateDto(
  row: typeof platformMessageTemplates.$inferSelect,
): PlatformMessageTemplateDto {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel as PlatformMessageTemplateDto["channel"],
    subject: row.subject ?? null,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlatformMessages(filters: {
  channel?: string;
  status?: string;
  limit: number;
  offset: number;
  includeDeleted?: boolean;
}): Promise<PlatformMessageDto[]> {
  return withGlobalTenant(async (tx) => {
    const conditions = filters.includeDeleted ? [] : [isNull(platformMessages.deletedAt)];
    if (filters.channel) conditions.push(eq(platformMessages.channel, filters.channel));
    if (filters.status) conditions.push(eq(platformMessages.status, filters.status));
    const rows = await tx
      .select(messageColumns)
      .from(platformMessages)
      .where(and(...conditions))
      .orderBy(platformMessages.createdAt)
      .limit(filters.limit)
      .offset(filters.offset);
    return rows.map(toMessageDto);
  });
}

export async function insertPlatformMessage(input: {
  channel: string;
  subject?: string | null;
  body: string;
  recipientSnapshot: PlatformMessageRecipient[];
  scheduledAt?: string | null;
}): Promise<PlatformMessageDto> {
  const id = randomUUID();
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .insert(platformMessages)
      .values({
        id,
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
        status: "queued",
        recipientSnapshot: input.recipientSnapshot,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      })
      .returning();
    return toMessageDto(rows[0]);
  });
}

export async function deletePlatformMessage(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .update(platformMessages)
      .set({ deletedAt: new Date() })
      .where(and(eq(platformMessages.id, id), isNull(platformMessages.deletedAt)))
      .returning({ id: platformMessages.id });
    return rows.length > 0;
  });
}

export async function restorePlatformMessage(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .update(platformMessages)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(platformMessages.id, id), isNotNull(platformMessages.deletedAt)))
      .returning({ id: platformMessages.id });
    return rows.length > 0;
  });
}

export async function listPlatformMessageTemplates(): Promise<PlatformMessageTemplateDto[]> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .select(templateColumns)
      .from(platformMessageTemplates)
      .orderBy(platformMessageTemplates.name);
    return rows.map(toTemplateDto);
  });
}

export async function savePlatformMessageTemplate(
  id: string,
  input: { name: string; channel: string; subject?: string | null; body: string },
): Promise<PlatformMessageTemplateDto> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .insert(platformMessageTemplates)
      .values({
        id,
        name: input.name,
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
      })
      .onConflictDoUpdate({
        target: platformMessageTemplates.id,
        set: {
          name: input.name,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toTemplateDto(rows[0]);
  });
}

export async function deletePlatformMessageTemplate(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .delete(platformMessageTemplates)
      .where(eq(platformMessageTemplates.id, id))
      .returning({ id: platformMessageTemplates.id });
    return rows.length > 0;
  });
}

export async function platformMessagingMetrics(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
}> {
  return withGlobalTenant(async (tx) => {
    const byStatusRows = await tx
      .select({ status: platformMessages.status, value: count() })
      .from(platformMessages)
      .where(isNull(platformMessages.deletedAt))
      .groupBy(platformMessages.status);
    const byChannelRows = await tx
      .select({ channel: platformMessages.channel, value: count() })
      .from(platformMessages)
      .where(isNull(platformMessages.deletedAt))
      .groupBy(platformMessages.channel);
    return {
      total: byStatusRows.reduce((sum, row) => sum + Number(row.value), 0),
      byStatus: Object.fromEntries(byStatusRows.map((row) => [row.status, Number(row.value)])),
      byChannel: Object.fromEntries(byChannelRows.map((row) => [row.channel, Number(row.value)])),
    };
  });
}
