import { z } from "zod";
import type { TabDefinition } from "./contactTypes.js";
import { DEFAULT_FACULTY_SETTINGS, type FacultySettings } from "./facultyModuleSettings.js";
import { FACULTY_TAB_REGISTRY } from "./moduleFieldSetupPersons.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";
import {
  FACULTY_MODULE_PREFERENCE_KEYS,
  type FacultyModulePreferences,
  normalizeFacultyModulePreferences,
} from "./facultyPreferencesNormalization.js";

export {
  FACULTY_MODULE_PREFERENCE_KEYS,
  type FacultyModulePreferences,
  normalizeFacultyModulePreferences,
};

/** PUT /api/faculty/field-config — field registry JSON without formTabs SSOT. */
const facultyFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const facultyFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, facultyFieldConfigPutBodyBaseSchema);

/** PUT /api/faculty/preferences — employee ID prefs (contact link is always required). */
export const facultyPreferencesPutBodySchema = z
  .object({
    idPrefix: z.string().optional(),
    idTemplate: z.string().optional(),
    idDigits: z.number().optional(),
    idStartSeq: z.number().optional(),
    idRestartAnnually: z.boolean().optional(),
    employeeIdPrefix: z.string().optional(),
    employeeIdYearFormat: z.enum(["YYYY", "YY"]).optional(),
    employeeIdSequenceDigits: z.number().int().min(2).max(8).optional(),
    employeeIdDelimiter: z.string().optional(),
    employeeIdLastYear: z.number().optional(),
    employeeIdCurrentSequence: z.number().optional(),
    autoGenerateId: z.boolean().optional(),
    requireContactLink: z.boolean().optional(),
    defaultSpecialization: z.string().optional(),
  })
  .passthrough();

/** Field-config slice persisted on `faculty_field_configs` (never formTabs / module prefs). */
export function stripFacultyFieldConfigForPersist(
  config: FacultySettings | Record<string, unknown>,
): Record<string, unknown> {
  const {
    formTabs: _formTabs,
    idPrefix: _idPrefix,
    idTemplate: _idTemplate,
    idDigits: _idDigits,
    idStartSeq: _idStartSeq,
    idRestartAnnually: _idRestartAnnually,
    autoGenerateId: _autoGenerateId,
    requireContactLink: _requireContactLink,
    defaultSpecialization: _defaultSpecialization,
    ...rest
  } = config as FacultySettings & Record<string, unknown>;
  return rest;
}

/** Normalize FacultySettings from typed REST or document blobs. */
export function normalizeFacultySettings(config: unknown): FacultySettings {
  const defaults = { ...DEFAULT_FACULTY_SETTINGS, formTabs: [...FACULTY_TAB_REGISTRY] };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...defaults };
  }
  const raw = config as Record<string, unknown>;
  const prefs = normalizeFacultyModulePreferences(raw);
  const merged: FacultySettings = {
    ...defaults,
    ...(raw as Partial<FacultySettings>),
    ...prefs,
    fieldOrder: Array.isArray(raw.fieldOrder) ? (raw.fieldOrder as string[]) : defaults.fieldOrder,
    formTabs: Array.isArray(raw.formTabs) ? (raw.formTabs as TabDefinition[]) : defaults.formTabs,
    enabledTabs: Array.isArray(raw.enabledTabs)
      ? (raw.enabledTabs as string[])
      : (raw.enabledTabs as string[] | undefined),
    requiredTabs: Array.isArray(raw.requiredTabs)
      ? (raw.requiredTabs as string[])
      : (raw.requiredTabs as string[] | undefined),
    fields:
      raw.fields &&
      typeof raw.fields === "object" &&
      !Array.isArray(raw.fields) &&
      Object.keys(raw.fields).length > 0
        ? (raw.fields as FacultySettings["fields"])
        : defaults.fields,
    columnRegistry: Array.isArray(raw.columnRegistry)
      ? (raw.columnRegistry as FacultySettings["columnRegistry"])
      : (raw.columnRegistry as FacultySettings["columnRegistry"]),
  };
  delete (merged as FacultySettings & { defaultViewLayout?: unknown }).defaultViewLayout;
  delete (merged as FacultySettings & { customFields?: unknown }).customFields;
  return merged;
}

/** Split a `faculty_settings` blob into typed field-config + preferences rows. */
export function splitFacultySettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: FacultyModulePreferences;
} {
  const settings = normalizeFacultySettings(raw);
  return {
    fieldConfig: stripFacultyFieldConfigForPersist(settings),
    preferences: normalizeFacultyModulePreferences(settings),
  };
}

/** Compose FE/validation FacultySettings from typed parts (+ optional custom tabs). */
export function composeFacultySettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): FacultySettings {
  const prefs = normalizeFacultyModulePreferences(
    preferences as Partial<FacultyModulePreferences> | null,
  );
  return normalizeFacultySettings({
    ...(fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
}

/** Merge API custom_tabs with default form tabs for Faculty Setup/forms. */
export function mergeFacultyFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [...FACULTY_TAB_REGISTRY];
  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...FACULTY_TAB_REGISTRY.filter(
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
