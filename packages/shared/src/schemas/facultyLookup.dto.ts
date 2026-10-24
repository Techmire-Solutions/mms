import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const facultyLookupStringItemsSchema = z.array(z.string().min(1).max(200)).max(500);

const facultyLookupPutBodyBaseSchema = z
  .object({
    items: facultyLookupStringItemsSchema,
  })
  .strict();

export const facultyLookupPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, facultyLookupPutBodyBaseSchema);
