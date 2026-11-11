import type { TabDefinition } from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_EXAMINATIONS_FIELD_SEED } from "../settings/moduleFieldSetupAcademic.js";
import type { ExaminationsModulePreferences } from "./examinationsSetupPreferences.js";

// ─── Examinations Module Settings ─────────────────────────────────────────────

/**
 * Configuration for the Examinations module.
 * Stored under the key "examinations_settings".
 */
export interface ExaminationsSettings extends ExaminationsModulePreferences {
  fields?: Record<string, unknown>;
  customFields?: ModuleFieldDef[];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

/** Authoritative default values for ExaminationsSettings. */
export const DEFAULT_EXAMINATIONS_SETTINGS: ExaminationsSettings = {
  passMark: "50",
  maxMark: "100",
  gradingSystem: "percentage",
  showRankings: true,
  allowRetake: true,
  autoPublishResults: false,
  notifyOnResult: true,
  certificateTemplate: "default",
  aiGrading: false,
  distinguishHonours: true,
  examReminders: true,
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_EXAMINATIONS_FIELD_SEED.basic.map((f) => ({ ...f })),
  },
  fieldOrder: [
    "name",
    "subject",
    "status",
    "totalMarks",
    "passingMarks",
    "duration",
    "date",
    "classIds",
    "description",
  ],
};

export const DEFAULT_EXAMINATIONS_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "name", label: "Exam Name", required: true },
  { id: "subject", label: "Subject" },
  { id: "status", label: "Status" },
  { id: "totalMarks", label: "Total Marks" },
  { id: "passingMarks", label: "Passing Marks" },
  { id: "duration", label: "Duration (min)" },
  { id: "date", label: "Exam Date", required: true },
  { id: "classIds", label: "Assign to Classes", required: true },
  { id: "description", label: "Description" },
];
