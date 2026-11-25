/** Enrollments settings composition: field-config schema, normalize/compose/strip, tab merge. */
import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import {
  DEFAULT_ENROLLMENTS_SETTINGS,
  type EnrollmentsSettings,
} from "./enrollmentsModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import { ENROLLMENTS_TAB_REGISTRY } from "../settings/moduleFieldSetupAcademic.js";
import { resolveEnrollmentFieldsMap } from "./enrollmentSetupFields.js";
import {
  normalizeEnrollmentModulePreferences,
  type EnrollmentModulePreferences,
} from "./enrollmentSetupPreferences.js";

/** PUT /api/enrollments/field-config — field registry JSON without formTabs SSOT. */
const enrollmentFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const enrollmentFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, enrollmentFieldConfigPutBodyBaseSchema);

/** Field-config slice persisted on `enrollment_field_configs` (never formTabs / module prefs). */
export function stripEnrollmentFieldConfigForPersist(
  config: EnrollmentsSettings | Record<string, unknown>,
): Record<string, unknown> {
  const {
    formTabs: _formTabs,
    maxStudentsPerClass: _maxStudentsPerClass,
    waitlistEnabled: _waitlistEnabled,
    requireEligibilityCheck: _requireEligibilityCheck,
    autoAssignClass: _autoAssignClass,
    enrollmentApproval: _enrollmentApproval,
    allowTransfers: _allowTransfers,
    dropDeadlineDays: _dropDeadlineDays,
    reenrollmentReminder: _reenrollmentReminder,
    defaultViewLayout: _defaultViewLayout,
    ...rest
  } = config as EnrollmentsSettings & Record<string, unknown>;
  return rest;
}

/** Normalize EnrollmentsSettings from typed REST or legacy document blobs. */
export function normalizeEnrollmentsSettings(config: unknown): EnrollmentsSettings {
  const defaults = { ...DEFAULT_ENROLLMENTS_SETTINGS, formTabs: [...ENROLLMENTS_TAB_REGISTRY] };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...defaults };
  }
  const raw = config as Record<string, unknown>;
  const prefs = normalizeEnrollmentModulePreferences(raw);
  return {
    ...defaults,
    ...(raw as Partial<EnrollmentsSettings>),
    ...prefs,
    customFields: Array.isArray(raw.customFields)
      ? (raw.customFields as EnrollmentsSettings["customFields"])
      : defaults.customFields,
    fieldOrder: Array.isArray(raw.fieldOrder) ? (raw.fieldOrder as string[]) : defaults.fieldOrder,
    formTabs: Array.isArray(raw.formTabs) ? (raw.formTabs as TabDefinition[]) : defaults.formTabs,
    enabledTabs: Array.isArray(raw.enabledTabs)
      ? (raw.enabledTabs as string[])
      : (raw.enabledTabs as string[] | undefined),
    requiredTabs: Array.isArray(raw.requiredTabs)
      ? (raw.requiredTabs as string[])
      : (raw.requiredTabs as string[] | undefined),
    fields: resolveEnrollmentFieldsMap(
      raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
        ? (raw.fields as Record<string, unknown>)
        : undefined,
    ),
  };
}

/** Split a legacy `enrollments_settings` blob into typed field-config + preferences rows. */
export function splitEnrollmentsSettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: EnrollmentModulePreferences;
} {
  const settings = normalizeEnrollmentsSettings(raw);
  return {
    fieldConfig: stripEnrollmentFieldConfigForPersist(settings),
    preferences: normalizeEnrollmentModulePreferences(settings),
  };
}

/** Compose FE/validation EnrollmentsSettings from typed parts (+ optional custom tabs). */
export function composeEnrollmentsSettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): EnrollmentsSettings {
  const prefs = normalizeEnrollmentModulePreferences(
    preferences as Partial<EnrollmentModulePreferences> | null,
  );
  return normalizeEnrollmentsSettings({
    ...(fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
}

/**
 * Merge API custom_tabs with document/default form tabs for Enrollments Setup/forms.
 */
export function mergeEnrollmentsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  _fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0
      ? documentFormTabs
      : [...ENROLLMENTS_TAB_REGISTRY];

  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...ENROLLMENTS_TAB_REGISTRY.filter(
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
