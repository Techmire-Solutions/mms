import type { TabDefinition } from "./contactTypes.js";
import type { ModuleFieldDef } from "./moduleFieldSchema.js";
import { INITIAL_EXAMINATIONS_FIELD_SEED } from "./moduleFieldSetupAcademic.js";

// ─── Examinations Module Settings ─────────────────────────────────────────────

/**
 * Configuration for the Examinations module.
 * Stored under the key "examinations_settings".
 */
export interface ExaminationsSettings {
  /** Default passing mark threshold, e.g. "50". */
  passMark: string;
  /** Maximum possible mark for exams, e.g. "100". */
  maxMark: string;
  /** Grading scheme: "percentage" | "letter" | "gpa" | "rubric". */
  gradingSystem: string;
  /** Whether student class rankings are calculated and shown on reports. */
  showRankings: boolean;
  /** Whether students who failed an exam can take a retake. */
  allowRetake: boolean;
  /** Whether exam results are immediately visible to students upon entry. */
  autoPublishResults: boolean;
  /** Whether an SMS/email notification is sent to guardians upon result entry. */
  notifyOnResult: boolean;
  /** Certificate/transcript layout template identifier. */
  certificateTemplate: string;
  /** Whether AI-assisted rubric grading is enabled. */
  aiGrading: boolean;
  /** Whether distinction / honours badges are assigned for top performers. */
  distinguishHonours: boolean;
  /** Whether exam reminder notifications are sent to students/guardians. */
  examReminders: boolean;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
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
