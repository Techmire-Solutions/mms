import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import {
  DEFAULT_ENROLLMENTS_SETTINGS,
  type EnrollmentsSettings,
} from "./enrollmentsModuleSettings.js";
import {
  ENROLLMENTS_TAB_REGISTRY,
  INITIAL_ENROLLMENTS_FIELD_SEED,
} from "./moduleFieldSetupAcademic.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";

/** Deep clone {@link INITIAL_ENROLLMENTS_FIELD_SEED} for default and Setup states. */
export function cloneEnrollmentFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_ENROLLMENTS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isEnrollmentSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_ENROLLMENTS_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Enrollments. */
export function isEnrollmentSeedFormTab(tabKey: string): boolean {
  return ENROLLMENTS_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Setup tab). */
export function isEnrollmentLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Enrollments `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_ENROLLMENTS_FIELD_SEED}.
 */
export function resolveEnrollmentFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneEnrollmentFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneEnrollmentFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_ENROLLMENTS_FIELD_SEED)) {
      if (!tabbed[tabId]) {
        tabbed[tabId] = seedFields.map((f) => ({ ...f }));
      } else {
        const existingKeys = new Set(tabbed[tabId].map((f) => f.key));
        for (const seedField of seedFields) {
          if (!existingKeys.has(seedField.key)) {
            tabbed[tabId].push({ ...seedField });
          }
        }
      }
    }
    return tabbed;
  }

  const flat = getFlatFieldsConfig(fields);
  const tabbed = cloneEnrollmentFieldSeed();
  for (const tabFields of Object.values(tabbed)) {
    for (let index = 0; index < tabFields.length; index += 1) {
      const field = tabFields[index];
      const flags = flat[field.key];
      if (!flags) continue;
      tabFields[index] = {
        ...field,
        enabled: flags.enabled !== false,
        required: flags.required ?? field.required,
      };
    }
  }
  return tabbed;
}

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

/** PUT /api/enrollments/preferences — enrollment prefs only. */
export const enrollmentPreferencesPutBodySchema = z
  .object({
    maxStudentsPerClass: z.string().optional(),
    waitlistEnabled: z.boolean().optional(),
    requireEligibilityCheck: z.boolean().optional(),
    autoAssignClass: z.boolean().optional(),
    enrollmentApproval: z.boolean().optional(),
    allowTransfers: z.boolean().optional(),
    dropDeadlineDays: z.string().optional(),
    reenrollmentReminder: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

export type EnrollmentModulePreferences = Pick<
  EnrollmentsSettings,
  | "maxStudentsPerClass"
  | "waitlistEnabled"
  | "requireEligibilityCheck"
  | "autoAssignClass"
  | "enrollmentApproval"
  | "allowTransfers"
  | "dropDeadlineDays"
  | "reenrollmentReminder"
  | "defaultViewLayout"
>;

const PREF_KEYS = [
  "maxStudentsPerClass",
  "waitlistEnabled",
  "requireEligibilityCheck",
  "autoAssignClass",
  "enrollmentApproval",
  "allowTransfers",
  "dropDeadlineDays",
  "reenrollmentReminder",
  "defaultViewLayout",
] as const;

function normalizeViewLayout(value: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed === "table" || trimmed === "cards" || trimmed === "list") return trimmed;
  return DEFAULT_ENROLLMENTS_SETTINGS.defaultViewLayout ?? "list";
}

/** Normalize Enrollments module preferences (typed `enrollment_module_preferences`). */
export function normalizeEnrollmentModulePreferences(
  partial?: Partial<EnrollmentModulePreferences> | Record<string, unknown> | null,
): EnrollmentModulePreferences {
  const defaults: EnrollmentModulePreferences = {
    maxStudentsPerClass: DEFAULT_ENROLLMENTS_SETTINGS.maxStudentsPerClass,
    waitlistEnabled: DEFAULT_ENROLLMENTS_SETTINGS.waitlistEnabled,
    requireEligibilityCheck: DEFAULT_ENROLLMENTS_SETTINGS.requireEligibilityCheck,
    autoAssignClass: DEFAULT_ENROLLMENTS_SETTINGS.autoAssignClass,
    enrollmentApproval: DEFAULT_ENROLLMENTS_SETTINGS.enrollmentApproval,
    allowTransfers: DEFAULT_ENROLLMENTS_SETTINGS.allowTransfers,
    dropDeadlineDays: DEFAULT_ENROLLMENTS_SETTINGS.dropDeadlineDays,
    reenrollmentReminder: DEFAULT_ENROLLMENTS_SETTINGS.reenrollmentReminder,
    defaultViewLayout: DEFAULT_ENROLLMENTS_SETTINGS.defaultViewLayout,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  return {
    maxStudentsPerClass:
      typeof partial.maxStudentsPerClass === "string" && partial.maxStudentsPerClass.trim()
        ? partial.maxStudentsPerClass.trim()
        : defaults.maxStudentsPerClass,
    waitlistEnabled:
      typeof partial.waitlistEnabled === "boolean"
        ? partial.waitlistEnabled
        : defaults.waitlistEnabled,
    requireEligibilityCheck:
      typeof partial.requireEligibilityCheck === "boolean"
        ? partial.requireEligibilityCheck
        : defaults.requireEligibilityCheck,
    autoAssignClass:
      typeof partial.autoAssignClass === "boolean"
        ? partial.autoAssignClass
        : defaults.autoAssignClass,
    enrollmentApproval:
      typeof partial.enrollmentApproval === "boolean"
        ? partial.enrollmentApproval
        : defaults.enrollmentApproval,
    allowTransfers:
      typeof partial.allowTransfers === "boolean"
        ? partial.allowTransfers
        : defaults.allowTransfers,
    dropDeadlineDays:
      typeof partial.dropDeadlineDays === "string" && partial.dropDeadlineDays.trim()
        ? partial.dropDeadlineDays.trim()
        : defaults.dropDeadlineDays,
    reenrollmentReminder:
      typeof partial.reenrollmentReminder === "boolean"
        ? partial.reenrollmentReminder
        : defaults.reenrollmentReminder,
    defaultViewLayout: normalizeViewLayout(
      typeof partial.defaultViewLayout === "string"
        ? partial.defaultViewLayout
        : defaults.defaultViewLayout,
    ),
  };
}

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

export { PREF_KEYS as ENROLLMENT_MODULE_PREFERENCE_KEYS };
