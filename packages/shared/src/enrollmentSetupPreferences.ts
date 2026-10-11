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
    requireEligibilityCheck: z.boolean().optional(),
    autoAssignClass: z.boolean().optional(),
    enrollmentApproval: z.boolean().optional(),
    allowTransfers: z.boolean().optional(),
    dropDeadlineDays: z.string().optional(),
    reenrollmentReminder: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

export type EnrollmentModulePreferences = Pick<
  EnrollmentsSettings,
  | "maxStudentsPerClass"
  | "waitlistEnabled"
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
  "requireEligibilityCheck",
  "autoAssignClass",
  "enrollmentApproval",
  "allowTransfers",
  "dropDeadlineDays",
  "reenrollmentReminder",
  "defaultViewLayout",
] as const;

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
