import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  denomRecordInsertSchema,
  batchRecordInsertSchema,
  distributionRecordInsertSchema,
  distributionRecordUpdateSchema,
  redemptionRecordInsertSchema,
} from "../hasanat/hasanatModuleManifest.js";

/** Query accepted by the hasanat distributions Work list endpoint. */
export const hasanatListQuerySchema = baseListQuerySchema
  .extend({
    /** Comma-separated distribution statuses (`active|redeemed|returned`). */
    status: z.string().max(200).optional(),
  })
  .strict();

export const hasanatDenomCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, denomRecordInsertSchema);

export const hasanatBatchCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, batchRecordInsertSchema);

export const hasanatDistributionCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, distributionRecordInsertSchema);

export const hasanatDistributionUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, distributionRecordUpdateSchema);

export const hasanatRedemptionCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, redemptionRecordInsertSchema);
