/** Attendance settings composition: field-config schema, normalize/compose/strip, tab merge. */
import { z } from "zod";
import type { TabDefinition } from "../contacts/contactTypes.js";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
} from "./attendanceModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import { resolveAttendanceFieldsMap } from "./attendanceSetupFields.js";
import type { AttendanceModulePreferences } from "./attendanceSetupPreferences.js";

/** PUT /api/attendance/field-config — field registry JSON without prefs keys. */
const attendanceFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
    fieldOrder: z.array(z.string()).optional(),
    formTabs: z.array(z.record(z.string(), z.unknown())).optional(),
    enabledTabs: z.array(z.string()).optional(),
    requiredTabs: z.array(z.string()).optional(),
  })
  .strict();

export const attendanceFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceFieldConfigPutBodyBaseSchema);

/** Extracts field-config slice from a raw composed settings blob. */
export function normalizeAttendanceSettings(raw: unknown): AttendanceSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ATTENDANCE_SETTINGS };
  }

  const safe = raw as Partial<AttendanceSettings>;
  return {
    workingDays: DEFAULT_ATTENDANCE_SETTINGS.workingDays, // managed by preferences
    cutoffTime: DEFAULT_ATTENDANCE_SETTINGS.cutoffTime, // managed by preferences
    lateThresholdMins: DEFAULT_ATTENDANCE_SETTINGS.lateThresholdMins, // managed by preferences
    autoAbsentAfterMins: DEFAULT_ATTENDANCE_SETTINGS.autoAbsentAfterMins, // managed by preferences
    qrEnabled: DEFAULT_ATTENDANCE_SETTINGS.qrEnabled, // managed by preferences
    lowAttendanceThreshold: DEFAULT_ATTENDANCE_SETTINGS.lowAttendanceThreshold, // managed by preferences
    notifyParents: DEFAULT_ATTENDANCE_SETTINGS.notifyParents, // managed by preferences
    requireNoteForAbsent: DEFAULT_ATTENDANCE_SETTINGS.requireNoteForAbsent, // managed by preferences
    lockAfterSubmit: DEFAULT_ATTENDANCE_SETTINGS.lockAfterSubmit, // managed by preferences
    trackHalfDay: DEFAULT_ATTENDANCE_SETTINGS.trackHalfDay, // managed by preferences
    weeklyReport: DEFAULT_ATTENDANCE_SETTINGS.weeklyReport, // managed by preferences
    attendanceAlerts: DEFAULT_ATTENDANCE_SETTINGS.attendanceAlerts, // managed by preferences
    allowManualOverride: DEFAULT_ATTENDANCE_SETTINGS.allowManualOverride, // managed by preferences
    offlineEnabled: DEFAULT_ATTENDANCE_SETTINGS.offlineEnabled, // managed by preferences
    geoTagging: DEFAULT_ATTENDANCE_SETTINGS.geoTagging, // managed by preferences
    defaultViewLayout: DEFAULT_ATTENDANCE_SETTINGS.defaultViewLayout, // managed by preferences
    fields: resolveAttendanceFieldsMap(
      safe.fields && typeof safe.fields === "object" && !Array.isArray(safe.fields)
        ? (safe.fields as Record<string, unknown>)
        : undefined,
    ),
    customFields: safe.customFields ?? DEFAULT_ATTENDANCE_SETTINGS.customFields ?? [],
    fieldOrder: safe.fieldOrder ?? DEFAULT_ATTENDANCE_SETTINGS.fieldOrder ?? [],
    formTabs: safe.formTabs,
    enabledTabs: safe.enabledTabs,
    requiredTabs: safe.requiredTabs,
  };
}

/** Recomposes preferences and field-config into the legacy flat settings shape. */
export function composeAttendanceSettings(
  fieldConfig: AttendanceSettings | null,
  prefs: AttendanceModulePreferences,
  formTabs?: TabDefinition[],
): AttendanceSettings {
  return {
    ...(fieldConfig ?? DEFAULT_ATTENDANCE_SETTINGS),
    workingDays: prefs.workingDays,
    cutoffTime: prefs.cutoffTime,
    lateThresholdMins: prefs.lateThresholdMins,
    autoAbsentAfterMins: prefs.autoAbsentAfterMins,
    qrEnabled: prefs.qrEnabled,
    lowAttendanceThreshold: prefs.lowAttendanceThreshold,
    notifyParents: prefs.notifyParents,
    requireNoteForAbsent: prefs.requireNoteForAbsent,
    lockAfterSubmit: prefs.lockAfterSubmit,
    trackHalfDay: prefs.trackHalfDay,
    weeklyReport: prefs.weeklyReport,
    attendanceAlerts: prefs.attendanceAlerts,
    allowManualOverride: prefs.allowManualOverride,
    offlineEnabled: prefs.offlineEnabled,
    geoTagging: prefs.geoTagging,
    defaultViewLayout: prefs.defaultViewLayout,
    formTabs: formTabs ?? fieldConfig?.formTabs,
  };
}

/** Drops preference keys before saving field-config to avoid overriding prefs layer. */
export function stripAttendanceFieldConfigForPersist(
  config: Partial<AttendanceSettings>,
): Partial<AttendanceSettings> {
  // `name: _name` aliases: the bound locals exist only to omit preference keys from the rest object.
  const {
    workingDays: _workingDays,
    cutoffTime: _cutoffTime,
    lateThresholdMins: _lateThresholdMins,
    autoAbsentAfterMins: _autoAbsentAfterMins,
    qrEnabled: _qrEnabled,
    lowAttendanceThreshold: _lowAttendanceThreshold,
    notifyParents: _notifyParents,
    requireNoteForAbsent: _requireNoteForAbsent,
    lockAfterSubmit: _lockAfterSubmit,
    trackHalfDay: _trackHalfDay,
    weeklyReport: _weeklyReport,
    attendanceAlerts: _attendanceAlerts,
    allowManualOverride: _allowManualOverride,
    offlineEnabled: _offlineEnabled,
    geoTagging: _geoTagging,
    defaultViewLayout: _defaultViewLayout,
    ...fieldConfigOnly
  } = config;
  return fieldConfigOnly;
}

export function mergeAttendanceFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
): TabDefinition[] {
  const documentOrDefault = documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [];
  const merged = apiTabs.length === 0 ? documentOrDefault : [...apiTabs];
  const seenKeys = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}
