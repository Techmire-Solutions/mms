import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  examRecordInsertSchema,
  examRecordUpdateSchema,
  examResultRecordInsertSchema,
  examResultRecordUpdateSchema,
} from "../examinations/examinationsModuleManifest.js";

/** Query accepted by the examinations exams Work list endpoint. */
export const examinationsListQuerySchema = baseListQuerySchema
  .extend({
    /** Comma-separated exam statuses (`upcoming|ongoing|completed|scheduled|cancelled`). */
    status: z.string().max(200).optional(),
  })
  .strict();

export const examCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, examRecordInsertSchema);

export const examUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, examRecordUpdateSchema);

export const examResultCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, examResultRecordInsertSchema);

export const examResultUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, examResultRecordUpdateSchema);
