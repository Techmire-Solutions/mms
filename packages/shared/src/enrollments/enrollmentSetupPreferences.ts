/** Enrollments module preferences: schema, type, and normalization. */
import { z } from "zod";
import {
  DEFAULT_ENROLLMENTS_SETTINGS,
  type EnrollmentsSettings,
} from "./enrollmentsModuleSettings.js";

/** PUT /api/enrollments/preferences — enrollment prefs only. */
export const enrollmentPreferencesPutBodySchema = z
  .object({
    maxStudentsPerClass: z.string().optional(),
    waitlistEnabled: z.boolean().optional(),
    waitlistOfferHours: z.string().optional(),
    requireEligibilityCheck: z.boolean().optional(),
    autoAssignClass: z.boolean().optional(),
    enrollmentApproval: z.boolean().optional(),
    allowTransfers: z.boolean().optional(),
    dropDeadlineDays: z.string().optional(),
    reenrollmentReminder: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

/** Wire schema for normalized preferences (GET/PUT /api/enrollments/preferences). */
export const enrollmentPreferencesResponseSchema = z
  .object({
    maxStudentsPerClass: z.string(),
    waitlistEnabled: z.boolean(),
    waitlistOfferHours: z.string(),
    requireEligibilityCheck: z.boolean(),
    autoAssignClass: z.boolean(),
    enrollmentApproval: z.boolean(),
    allowTransfers: z.boolean(),
    dropDeadlineDays: z.string(),
    reenrollmentReminder: z.boolean(),
    defaultViewLayout: z.string(),
  })
  .strict();
export type EnrollmentPreferencesResponse = z.infer<typeof enrollmentPreferencesResponseSchema>;

export type EnrollmentModulePreferences = Pick<
  EnrollmentsSettings,
  | "maxStudentsPerClass"
  | "waitlistEnabled"
  | "waitlistOfferHours"
  | "requireEligibilityCheck"
  | "autoAssignClass"
  | "enrollmentApproval"
  | "allowTransfers"
  | "dropDeadlineDays"
  | "reenrollmentReminder"
  | "defaultViewLayout"
>;

const PREF_KEYS = [
  "maxStudentsPerClass",
  "waitlistEnabled",
  "waitlistOfferHours",
  "requireEligibilityCheck",
  "autoAssignClass",
  "enrollmentApproval",
  "allowTransfers",
  "dropDeadlineDays",
  "reenrollmentReminder",
  "defaultViewLayout",
] as const;

/** Whole hours clamped to 1–720; anything unparseable falls back to the default (72). */
function normalizeOfferHours(value: string | undefined): string {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ENROLLMENTS_SETTINGS.waitlistOfferHours;
  return String(Math.min(720, Math.max(1, parsed)));
}

function normalizeViewLayout(value: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed === "table" || trimmed === "cards" || trimmed === "list") return trimmed;
  return DEFAULT_ENROLLMENTS_SETTINGS.defaultViewLayout ?? "list";
}

/** Normalize Enrollments module preferences (typed `enrollment_module_preferences`). */
export function normalizeEnrollmentModulePreferences(
  partial?: Partial<EnrollmentModulePreferences> | Record<string, unknown> | null,
): EnrollmentModulePreferences {
  const defaults: EnrollmentModulePreferences = {
    maxStudentsPerClass: DEFAULT_ENROLLMENTS_SETTINGS.maxStudentsPerClass,
    waitlistEnabled: DEFAULT_ENROLLMENTS_SETTINGS.waitlistEnabled,
    waitlistOfferHours: DEFAULT_ENROLLMENTS_SETTINGS.waitlistOfferHours,
    requireEligibilityCheck: DEFAULT_ENROLLMENTS_SETTINGS.requireEligibilityCheck,
    autoAssignClass: DEFAULT_ENROLLMENTS_SETTINGS.autoAssignClass,
    enrollmentApproval: DEFAULT_ENROLLMENTS_SETTINGS.enrollmentApproval,
    allowTransfers: DEFAULT_ENROLLMENTS_SETTINGS.allowTransfers,
    dropDeadlineDays: DEFAULT_ENROLLMENTS_SETTINGS.dropDeadlineDays,
    reenrollmentReminder: DEFAULT_ENROLLMENTS_SETTINGS.reenrollmentReminder,
    defaultViewLayout: DEFAULT_ENROLLMENTS_SETTINGS.defaultViewLayout,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  return {
    maxStudentsPerClass:
      typeof partial.maxStudentsPerClass === "string" && partial.maxStudentsPerClass.trim()
        ? partial.maxStudentsPerClass.trim()
        : defaults.maxStudentsPerClass,
    waitlistEnabled:
      typeof partial.waitlistEnabled === "boolean"
        ? partial.waitlistEnabled
        : defaults.waitlistEnabled,
    waitlistOfferHours: normalizeOfferHours(
      typeof partial.waitlistOfferHours === "string" ? partial.waitlistOfferHours : undefined,
    ),
    requireEligibilityCheck:
      typeof partial.requireEligibilityCheck === "boolean"
        ? partial.requireEligibilityCheck
        : defaults.requireEligibilityCheck,
    autoAssignClass:
      typeof partial.autoAssignClass === "boolean"
        ? partial.autoAssignClass
        : defaults.autoAssignClass,
    enrollmentApproval:
      typeof partial.enrollmentApproval === "boolean"
        ? partial.enrollmentApproval
        : defaults.enrollmentApproval,
    allowTransfers:
      typeof partial.allowTransfers === "boolean"
        ? partial.allowTransfers
        : defaults.allowTransfers,
    dropDeadlineDays:
      typeof partial.dropDeadlineDays === "string" && partial.dropDeadlineDays.trim()
        ? partial.dropDeadlineDays.trim()
        : defaults.dropDeadlineDays,
    reenrollmentReminder:
      typeof partial.reenrollmentReminder === "boolean"
        ? partial.reenrollmentReminder
        : defaults.reenrollmentReminder,
    defaultViewLayout: normalizeViewLayout(
      typeof partial.defaultViewLayout === "string"
        ? partial.defaultViewLayout
        : defaults.defaultViewLayout,
    ),
  };
}

export { PREF_KEYS as ENROLLMENT_MODULE_PREFERENCE_KEYS };

export interface EnrollmentPreferenceIssue {
  field: keyof EnrollmentModulePreferences;
  code: "required" | "integer" | "range" | "layout";
}

/** Client-side mirror of the server bounds (the API normalizer stays lenient for legacy callers). */
export function validateEnrollmentPreferences(
  preferences: Partial<EnrollmentModulePreferences>,
): EnrollmentPreferenceIssue[] {
  const issues: EnrollmentPreferenceIssue[] = [];
  const positiveInt = (field: "maxStudentsPerClass" | "dropDeadlineDays", min: number) => {
    const raw = String(preferences[field] ?? "").trim();
    if (!raw) issues.push({ field, code: "required" });
    else if (!/^\d+$/.test(raw)) issues.push({ field, code: "integer" });
    else if (Number(raw) < min) issues.push({ field, code: "range" });
  };
  positiveInt("maxStudentsPerClass", 1);
  positiveInt("dropDeadlineDays", 0);
  const hours = String(preferences.waitlistOfferHours ?? "").trim();
  if (!hours) issues.push({ field: "waitlistOfferHours", code: "required" });
  else if (!/^\d+$/.test(hours)) issues.push({ field: "waitlistOfferHours", code: "integer" });
  else if (Number(hours) < 1 || Number(hours) > 720)
    issues.push({ field: "waitlistOfferHours", code: "range" });
  const layout = preferences.defaultViewLayout;
  if (layout !== undefined && !["table", "list", "cards"].includes(String(layout)))
    issues.push({ field: "defaultViewLayout", code: "layout" });
  return issues;
}
