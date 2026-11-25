import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const moduleFieldConfigPutBodyBaseSchema = z
  .object({
    version: z.number().optional(),
    enabledTabs: z.array(z.string()).optional(),
    requiredTabs: z.array(z.string()).optional(),
    fieldOrder: z.array(z.string()).optional(),
    fields: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
  })
  .strict();

export const moduleFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, moduleFieldConfigPutBodyBaseSchema);
