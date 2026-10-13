import { z } from "zod";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";

/** PUT /api/enrollments/field-config — field registry JSON without formTabs SSOT. */
const enrollmentFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const enrollmentFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, enrollmentFieldConfigPutBodyBaseSchema);

/** PUT /api/enrollments/preferences — enrollment prefs only. */
export const enrollmentPreferencesPutBodySchema = z
  .object({
    maxStudentsPerClass: z.string().optional(),
    waitlistEnabled: z.boolean().optional(),
    requireEligibilityCheck: z.boolean().optional(),
    autoAssignClass: z.boolean().optional(),
    enrollmentApproval: z.boolean().optional(),
    allowTransfers: z.boolean().optional(),
    dropDeadlineDays: z.string().optional(),
    reenrollmentReminder: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();
