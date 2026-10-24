import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const smsIntegrationBodyBaseSchema = z
  .object({
    providerId: z.string().min(1),
    accountId: z.string().optional(),
    senderId: z.string().min(1),
    apiBaseUrl: z.string().optional(),
    accountSecret: z.string().optional(),
  })
  .strict();

export const smsIntegrationBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, smsIntegrationBodyBaseSchema);

const smsTestBodyBaseSchema = z
  .object({
    testPhone: z.string().min(6),
  })
  .strict();

export const smsTestBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, smsTestBodyBaseSchema);
