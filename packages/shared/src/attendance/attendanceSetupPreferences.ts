/** Attendance module preferences: schema, type, and normalization. */
import { z } from "zod";
import { DEFAULT_ATTENDANCE_SETTINGS } from "./attendanceModuleSettings.js";

/** PUT /api/attendance/preferences — attendance prefs only. */
export const attendancePreferencesPutBodySchema = z
  .object({
    workingDays: z.array(z.string()).optional(),
    cutoffTime: z.string().optional(),
    lateThresholdMins: z.number().optional(),
    autoAbsentAfterMins: z.number().optional(),
    qrEnabled: z.boolean().optional(),
    lowAttendanceThreshold: z.number().optional(),
    notifyParents: z.boolean().optional(),
    requireNoteForAbsent: z.boolean().optional(),
    lockAfterSubmit: z.boolean().optional(),
    trackHalfDay: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    attendanceAlerts: z.boolean().optional(),
    allowManualOverride: z.boolean().optional(),
    offlineEnabled: z.boolean().optional(),
    geoTagging: z.boolean().optional(),
    allowExtraClassOnHolidays: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

/** Typed preference state extracted from legacy AttendanceSettings. */
export interface AttendanceModulePreferences {
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
  allowExtraClassOnHolidays: boolean;
  defaultViewLayout: string;
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeAttendanceModulePreferences(raw: unknown): AttendanceModulePreferences {
  if (!raw || typeof raw !== "object") {
    return {
      workingDays: DEFAULT_ATTENDANCE_SETTINGS.workingDays,
      cutoffTime: DEFAULT_ATTENDANCE_SETTINGS.cutoffTime,
      lateThresholdMins: DEFAULT_ATTENDANCE_SETTINGS.lateThresholdMins,
      autoAbsentAfterMins: DEFAULT_ATTENDANCE_SETTINGS.autoAbsentAfterMins,
      qrEnabled: DEFAULT_ATTENDANCE_SETTINGS.qrEnabled,
      lowAttendanceThreshold: DEFAULT_ATTENDANCE_SETTINGS.lowAttendanceThreshold,
      notifyParents: DEFAULT_ATTENDANCE_SETTINGS.notifyParents,
      requireNoteForAbsent: DEFAULT_ATTENDANCE_SETTINGS.requireNoteForAbsent,
      lockAfterSubmit: DEFAULT_ATTENDANCE_SETTINGS.lockAfterSubmit,
      trackHalfDay: DEFAULT_ATTENDANCE_SETTINGS.trackHalfDay,
      weeklyReport: DEFAULT_ATTENDANCE_SETTINGS.weeklyReport,
      attendanceAlerts: DEFAULT_ATTENDANCE_SETTINGS.attendanceAlerts,
      allowManualOverride: DEFAULT_ATTENDANCE_SETTINGS.allowManualOverride,
      offlineEnabled: DEFAULT_ATTENDANCE_SETTINGS.offlineEnabled,
      geoTagging: DEFAULT_ATTENDANCE_SETTINGS.geoTagging,
      allowExtraClassOnHolidays: DEFAULT_ATTENDANCE_SETTINGS.allowExtraClassOnHolidays,
      defaultViewLayout: DEFAULT_ATTENDANCE_SETTINGS.defaultViewLayout || "list",
    };
  }

  const prefs = raw as Partial<AttendanceModulePreferences>;
  return {
    workingDays: Array.isArray(prefs.workingDays)
      ? prefs.workingDays
      : DEFAULT_ATTENDANCE_SETTINGS.workingDays,
    cutoffTime:
      typeof prefs.cutoffTime === "string"
        ? prefs.cutoffTime
        : DEFAULT_ATTENDANCE_SETTINGS.cutoffTime,
    lateThresholdMins:
      typeof prefs.lateThresholdMins === "number"
        ? prefs.lateThresholdMins
        : DEFAULT_ATTENDANCE_SETTINGS.lateThresholdMins,
    autoAbsentAfterMins:
      typeof prefs.autoAbsentAfterMins === "number"
        ? prefs.autoAbsentAfterMins
        : DEFAULT_ATTENDANCE_SETTINGS.autoAbsentAfterMins,
    qrEnabled:
      typeof prefs.qrEnabled === "boolean"
        ? prefs.qrEnabled
        : DEFAULT_ATTENDANCE_SETTINGS.qrEnabled,
    lowAttendanceThreshold:
      typeof prefs.lowAttendanceThreshold === "number"
        ? prefs.lowAttendanceThreshold
        : DEFAULT_ATTENDANCE_SETTINGS.lowAttendanceThreshold,
    notifyParents:
      typeof prefs.notifyParents === "boolean"
        ? prefs.notifyParents
        : DEFAULT_ATTENDANCE_SETTINGS.notifyParents,
    requireNoteForAbsent:
      typeof prefs.requireNoteForAbsent === "boolean"
        ? prefs.requireNoteForAbsent
        : DEFAULT_ATTENDANCE_SETTINGS.requireNoteForAbsent,
    lockAfterSubmit:
      typeof prefs.lockAfterSubmit === "boolean"
        ? prefs.lockAfterSubmit
        : DEFAULT_ATTENDANCE_SETTINGS.lockAfterSubmit,
    trackHalfDay:
      typeof prefs.trackHalfDay === "boolean"
        ? prefs.trackHalfDay
        : DEFAULT_ATTENDANCE_SETTINGS.trackHalfDay,
    weeklyReport:
      typeof prefs.weeklyReport === "boolean"
        ? prefs.weeklyReport
        : DEFAULT_ATTENDANCE_SETTINGS.weeklyReport,
    attendanceAlerts:
      typeof prefs.attendanceAlerts === "boolean"
        ? prefs.attendanceAlerts
        : DEFAULT_ATTENDANCE_SETTINGS.attendanceAlerts,
    allowManualOverride:
      typeof prefs.allowManualOverride === "boolean"
        ? prefs.allowManualOverride
        : DEFAULT_ATTENDANCE_SETTINGS.allowManualOverride,
    offlineEnabled:
      typeof prefs.offlineEnabled === "boolean"
        ? prefs.offlineEnabled
        : DEFAULT_ATTENDANCE_SETTINGS.offlineEnabled,
    geoTagging:
      typeof prefs.geoTagging === "boolean"
        ? prefs.geoTagging
        : DEFAULT_ATTENDANCE_SETTINGS.geoTagging,
    allowExtraClassOnHolidays: prefs.allowExtraClassOnHolidays === true,
    defaultViewLayout:
      typeof prefs.defaultViewLayout === "string"
        ? prefs.defaultViewLayout
        : DEFAULT_ATTENDANCE_SETTINGS.defaultViewLayout || "list",
  };
}
