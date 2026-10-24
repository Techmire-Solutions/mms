/**
 * @file validateImportRows.ts
 * @description Zod-based per-row validator for the import pipeline.
 *
 * Sanitises each row against RTLO/BiDi injection attacks before parsing,
 * then validates through the module-supplied Zod schema. Rows that fail
 * are collected as `ImportRowError` entries; the function never throws.
 */
import type { z } from "zod";
import { deepSanitizeStrings } from "../../schemas/sanitize.js";
import type { ImportRowError } from "../core/importTypes.js";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface RowValidationResult<T> {
  valid: T[];
  /** Row-level errors collected during validation. Never throws. */
  errors: ImportRowError[];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validates an array of raw (unsanitised) rows against a Zod schema.
 *
 * For each row:
 * 1. `deepSanitizeStrings` strips RTLO/BiDi Unicode override characters.
 * 2. `schema.safeParse` validates the sanitised row.
 * 3. Failures are added to `errors`; successes accumulate in `valid`.
 *
 * @param rawRows - Raw row objects (e.g. parsed from CSV).
 * @param schema  - Zod schema applied once per row.
 * @returns `{ valid, errors }` — never throws for per-row failures.
 */
export function validateImportRows<T>(
  rawRows: unknown[],
  schema: z.ZodType<T>,
): RowValidationResult<T> {
  const valid: T[] = [];
  const errors: ImportRowError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const sanitized = deepSanitizeStrings(rawRows[i]);
    const result = schema.safeParse(sanitized);

    if (result.success) {
      valid.push(result.data);
    } else {
      const reasons = result.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
          return `${path}${issue.message}`;
        })
        .join("; ");
      errors.push({ row: i + 1, reason: reasons });
    }
  }

  return { valid, errors };
}
