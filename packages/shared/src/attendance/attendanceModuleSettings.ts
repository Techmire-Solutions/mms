import type { TabDefinition } from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_ATTENDANCE_FIELD_SEED } from "../settings/moduleFieldSetupAcademic.js";

// ─── Attendance Module Settings ───────────────────────────────────────────────

export interface AttendanceSettings {
  workingDays: string[];
  cutoffTime: string;
  lateThresholdMins: number;
  autoAbsentAfterMins: number;
  qrEnabled: boolean;
  lowAttendanceThreshold: number;
  notifyParents: boolean;
  requireNoteForAbsent: boolean;
  lockAfterSubmit: boolean;
  trackHalfDay: boolean;
  weeklyReport: boolean;
  attendanceAlerts: boolean;
  allowManualOverride: boolean;
  offlineEnabled: boolean;
  geoTagging: boolean;
  /** Policy: allow marking attendance on holidays / weekly off-days as an audited extra class. */
  allowExtraClassOnHolidays: boolean;
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  cutoffTime: "09:30",
  lateThresholdMins: 15,
  autoAbsentAfterMins: 30,
  qrEnabled: false,
  lowAttendanceThreshold: 75,
  notifyParents: true,
  requireNoteForAbsent: true,
  lockAfterSubmit: true,
  trackHalfDay: true,
  weeklyReport: true,
  attendanceAlerts: true,
  allowManualOverride: true,
  offlineEnabled: false,
  geoTagging: false,
  allowExtraClassOnHolidays: false,
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_ATTENDANCE_FIELD_SEED.basic.map((f) => ({ ...f })),
  },
  fieldOrder: ["status", "timeIn", "timeOut", "notes"],
};

export const DEFAULT_ATTENDANCE_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "status", label: "Attendance Status", required: true },
  { id: "timeIn", label: "Time In" },
  { id: "timeOut", label: "Time Out" },
  { id: "notes", label: "Notes / Comments" },
];
