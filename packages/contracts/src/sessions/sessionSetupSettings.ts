/** Sessions settings composition: field-config schema, persistence split, and merge. */
import type { TabDefinition } from "../contacts/contactTypes.js";
import { SESSIONS_TAB_REGISTRY } from "../settings/moduleFieldSetupAcademic.js";
import { DEFAULT_SESSIONS_SETTINGS, type SessionsSettings } from "./sessionsModuleSettings.js";
import { resolveSessionsFieldsMap } from "./sessionSetupFields.js";
import {
  normalizeSessionModulePreferences,
  type SessionModulePreferences,
} from "./sessionSetupPreferences.js";

/** Field-config slice persisted on `session_field_configs` (never formTabs / module prefs). */
export function stripSessionFieldConfigForPersist(
  config: SessionsSettings | Record<string, unknown>,
): Record<string, unknown> {
  const {
    formTabs: _formTabs,
    defaultDuration: _defaultDuration,
    defaultSessionType: _defaultSessionType,
    allowOverlap: _allowOverlap,
    archiveOldSessions: _archiveOldSessions,
    requireBudget: _requireBudget,
    timetableConflictCheck: _timetableConflictCheck,
    notifyOnSessionStart: _notifyOnSessionStart,
    academicYear: _academicYear,
    sessionStart: _sessionStart,
    defaultViewLayout: _defaultViewLayout,
    terminology: _terminology,
    ...rest
  } = config as SessionsSettings & Record<string, unknown>;
  return rest;
}

/** Normalize SessionsSettings from typed REST or legacy document blobs. */
export function normalizeSessionsSettings(config: unknown): SessionsSettings {
  const defaults = { ...DEFAULT_SESSIONS_SETTINGS, formTabs: [...SESSIONS_TAB_REGISTRY] };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...defaults };
  }
  const raw = config as Record<string, unknown>;
  const prefs = normalizeSessionModulePreferences(raw);
  return {
    ...defaults,
    ...(raw as Partial<SessionsSettings>),
    ...prefs,
    customFields: Array.isArray(raw.customFields)
      ? (raw.customFields as SessionsSettings["customFields"])
      : defaults.customFields,
    fieldOrder: Array.isArray(raw.fieldOrder) ? (raw.fieldOrder as string[]) : defaults.fieldOrder,
    formTabs: Array.isArray(raw.formTabs) ? (raw.formTabs as TabDefinition[]) : defaults.formTabs,
    enabledTabs: Array.isArray(raw.enabledTabs)
      ? (raw.enabledTabs as string[])
      : (raw.enabledTabs as string[] | undefined),
    requiredTabs: Array.isArray(raw.requiredTabs)
      ? (raw.requiredTabs as string[])
      : (raw.requiredTabs as string[] | undefined),
    fields: resolveSessionsFieldsMap(
      raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
        ? (raw.fields as Record<string, unknown>)
        : undefined,
    ),
  };
}

/** Compose FE/validation SessionsSettings from typed parts (+ optional custom tabs). */
export function composeSessionsSettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): SessionsSettings {
  const prefs = normalizeSessionModulePreferences(
    preferences as Partial<SessionModulePreferences> | null,
  );
  return normalizeSessionsSettings({
    ...(fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
}
