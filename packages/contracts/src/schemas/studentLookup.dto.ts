import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const studentLookupStringItemsSchema = z.array(z.string().min(1).max(200)).max(500);

const studentLookupPutBodyBaseSchema = z
  .object({
    items: studentLookupStringItemsSchema,
  })
  .strict();

export const studentLookupPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, studentLookupPutBodyBaseSchema);
