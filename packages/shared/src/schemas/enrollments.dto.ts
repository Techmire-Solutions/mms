import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const enrollmentsBulkIdsBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

export const enrollmentsBulkIdsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, enrollmentsBulkIdsBaseSchema);
