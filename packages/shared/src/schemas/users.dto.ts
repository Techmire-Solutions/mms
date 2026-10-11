import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const usersBulkBodyBaseSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

export const usersBulkBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, usersBulkBodyBaseSchema);
