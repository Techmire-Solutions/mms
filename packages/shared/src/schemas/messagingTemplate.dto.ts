import { z } from "zod";
import {
  messageCategorySchema,
  messageChannelSchema,
} from "../messaging/messagingCategorySchemas.js";
import {
  type MessageCategory,
  type MessageChannel,
} from "../messaging/messagingCategorySchemas.js";
import { findUnknownPersonalizationTokens } from "../messaging/messagingPersonalizeUtils.js";
import { deepSanitizeStrings } from "./sanitize.js";

const messageTemplateInputObjectSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().min(1).max(200),
    labelKey: z.string().optional(),
    body: z.string().min(1).max(10_000),
    category: messageCategorySchema.default("general"),
    channel: messageChannelSchema.default("all"),
  })
  .strict();

function refineUnknownTokens(data: { body?: string }, ctx: z.RefinementCtx): void {
  if (typeof data.body !== "string" || !data.body) return;
  const unknown = findUnknownPersonalizationTokens(data.body);
  if (unknown.length === 0) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["body"],
    message: `Unknown personalization tokens: ${unknown.map((token) => `{${token}}`).join(", ")}`,
  });
}

const messageTemplateInputBaseSchema =
  messageTemplateInputObjectSchema.superRefine(refineUnknownTokens);

export const messageTemplateInputSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messageTemplateInputBaseSchema);

/** Message template creation/update input payload structure. */
export type MessageTemplateInputDto = z.infer<typeof messageTemplateInputObjectSchema>;

export const messageTemplateInsertSchema = messageTemplateInputSchema;
export type MessageTemplateInsert = z.infer<typeof messageTemplateInputObjectSchema>;

export const messageTemplateUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messageTemplateInputObjectSchema.partial().strict().superRefine(refineUnknownTokens));

/** Message template DTO payload structure. */
export type MessageTemplateDto = {
  id: string;
  label: string;
  labelKey?: string;
  body: string;
  category: MessageCategory;
  channel: MessageChannel;
  createdAt?: string;
  updatedAt?: string;
};
/** Canonical message template domain type (Zod-inferred). */
export type MessageTemplate = MessageTemplateDto;
