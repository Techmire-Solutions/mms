import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  denomRecordInsertSchema,
  batchRecordInsertSchema,
  distributionRecordInsertSchema,
  distributionRecordUpdateSchema,
  redemptionRecordInsertSchema,
} from "../hasanat/hasanatModuleManifest.js";

export { hasanatListQuerySchema } from "../hasanat/hasanatListQuery.js";

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
