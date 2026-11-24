import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const CONTACTS_SAVED_REPORT_CATEGORY = "contacts" as const;

/** Report categories supported by the generic saved-reports REST resource. */
export const GENERIC_SAVED_REPORT_CATEGORIES = [
  "students",
  "faculty",
  "attendance",
  "finance",
  "financial",
  "accounting",
  "examinations",
  "questionBank",
  "hasanat",
  "sessions",
  "enrollments",
  "obligations",
  "messaging",
  "users",
] as const;

/** Validates a category supported by the generic saved-reports REST resource. */
export const genericSavedReportCategorySchema = z.enum(GENERIC_SAVED_REPORT_CATEGORIES);

/** A category supported by the generic saved-reports REST resource. */
export type GenericSavedReportCategory = z.infer<typeof genericSavedReportCategorySchema>;

/** Categories persisted in `saved_reports` (includes Contacts share presets). */
export type PersistedSavedReportCategory =
  GenericSavedReportCategory | typeof CONTACTS_SAVED_REPORT_CATEGORY;

const genericSavedReportCreateBaseSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: genericSavedReportCategorySchema,
    filters: z.record(z.string(), z.unknown()),
  })
  .strict();

export const genericSavedReportCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, genericSavedReportCreateBaseSchema);

export type GenericSavedReportCreateInput = z.infer<typeof genericSavedReportCreateBaseSchema>;
