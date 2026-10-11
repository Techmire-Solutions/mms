/** Sessions settings composition: field-config schema, persistence split, and merge. */
import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import { SESSIONS_TAB_REGISTRY } from "./moduleFieldSetupAcademic.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";
import { DEFAULT_SESSIONS_SETTINGS, type SessionsSettings } from "./sessionsModuleSettings.js";
import { resolveSessionsFieldsMap } from "./sessionSetupFields.js";
import {
  normalizeSessionModulePreferences,
  type SessionModulePreferences,
} from "./sessionSetupPreferences.js";

/** PUT /api/sessions/field-config — field registry JSON without formTabs SSOT. */
const sessionFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const sessionFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, sessionFieldConfigPutBodyBaseSchema);

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

/** Split a legacy `sessions_settings` blob into typed field-config + preferences rows. */
export function splitSessionsSettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: SessionModulePreferences;
} {
  const settings = normalizeSessionsSettings(raw);
  return {
    fieldConfig: stripSessionFieldConfigForPersist(settings),
    preferences: normalizeSessionModulePreferences(settings),
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

/**
 * Merge API custom_tabs with document/default form tabs for Sessions Setup/forms.
 */
export function mergeSessionsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  _fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [...SESSIONS_TAB_REGISTRY];

  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...SESSIONS_TAB_REGISTRY.filter(
            (seedTab) => !apiTabs.some((apiTab) => apiTab.key === seedTab.key),
          ),
        ];

  const seenKeys = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}
