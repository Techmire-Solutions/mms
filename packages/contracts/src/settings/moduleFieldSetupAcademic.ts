import type { TabDefinition, FieldDefinition } from "../contacts/contactTypes.js";

// ─── Default Question Bank Field Setup Constants ───────────────────────────────

export const QUESTION_BANK_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Setup", enabled: true, order: 0, isSystem: true },
  { key: "options", label: "Options & Metadata", enabled: true, order: 1, isSystem: true },
];

export const INITIAL_QUESTION_BANK_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "text",
      label: "Question Text",
      type: "textarea",
      enabled: true,
      order: 0,
      required: true,
    },
    {
      key: "categoryId",
      label: "Category",
      type: "select",
      enabled: true,
      order: 1,
      required: true,
    },
    {
      key: "questionLanguage",
      label: "Language",
      type: "select",
      options: ["en", "ur", "ar", "fa"],
      enabled: true,
      order: 2,
      required: true,
    },
  ],
  options: [
    {
      key: "type",
      label: "Question Type",
      type: "select",
      options: ["mcq", "true_false", "short", "fill_blank", "matching", "numeric", "ordering"],
      enabled: true,
      order: 0,
      required: true,
    },
    {
      key: "difficulty",
      label: "Difficulty",
      type: "select",
      options: ["easy", "medium", "hard"],
      enabled: true,
      order: 1,
      required: true,
    },
  ],
};

// ─── Default Sessions Field Setup Constants ────────────────────────────────────

export const SESSIONS_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Info", enabled: true, order: 0, isSystem: true },
  { key: "financial", label: "Financial Setup", enabled: true, order: 1, isSystem: true },
];

export const INITIAL_SESSIONS_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    { key: "name", label: "Session Name", type: "text", enabled: true, order: 0, required: true },
    {
      key: "type",
      label: "Session Type",
      type: "select",
      options: ["annual", "semester", "trimester", "quarterly"],
      enabled: true,
      order: 1,
      required: true,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["draft", "active", "completed", "archived"],
      enabled: true,
      order: 2,
      required: true,
    },
    {
      key: "startDate",
      label: "Start Date",
      type: "date",
      enabled: true,
      order: 3,
      required: true,
    },
    { key: "endDate", label: "End Date", type: "date", enabled: true, order: 4, required: true },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      enabled: true,
      order: 5,
      required: false,
    },
  ],
  financial: [
    { key: "baseFee", label: "Base Fee", type: "number", enabled: true, order: 0, required: true },
    {
      key: "currency",
      label: "Currency",
      type: "select",
      options: ["PKR", "USD", "GBP", "CAD", "SAR", "AED"],
      enabled: true,
      order: 1,
      required: true,
    },
  ],
};

// ─── Default Enrollments Field Setup Constants ─────────────────────────────────

export const ENROLLMENTS_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Setup", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_ENROLLMENTS_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "studentId",
      label: "Select Student",
      type: "text",
      enabled: true,
      order: 0,
      required: true,
    },
    {
      key: "sessionId",
      label: "Select Session",
      type: "text",
      enabled: true,
      order: 1,
      required: true,
    },
    {
      key: "classId",
      label: "Assign Class",
      type: "text",
      enabled: true,
      order: 2,
      required: true,
    },
    { key: "notes", label: "Notes", type: "textarea", enabled: true, order: 3, required: false },
  ],
};

// ─── Default Examinations Field Setup Constants ────────────────────────────────

export const EXAMINATIONS_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Info", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_EXAMINATIONS_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    { key: "name", label: "Exam Name", type: "text", enabled: true, order: 0, required: true },
    { key: "subject", label: "Subject", type: "text", enabled: true, order: 1, required: false },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["draft", "scheduled", "completed"],
      enabled: true,
      order: 2,
      required: false,
    },
    {
      key: "totalMarks",
      label: "Total Marks",
      type: "number",
      enabled: true,
      order: 3,
      required: false,
    },
    {
      key: "passingMarks",
      label: "Passing Marks",
      type: "number",
      enabled: true,
      order: 4,
      required: false,
    },
    {
      key: "duration",
      label: "Duration (min)",
      type: "number",
      enabled: true,
      order: 5,
      required: false,
    },
    { key: "date", label: "Exam Date", type: "date", enabled: true, order: 6, required: true },
    {
      key: "classIds",
      label: "Assign to Classes",
      type: "multiselect",
      enabled: true,
      order: 7,
      required: true,
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      enabled: true,
      order: 8,
      required: false,
    },
  ],
};

// ─── Default Attendance Field Setup Constants ──────────────────────────────────

export const ATTENDANCE_TAB_REGISTRY: TabDefinition[] = [
  { key: "basic", label: "Basic Setup", enabled: true, order: 0, isSystem: true },
];

export const INITIAL_ATTENDANCE_FIELD_SEED: Record<string, FieldDefinition[]> = {
  basic: [
    {
      key: "status",
      label: "Attendance Status",
      type: "select",
      options: ["present", "absent", "late", "excused"],
      enabled: true,
      order: 0,
      required: true,
    },
    { key: "timeIn", label: "Time In", type: "text", enabled: true, order: 1, required: false },
    { key: "timeOut", label: "Time Out", type: "text", enabled: true, order: 2, required: false },
    {
      key: "notes",
      label: "Notes / Comments",
      type: "textarea",
      enabled: true,
      order: 3,
      required: false,
    },
  ],
};
