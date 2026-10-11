import { z } from "zod";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";

/** PUT /api/contacts/field-config — FieldConfig JSON without formTabs SSOT. */
const contactFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema;
const relationshipPairSchema = z
  .object({
    id: z.string().optional(),
    forward: z.string().min(1),
    inverse: z.string().min(1),
    inverseMale: z.string().optional(),
    inverseFemale: z.string().optional(),
  })
  .strict();

export const contactFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, contactFieldConfigPutBodyBaseSchema);

/** PUT /api/contacts/preferences — ContactPreferences JSON. */
export const contactPreferencesPutBodySchema = z
  .object({
    relationshipPairs: z.array(relationshipPairSchema).optional(),
  })
  .passthrough();
