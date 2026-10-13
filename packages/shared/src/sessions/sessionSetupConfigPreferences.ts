import { DEFAULT_SESSIONS_SETTINGS, type SessionsSettings } from "./sessionsModuleSettings.js";
import { normalizeSessionsViewLayout } from "./sessionsExportUtils.js";

export type SessionModulePreferences = Pick<
  SessionsSettings,
  | "defaultDuration"
  | "defaultSessionType"
  | "allowOverlap"
  | "archiveOldSessions"
  | "requireBudget"
  | "timetableConflictCheck"
  | "notifyOnSessionStart"
  | "academicYear"
  | "sessionStart"
  | "defaultViewLayout"
>;

const PREF_KEYS = [
  "defaultDuration",
  "defaultSessionType",
  "allowOverlap",
  "archiveOldSessions",
  "requireBudget",
  "timetableConflictCheck",
  "notifyOnSessionStart",
  "academicYear",
  "sessionStart",
  "defaultViewLayout",
] as const;

/** Normalize Sessions module preferences (typed `session_module_preferences`). */
export function normalizeSessionModulePreferences(
  partial?: Partial<SessionModulePreferences> | Record<string, unknown> | null,
): SessionModulePreferences {
  const defaults: SessionModulePreferences = {
    defaultDuration: DEFAULT_SESSIONS_SETTINGS.defaultDuration,
    defaultSessionType: DEFAULT_SESSIONS_SETTINGS.defaultSessionType,
    allowOverlap: DEFAULT_SESSIONS_SETTINGS.allowOverlap,
    archiveOldSessions: DEFAULT_SESSIONS_SETTINGS.archiveOldSessions,
    requireBudget: DEFAULT_SESSIONS_SETTINGS.requireBudget,
    timetableConflictCheck: DEFAULT_SESSIONS_SETTINGS.timetableConflictCheck,
    notifyOnSessionStart: DEFAULT_SESSIONS_SETTINGS.notifyOnSessionStart,
    academicYear: DEFAULT_SESSIONS_SETTINGS.academicYear,
    sessionStart: DEFAULT_SESSIONS_SETTINGS.sessionStart,
    defaultViewLayout: DEFAULT_SESSIONS_SETTINGS.defaultViewLayout,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  return {
    defaultDuration:
      typeof partial.defaultDuration === "string" && partial.defaultDuration.trim()
        ? partial.defaultDuration.trim()
        : defaults.defaultDuration,
    defaultSessionType:
      typeof partial.defaultSessionType === "string" && partial.defaultSessionType.trim()
        ? partial.defaultSessionType.trim()
        : defaults.defaultSessionType,
    allowOverlap:
      typeof partial.allowOverlap === "boolean" ? partial.allowOverlap : defaults.allowOverlap,
    archiveOldSessions:
      typeof partial.archiveOldSessions === "boolean"
        ? partial.archiveOldSessions
        : defaults.archiveOldSessions,
    requireBudget:
      typeof partial.requireBudget === "boolean" ? partial.requireBudget : defaults.requireBudget,
    timetableConflictCheck:
      typeof partial.timetableConflictCheck === "boolean"
        ? partial.timetableConflictCheck
        : defaults.timetableConflictCheck,
    notifyOnSessionStart:
      typeof partial.notifyOnSessionStart === "boolean"
        ? partial.notifyOnSessionStart
        : defaults.notifyOnSessionStart,
    academicYear:
      typeof partial.academicYear === "string" && partial.academicYear.trim()
        ? partial.academicYear.trim()
        : defaults.academicYear,
    sessionStart:
      typeof partial.sessionStart === "string" && partial.sessionStart.trim()
        ? partial.sessionStart.trim()
        : defaults.sessionStart,
    defaultViewLayout: normalizeSessionsViewLayout(
      typeof partial.defaultViewLayout === "string"
        ? partial.defaultViewLayout
        : defaults.defaultViewLayout,
    ),
  };
}

export { PREF_KEYS as SESSION_MODULE_PREFERENCE_KEYS };
