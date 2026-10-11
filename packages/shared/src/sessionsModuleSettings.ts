import type { TabDefinition } from "./contactTypes.js";
import type { ModuleFieldDef } from "./moduleFieldSchema.js";
import { INITIAL_SESSIONS_FIELD_SEED } from "./moduleFieldSetupAcademic.js";

// ─── Sessions Module Settings ─────────────────────────────────────────────────

/**
 * Configuration for the Sessions module.
 * Stored under the key "sessions_settings".
 */
export interface SessionsSettings {
  /** Default session duration in months. */
  defaultDuration: string;
  /** Default session type: "annual" | "semester" | "trimester" | "quarterly". */
  defaultSessionType: string;
  /** Whether multiple active sessions can run simultaneously. */
  allowOverlap: boolean;
  /** Whether completed sessions are automatically archived. */
  archiveOldSessions: boolean;
  /** Whether a session must have a budget plan before activation. */
  requireBudget: boolean;
  /** Whether to warn when class schedules overlap. */
  timetableConflictCheck: boolean;
  /** Whether to send a notification when a new session begins. */
  notifyOnSessionStart: boolean;
  /** Current academic year label, e.g. "2025-2026". */
  academicYear: string;
  /** Month in which the academic session starts, e.g. "april". */
  sessionStart: string;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

/** Authoritative default values for SessionsSettings. */
export const DEFAULT_SESSIONS_SETTINGS: SessionsSettings = {
  defaultDuration: "12",
  defaultSessionType: "annual",
  allowOverlap: false,
  archiveOldSessions: true,
  requireBudget: false,
  timetableConflictCheck: true,
  notifyOnSessionStart: true,
  academicYear: "",
  sessionStart: "april",
  defaultViewLayout: "table",
  fields: {
    basic: INITIAL_SESSIONS_FIELD_SEED.basic.map((f) => ({ ...f })),
    financial: INITIAL_SESSIONS_FIELD_SEED.financial.map((f) => ({ ...f })),
  },
  fieldOrder: [
    "name",
    "type",
    "status",
    "startDate",
    "endDate",
    "baseFee",
    "currency",
    "description",
  ],
};

export const DEFAULT_SESSIONS_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "name", label: "Session Name", required: true },
  { id: "type", label: "Session Type" },
  { id: "status", label: "Status" },
  { id: "startDate", label: "Start Date", required: true },
  { id: "endDate", label: "End Date", required: true },
  { id: "baseFee", label: "Base Fee" },
  { id: "currency", label: "Currency" },
  { id: "description", label: "Description" },
];
