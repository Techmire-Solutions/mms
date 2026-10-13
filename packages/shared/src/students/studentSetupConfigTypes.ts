import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import { type StudentsSettings } from "./studentsModuleSettings.js";
import {
  STUDENT_TAB_REGISTRY,
  STUDENT_LOCKED_ENABLED_TABS,
} from "../settings/moduleFieldSetupPersons.js";
import { normalizeStudentsSettings } from "./studentSettingsUtils.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";

/** PUT /api/students/field-config — field registry JSON without formTabs SSOT. */
const studentFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const studentFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, studentFieldConfigPutBodyBaseSchema);

/** PUT /api/students/preferences — GR / auto-id prefs only. */
export const studentPreferencesPutBodySchema = z
  .object({
    autoGenerateId: z.boolean().optional(),
    grNumberTemplate: z.string().optional(),
    grNumberDigits: z.number().optional(),
    grNumberRestartAnnually: z.boolean().optional(),
  })
  .passthrough();

import {
  type StudentModulePreferences,
  STUDENT_MODULE_PREFERENCE_KEYS,
  normalizeStudentModulePreferences,
} from "./studentPreferencesNormalization.js";

export {
  type StudentModulePreferences,
  STUDENT_MODULE_PREFERENCE_KEYS,
  normalizeStudentModulePreferences,
};

/** Field-config slice persisted on `student_field_configs` (never formTabs / GR prefs). */
export function stripStudentFieldConfigForPersist(
  config: StudentsSettings | Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...config } as Record<string, unknown>;
  delete copy.formTabs;
  for (const key of STUDENT_MODULE_PREFERENCE_KEYS) {
    delete copy[key];
  }
  return copy;
}

/** Split a legacy `students_settings` blob into typed field-config + preferences rows. */
export function splitStudentsSettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: StudentModulePreferences;
} {
  const settings = normalizeStudentsSettings(raw);
  return {
    fieldConfig: stripStudentFieldConfigForPersist(settings),
    preferences: normalizeStudentModulePreferences(settings),
  };
}

/** Compose FE/validation StudentsSettings from typed parts (+ optional custom tabs). */
export function composeStudentsSettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): StudentsSettings {
  const prefs = normalizeStudentModulePreferences(
    preferences as Partial<StudentModulePreferences> | null,
  );
  const merged = normalizeStudentsSettings({
    ...(fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
  return merged;
}

/**
 * Merge API custom_tabs with document/default form tabs for Students Setup/forms.
 * Empty API → document tabs when present, else {@link STUDENT_TAB_REGISTRY}.
 */
export function mergeStudentsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  _fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [...STUDENT_TAB_REGISTRY];

  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...STUDENT_TAB_REGISTRY.filter(
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

/** Default enabled tab ids from the Students tab registry seed. */
export function defaultStudentEnabledTabIds(): string[] {
  return STUDENT_TAB_REGISTRY.filter((tab) => tab.enabled !== false).map((tab) => tab.key);
}

type StudentEnabledTabsInput = {
  enabledTabs?: readonly string[] | null;
  formTabs?: readonly TabDefinition[] | null;
};

function withStudentLockedEnabledTabs(tabIds: Iterable<string>): string[] {
  const set = new Set([...tabIds].map((tabId) => tabId.trim()).filter(Boolean));
  for (const locked of STUDENT_LOCKED_ENABLED_TABS) {
    set.add(locked);
  }
  return [...set];
}

/**
 * Resolves Students form / Setup / detail / export enabled tab ids.
 * When `formTabs` is non-empty, each tab's `enabled` flag is authoritative (Contacts-shaped).
 * Otherwise falls back to non-empty `enabledTabs`, then registry defaults.
 * Locked tabs ({@link STUDENT_LOCKED_ENABLED_TABS}) are always included.
 */
export function resolveStudentEnabledTabIds(settings?: StudentEnabledTabsInput | null): string[] {
  const formTabs = settings?.formTabs;
  if (formTabs && formTabs.length > 0) {
    const fromFormTabs = formTabs.filter((tab) => tab.enabled !== false).map((tab) => tab.key);
    return withStudentLockedEnabledTabs(fromFormTabs);
  }

  const enabledTabs = settings?.enabledTabs;
  const source =
    enabledTabs && enabledTabs.length > 0
      ? enabledTabs.filter((tabId) => Boolean(tabId?.trim()))
      : defaultStudentEnabledTabIds();
  return withStudentLockedEnabledTabs(source);
}
