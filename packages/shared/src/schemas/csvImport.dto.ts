import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const CSV_IMPORT_MAX_BATCH_DEFAULT = 500;

const importIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

/**
 * Shared CSV import enqueue body schema generator.
 * Pass the module's row-level Zod schema.
 */
export function csvImportBodySchema<TRowSchema extends z.ZodTypeAny>(
  rowSchema: TRowSchema,
  maxBatch = CSV_IMPORT_MAX_BATCH_DEFAULT,
) {
  const base = z
    .object({
      rows: z.array(rowSchema).min(1).max(maxBatch),
      label: z.string().min(1).max(200).optional(),
      idempotencyKey: importIdempotencyKeySchema,
    })
    .strict();

  return z.preprocess((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  }, base);
}

export type CsvImportBody<TRow = Record<string, unknown>> = {
  rows: TRow[];
  label?: string;
  idempotencyKey?: string;
};

export interface ModuleImportRowError {
  row: number;
  reason: string;
}

export interface ModuleImportJobResult {
  total: number;
  imported: number;
  failed: number;
  errors?: ModuleImportRowError[];
}
