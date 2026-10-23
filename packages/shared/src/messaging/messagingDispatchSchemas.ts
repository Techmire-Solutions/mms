import { z } from "zod";
import { messageCategorySchema } from "./messagingCategorySchemas.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";

const messagingSmsDispatchBaseSchema = z
  .object({
    recipients: z
      .array(
        z.object({
          id: z.union([z.string(), z.number()]),
          name: z.string().optional(),
          phone: z.string().min(1).max(30),
        }),
      )
      .min(1)
      .max(500),
    message: z.string().min(1).max(10_000),
    category: messageCategorySchema.optional().default("general"),
    queued: z.boolean().optional(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

export const messagingSmsDispatchSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messagingSmsDispatchBaseSchema);

export type MessagingSmsDispatchDto = z.infer<typeof messagingSmsDispatchBaseSchema>;

export const messagingSmsDispatchResponseSchema = z.object({
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type MessagingSmsDispatchResponseDto = z.infer<typeof messagingSmsDispatchResponseSchema>;

/* ========================================================================= */
/*                       EMAIL DISPATCH SCHEMAS                              */
/* ========================================================================= */

const messagingEmailDispatchBaseSchema = z
  .object({
    recipients: z
      .array(
        z.object({
          id: z.union([z.string(), z.number()]),
          name: z.string().optional(),
          email: z.string().email().max(255),
        }),
      )
      .min(1)
      .max(500),
    subject: z.string().min(1).max(500),
    message: z.string().min(1).max(50_000),
    html: z.string().max(100_000).optional(),
    category: messageCategorySchema.optional().default("general"),
    queued: z.boolean().optional(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

export const messagingEmailDispatchSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messagingEmailDispatchBaseSchema);

export type MessagingEmailDispatchDto = z.infer<typeof messagingEmailDispatchBaseSchema>;

export const messagingEmailDispatchResponseSchema = messagingSmsDispatchResponseSchema;
export type MessagingEmailDispatchResponseDto = MessagingSmsDispatchResponseDto;

/* ========================================================================= */
/*                      WHATSAPP DISPATCH SCHEMAS                            */
/* ========================================================================= */

const messagingWhatsAppDispatchBaseSchema = z
  .object({
    recipients: z
      .array(
        z.object({
          id: z.union([z.string(), z.number()]),
          name: z.string().optional(),
          phone: z.string().min(1).max(30),
        }),
      )
      .min(1)
      .max(500),
    message: z.string().min(1).max(10_000),
    category: messageCategorySchema.optional().default("general"),
    queued: z.boolean().optional(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

export const messagingWhatsAppDispatchSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messagingWhatsAppDispatchBaseSchema);

export type MessagingWhatsAppDispatchDto = z.infer<typeof messagingWhatsAppDispatchBaseSchema>;

export const messagingWhatsAppDispatchResponseSchema = messagingSmsDispatchResponseSchema;
export type MessagingWhatsAppDispatchResponseDto = MessagingSmsDispatchResponseDto;
