import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const whatsappIntegrationBodyBaseSchema = z
  .object({
    providerId: z.string().min(1),
    accountId: z.string().optional(),
    phoneNumberId: z.string().optional(),
    senderId: z.string().min(1),
    apiBaseUrl: z.string().optional(),
    accountSecret: z.string().optional(),
  })
  .strict();

export const whatsappIntegrationBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, whatsappIntegrationBodyBaseSchema);

export type WhatsappIntegrationBodyDto = z.infer<typeof whatsappIntegrationBodyBaseSchema>;

const whatsappTestBodyBaseSchema = z
  .object({
    testPhone: z.string().min(6),
  })
  .strict();

export const whatsappTestBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, whatsappTestBodyBaseSchema);

export type WhatsappTestBodyDto = z.infer<typeof whatsappTestBodyBaseSchema>;
