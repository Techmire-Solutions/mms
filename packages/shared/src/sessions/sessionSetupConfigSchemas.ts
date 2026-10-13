import { z } from "zod";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";

/** PUT /api/sessions/field-config — field registry JSON without formTabs SSOT. */
const sessionFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const sessionFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, sessionFieldConfigPutBodyBaseSchema);

/** PUT /api/sessions/preferences — academic/session prefs only. */
export const sessionPreferencesPutBodySchema = z
  .object({
    defaultDuration: z.string().optional(),
    defaultSessionType: z.string().optional(),
    allowOverlap: z.boolean().optional(),
    archiveOldSessions: z.boolean().optional(),
    requireBudget: z.boolean().optional(),
    timetableConflictCheck: z.boolean().optional(),
    notifyOnSessionStart: z.boolean().optional(),
    academicYear: z.string().optional(),
    sessionStart: z.string().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();
