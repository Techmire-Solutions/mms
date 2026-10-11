import { z } from "zod";
import { baseListQuerySchema } from "../apiSchemas.js";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  questionBankQuestionInsertSchema,
  questionBankQuestionUpdateSchema,
  questionBankTestInsertSchema,
  questionBankTestUpdateSchema,
  questionBankResultInsertSchema,
  questionBankResultUpdateSchema,
} from "../questionBankModuleManifest.js";

/** Query accepted by the question bank questions Work list endpoint. */
export const questionBankListQuerySchema = baseListQuerySchema
  .extend({
    /** Comma-separated category ids (JSONB array overlap on `categoryIds`). */
    categoryId: z.string().max(500).optional(),
    /** Comma-separated difficulties (`easy|medium|hard`). */
    difficulty: z.string().max(200).optional(),
  })
  .strict();

export const questionBankQuestionCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankQuestionInsertSchema);

export const questionBankQuestionUpdateSchemaSanitized = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankQuestionUpdateSchema);

export const questionBankTestCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankTestInsertSchema);

export const questionBankTestUpdateSchemaSanitized = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankTestUpdateSchema);

export const questionBankResultCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankResultInsertSchema);

export const questionBankResultUpdateSchemaSanitized = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankResultUpdateSchema);
