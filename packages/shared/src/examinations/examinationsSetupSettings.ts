/** Examinations settings composition: field-config schema, normalize/compose/strip, tab merge. */
import { z } from "zod";
import type { TabDefinition } from "../contacts/contactTypes.js";
import {
  DEFAULT_EXAMINATIONS_SETTINGS,
  type ExaminationsSettings,
} from "./examinationsModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import { EXAMINATIONS_TAB_REGISTRY } from "../settings/moduleFieldSetupAcademic.js";
import { resolveExaminationFieldsMap } from "./examinationsSetupFields.js";
import type { ExaminationsModulePreferences } from "./examinationsSetupPreferences.js";

/** PUT /api/examinations/field-config — field registry JSON without prefs keys. */
const examinationsFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
    fieldOrder: z.array(z.string()).optional(),
    formTabs: z.array(z.record(z.string(), z.unknown())).optional(),
    enabledTabs: z.array(z.string()).optional(),
    requiredTabs: z.array(z.string()).optional(),
  })
  .strict();

export const examinationsFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, examinationsFieldConfigPutBodyBaseSchema);

/** Extracts field-config slice from a raw composed settings blob. */
export function normalizeExaminationsSettings(raw: unknown): ExaminationsSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_EXAMINATIONS_SETTINGS };
  }

  const safe = raw as Partial<ExaminationsSettings>;
  return {
    passMark: DEFAULT_EXAMINATIONS_SETTINGS.passMark,
    maxMark: DEFAULT_EXAMINATIONS_SETTINGS.maxMark,
    gradingSystem: DEFAULT_EXAMINATIONS_SETTINGS.gradingSystem,
    showRankings: DEFAULT_EXAMINATIONS_SETTINGS.showRankings,
    allowRetake: DEFAULT_EXAMINATIONS_SETTINGS.allowRetake,
    autoPublishResults: DEFAULT_EXAMINATIONS_SETTINGS.autoPublishResults,
    notifyOnResult: DEFAULT_EXAMINATIONS_SETTINGS.notifyOnResult,
    certificateTemplate: DEFAULT_EXAMINATIONS_SETTINGS.certificateTemplate,
    aiGrading: DEFAULT_EXAMINATIONS_SETTINGS.aiGrading,
    distinguishHonours: DEFAULT_EXAMINATIONS_SETTINGS.distinguishHonours,
    examReminders: DEFAULT_EXAMINATIONS_SETTINGS.examReminders,
    defaultViewLayout: DEFAULT_EXAMINATIONS_SETTINGS.defaultViewLayout,
    fields: resolveExaminationFieldsMap(
      safe.fields && typeof safe.fields === "object" && !Array.isArray(safe.fields)
        ? (safe.fields as Record<string, unknown>)
        : undefined,
    ),
    customFields: safe.customFields ?? DEFAULT_EXAMINATIONS_SETTINGS.customFields ?? [],
    fieldOrder: safe.fieldOrder ?? DEFAULT_EXAMINATIONS_SETTINGS.fieldOrder ?? [],
    formTabs: safe.formTabs,
    enabledTabs: safe.enabledTabs,
    requiredTabs: safe.requiredTabs,
  };
}

/** Recomposes preferences and field-config into the legacy flat settings shape. */
export function composeExaminationsSettings(
  fieldConfig: ExaminationsSettings | null,
  prefs: ExaminationsModulePreferences,
  formTabs?: TabDefinition[],
): ExaminationsSettings {
  return {
    ...(fieldConfig ?? DEFAULT_EXAMINATIONS_SETTINGS),
    passMark: prefs.passMark,
    maxMark: prefs.maxMark,
    gradingSystem: prefs.gradingSystem,
    showRankings: prefs.showRankings,
    allowRetake: prefs.allowRetake,
    autoPublishResults: prefs.autoPublishResults,
    notifyOnResult: prefs.notifyOnResult,
    certificateTemplate: prefs.certificateTemplate,
    aiGrading: prefs.aiGrading,
    distinguishHonours: prefs.distinguishHonours,
    examReminders: prefs.examReminders,
    defaultViewLayout: prefs.defaultViewLayout,
    formTabs: formTabs ?? fieldConfig?.formTabs,
  };
}

/** Drops preference keys before saving field-config to avoid overriding prefs layer. */
export function stripExaminationsFieldConfigForPersist(
  config: Partial<ExaminationsSettings>,
): Partial<ExaminationsSettings> {
  // `name: _name` aliases: the bound locals exist only to omit preference keys from the rest object.
  const {
    passMark: _passMark,
    maxMark: _maxMark,
    gradingSystem: _gradingSystem,
    showRankings: _showRankings,
    allowRetake: _allowRetake,
    autoPublishResults: _autoPublishResults,
    notifyOnResult: _notifyOnResult,
    certificateTemplate: _certificateTemplate,
    aiGrading: _aiGrading,
    distinguishHonours: _distinguishHonours,
    examReminders: _examReminders,
    defaultViewLayout: _defaultViewLayout,
    ...fieldConfigOnly
  } = config;
  return fieldConfigOnly;
}

export function mergeExaminationsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0
      ? documentFormTabs
      : [...EXAMINATIONS_TAB_REGISTRY];
  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...EXAMINATIONS_TAB_REGISTRY.filter(
            (seedTab: TabDefinition) => !apiTabs.some((apiTab) => apiTab.key === seedTab.key),
          ),
        ];
  const seenKeys = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}
