import { z } from "zod";
import { messageCategorySchema, messageChannelSchema } from "./messagingCategorySchemas.js";
import type { MessageTemplate } from "./schemas/messagingTemplate.dto.js";

export const messageTemplateSchema = z
  .object({
    id: z.string(),
    label: z.string().min(1),
    /** i18n key for system templates; custom templates use `label` directly. */
    labelKey: z.string().optional(),
    body: z.string().min(1),
    category: messageCategorySchema.default("general"),
    channel: messageChannelSchema.default("all"),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const messageTemplateListSchema = z.array(messageTemplateSchema);

export * from "./schemas/messagingTemplate.dto.js";

/** Built-in templates seeded for every workspace messaging setup. */
export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "t1",
    label: "General Announcement",
    labelKey: "messaging.template.generalAnnouncement",
    category: "general",
    channel: "all",
    body: "Dear {name|Valued Parent}, we would like to inform you that...",
  },
  {
    id: "t2",
    label: "Payment Reminder",
    labelKey: "messaging.template.paymentReminder",
    category: "financial",
    channel: "all",
    body: "Dear {name|Valued Parent}, this is a friendly reminder that your balance payment of {amount|0 PKR} is due.",
  },
  {
    id: "t3",
    label: "Holiday Announcement",
    labelKey: "messaging.template.holidayAnnouncement",
    category: "general",
    channel: "all",
    body: "Dear {name|Valued Parent}, please note that the madrasa will remain closed on {date}.",
  },
  {
    id: "t4",
    label: "Attendance Alert",
    labelKey: "messaging.template.attendanceAlert",
    category: "attendance",
    channel: "whatsapp",
    body: "Respected {name|Parent}, student {first_name} was marked absent today.",
  },
];

/** Partial template shape accepted by merge helpers (category/channel defaulted). */
export type MessageTemplateMergeInput = Pick<MessageTemplate, "id" | "label" | "body"> &
  Partial<Omit<MessageTemplate, "id" | "label" | "body">>;

function normalizeMessageTemplate(template: MessageTemplateMergeInput): MessageTemplate {
  return {
    category: "general",
    channel: "all",
    ...template,
  };
}

/**
 * Merges default templates with user/custom templates and context templates without duplicate template IDs.
 */
export function mergeMessageTemplates(
  customTemplates?: MessageTemplateMergeInput[],
  contextTemplates?: MessageTemplateMergeInput[],
): MessageTemplate[] {
  const base: MessageTemplate[] = [
    ...DEFAULT_MESSAGE_TEMPLATES,
    ...(contextTemplates || []).map(normalizeMessageTemplate),
  ];
  const existingIds = new Set(base.map((template) => template.id));
  const uniqueCustom = (customTemplates || [])
    .filter((template) => !existingIds.has(template.id))
    .map(normalizeMessageTemplate);
  return [...base, ...uniqueCustom];
}
