import type { TabDefinition } from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_ENROLLMENTS_FIELD_SEED } from "../settings/moduleFieldSetupAcademic.js";

// ─── Enrollments Module Settings ──────────────────────────────────────────────

/**
 * Configuration for the Enrollments module.
 * Stored under the key "enrollments_settings".
 */
export interface EnrollmentsSettings {
  /** Maximum students allowed per class. */
  maxStudentsPerClass: string;
  /** Whether a waitlist is available when a class is full. */
  waitlistEnabled: boolean;
  /** Whether eligibility rules run before confirming enrollment. */
  requireEligibilityCheck: boolean;
  /** Whether the system auto-assigns students to the best available class. */
  autoAssignClass: boolean;
  /** Whether admin approval is required before enrollment is confirmed. */
  enrollmentApproval: boolean;
  /** Whether students can be transferred between classes. */
  allowTransfers: boolean;
  /** Days after enrollment within which a student can drop without penalty. */
  dropDeadlineDays: string;
  /** Whether guardians receive a reminder when re-enrollment opens. */
  reenrollmentReminder: boolean;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

/** Authoritative default values for EnrollmentsSettings. */
export const DEFAULT_ENROLLMENTS_SETTINGS: EnrollmentsSettings = {
  maxStudentsPerClass: "30",
  waitlistEnabled: true,
  requireEligibilityCheck: true,
  autoAssignClass: false,
  enrollmentApproval: true,
  allowTransfers: true,
  dropDeadlineDays: "14",
  reenrollmentReminder: true,
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_ENROLLMENTS_FIELD_SEED.basic.map((f) => ({ ...f })),
  },
  fieldOrder: ["studentId", "sessionId", "classId", "notes"],
};

export const DEFAULT_ENROLLMENTS_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "studentId", label: "Select Student", required: true },
  { id: "sessionId", label: "Select Session", required: true },
  { id: "classId", label: "Assign Class", required: true },
  { id: "notes", label: "Notes" },
];
