import { z } from "zod";

export const PLATFORM_MESSAGE_CHANNELS = ["sms", "whatsapp", "email"] as const;
export const PLATFORM_MESSAGE_STATUSES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
] as const;

export const platformMessageChannelSchema = z.enum(PLATFORM_MESSAGE_CHANNELS);
export const platformMessageStatusSchema = z.enum(PLATFORM_MESSAGE_STATUSES);

export const platformMessageRecipientSchema = z
  .object({
    contactId: z.string(),
    name: z.string(),
    channel: platformMessageChannelSchema,
    address: z.string(),
  })
  .strict();

export const platformMessageDtoSchema = z
  .object({
    id: z.string(),
    channel: platformMessageChannelSchema,
    subject: z.string().nullable().optional(),
    body: z.string(),
    status: platformMessageStatusSchema,
    recipientSnapshot: z.array(platformMessageRecipientSchema),
    scheduledAt: z.string().nullable().optional(),
    sentAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const platformMessageSendInputSchema = z
  .object({
    channel: platformMessageChannelSchema,
    subject: z.string().max(200).nullable().optional(),
    body: z.string().min(1),
    contactIds: z.array(z.string()).min(1),
    scheduledAt: z.string().nullable().optional(),
  })
  .strict();

export const platformMessageTemplateDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    channel: platformMessageChannelSchema,
    subject: z.string().nullable().optional(),
    body: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const platformMessageTemplateSaveInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    channel: platformMessageChannelSchema,
    subject: z.string().max(200).nullable().optional(),
    body: z.string().min(1),
  })
  .strict();

export const platformMessagesListQuerySchema = z
  .object({
    channel: platformMessageChannelSchema.optional(),
    status: platformMessageStatusSchema.optional(),
    deleted: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const platformMessagingMetricsSchema = z
  .object({
    total: z.number(),
    byStatus: z.record(platformMessageStatusSchema, z.number()),
    byChannel: z.record(platformMessageChannelSchema, z.number()),
  })
  .strict();

export type PlatformMessageRecipient = z.infer<typeof platformMessageRecipientSchema>;
export type PlatformMessageDto = z.infer<typeof platformMessageDtoSchema>;
export type PlatformMessageSendInput = z.infer<typeof platformMessageSendInputSchema>;
export type PlatformMessageTemplateDto = z.infer<typeof platformMessageTemplateDtoSchema>;
export type PlatformMessageTemplateSaveInput = z.infer<
  typeof platformMessageTemplateSaveInputSchema
>;
export type PlatformMessagesListQuery = z.infer<typeof platformMessagesListQuerySchema>;
export type PlatformMessagingMetrics = z.infer<typeof platformMessagingMetricsSchema>;
