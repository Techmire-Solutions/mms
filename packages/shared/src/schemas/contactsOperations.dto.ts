import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

/**
 * Contact *operation* payload schemas (Google-sync credential/audit/exchange,
 * VCF export, duplicate scan) — split out of `contacts.dto.ts` for the ADR-001
 * line bands. Re-exported from there, so the import surface is unchanged.
 */

const contactGoogleSyncConfigBaseSchema = z
  .object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    clearTokens: z.boolean().optional(),
  })
  .strict();

export const contactGoogleSyncConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactGoogleSyncConfigBaseSchema);

const contactGoogleSyncAuditBaseSchema = z
  .object({
    action: z.enum(["credentials_saved", "disconnected"]),
  })
  .strict();

export const contactGoogleSyncAuditSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactGoogleSyncAuditBaseSchema);

const contactGoogleSyncExchangeBaseSchema = z
  .object({
    code: z.string().min(1),
    redirectUri: z.string().url(),
  })
  .strict();

export const contactGoogleSyncExchangeSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactGoogleSyncExchangeBaseSchema);

const contactsVcfExportBodyBaseSchema = z
  .object({
    filename: z.string().min(1).max(200).optional(),
    label: z.string().min(1).max(500).optional(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

export const contactsVcfExportBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactsVcfExportBodyBaseSchema);

const contactsDuplicateScanBodyBaseSchema = z
  .object({
    label: z.string().min(1).max(500).optional(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

export const contactsDuplicateScanBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactsDuplicateScanBodyBaseSchema);
