/** Attendance module preferences: schema, type, and normalization. */
import { z } from "zod";
import { DEFAULT_ATTENDANCE_SETTINGS } from "./attendanceModuleSettings.js";

/** 24-hour `HH:mm` — the only shape the cut-off / late-grace rules can compare. */
export const ATTENDANCE_CLOCK_SCHEMA = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:mm time");

/** A policy minute budget: whole minutes, bounded so one typo cannot make every student late. */
export const ATTENDANCE_MINUTES_SCHEMA = z.number().int().min(0).max(240);

/**
 * PUT /api/attendance/preferences — attendance prefs only.
 *
 * The minute/time fields are validated here because the domain rules read them directly: an
 * unparseable cut-off makes the cut-off rule silently inert, and `lateThresholdMins` greater than
 * `autoAbsentAfterMins` means "absent" can never follow "late".
 */
export const attendancePreferencesPutBodySchema = z
  .object({
    workingDays: z.array(z.string()).optional(),
    cutoffTime: ATTENDANCE_CLOCK_SCHEMA.optional(),
    lateThresholdMins: ATTENDANCE_MINUTES_SCHEMA.optional(),
    autoAbsentAfterMins: ATTENDANCE_MINUTES_SCHEMA.optional(),
    qrEnabled: z.boolean().optional(),
    lowAttendanceThreshold: z.number().min(0).max(100).optional(),
    absenceStreakThreshold: z.number().int().min(1).max(30).optional(),
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
  .passthrough()
  .refine(
    (prefs) =>
      prefs.lateThresholdMins === undefined ||
      prefs.autoAbsentAfterMins === undefined ||
      prefs.lateThresholdMins <= prefs.autoAbsentAfterMins,
    {
      message: "The late threshold cannot exceed the auto-absent threshold",
      path: ["lateThresholdMins"],
    },
  );

/** Typed preference state extracted from legacy AttendanceSettings. */
export interface AttendanceModulePreferences {
  workingDays: string[];
  cutoffTime: string;
  lateThresholdMins: number;
  autoAbsentAfterMins: number;
  qrEnabled: boolean;
  lowAttendanceThreshold: number;
  absenceStreakThreshold: number;
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

/** A stored clock value that no longer parses falls back to the school default, never to inert JSON. */
function sanitizeClock(value: unknown, fallback: string): string {
  const parsed = ATTENDANCE_CLOCK_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

/** A stored streak threshold: whole absences, 1–30, defaulting to the school default. */
function sanitizeStreakThreshold(value: unknown): number {
  const fallback = DEFAULT_ATTENDANCE_SETTINGS.absenceStreakThreshold;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 1), 30);
}

/** Same for a stored minute budget: out-of-range values are clamped, not trusted. */
function sanitizeMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), 0), 240);
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
      absenceStreakThreshold: DEFAULT_ATTENDANCE_SETTINGS.absenceStreakThreshold,
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
  const cutoffTime = sanitizeClock(prefs.cutoffTime, DEFAULT_ATTENDANCE_SETTINGS.cutoffTime);
  const lateThresholdMins = sanitizeMinutes(
    prefs.lateThresholdMins,
    DEFAULT_ATTENDANCE_SETTINGS.lateThresholdMins,
  );
  const autoAbsentAfterMins = sanitizeMinutes(
    prefs.autoAbsentAfterMins,
    DEFAULT_ATTENDANCE_SETTINGS.autoAbsentAfterMins,
  );
  return {
    workingDays: Array.isArray(prefs.workingDays)
      ? prefs.workingDays
      : DEFAULT_ATTENDANCE_SETTINGS.workingDays,
    cutoffTime,
    // The grace window can never exceed the auto-absent window; clamp rather than leave the
    // domain with "absent can never follow late".
    lateThresholdMins: Math.min(lateThresholdMins, autoAbsentAfterMins),
    autoAbsentAfterMins,
    qrEnabled:
      typeof prefs.qrEnabled === "boolean"
        ? prefs.qrEnabled
        : DEFAULT_ATTENDANCE_SETTINGS.qrEnabled,
    lowAttendanceThreshold:
      typeof prefs.lowAttendanceThreshold === "number"
        ? prefs.lowAttendanceThreshold
        : DEFAULT_ATTENDANCE_SETTINGS.lowAttendanceThreshold,
    absenceStreakThreshold: sanitizeStreakThreshold(prefs.absenceStreakThreshold),
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
