import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  invoiceRecordInsertSchema,
  paymentRecordInsertSchema,
} from "../finance/financeModuleManifest.js";
import { stripClientSoftDeleteFields } from "../contacts/contactSoftDelete.js";

const financeBulkIdsBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
  })
  .strict();

export const financeBulkIdsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, financeBulkIdsBaseSchema);

export const invoiceCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(stripClientSoftDeleteFields(raw as Record<string, unknown>));
}, invoiceRecordInsertSchema);

export const paymentCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(stripClientSoftDeleteFields(raw as Record<string, unknown>));
}, paymentRecordInsertSchema);
