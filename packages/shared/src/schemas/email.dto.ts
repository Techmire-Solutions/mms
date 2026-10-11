import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const emailIntegrationBodyBaseSchema = z
  .object({
    providerId: z.string().min(1),
    fromAddress: z.string().min(3),
    fromName: z.string().optional(),
    smtpUsername: z.string().min(1),
    smtpPassword: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpSecure: z.boolean().optional(),
  })
  .strict();

export const emailIntegrationBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, emailIntegrationBodyBaseSchema);

const verificationCodeBodyBaseSchema = z
  .object({
    code: z.string().min(4).max(12),
  })
  .strict();

export const verificationCodeBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, verificationCodeBodyBaseSchema);
