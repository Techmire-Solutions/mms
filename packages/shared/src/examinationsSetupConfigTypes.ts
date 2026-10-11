import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import {
  DEFAULT_EXAMINATIONS_SETTINGS,
  type ExaminationsSettings,
} from "./examinationsModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";
import {
  EXAMINATIONS_TAB_REGISTRY,
  INITIAL_EXAMINATIONS_FIELD_SEED,
} from "./moduleFieldSetupAcademic.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";

/** Deep clone {@link INITIAL_EXAMINATIONS_FIELD_SEED} for default and Setup states. */
export function cloneExaminationFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_EXAMINATIONS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isExaminationSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_EXAMINATIONS_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Examinations. */
export function isExaminationSeedFormTab(tabKey: string): boolean {
  return EXAMINATIONS_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Info tab). */
export function isExaminationLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Examinations `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_EXAMINATIONS_FIELD_SEED}.
 */
export function resolveExaminationFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneExaminationFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneExaminationFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_EXAMINATIONS_FIELD_SEED)) {
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
  const tabbed = cloneExaminationFieldSeed();
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

/** PUT /api/examinations/preferences — examinations prefs only. */
export const examinationsPreferencesPutBodySchema = z
  .object({
    passMark: z.string().optional(),
    maxMark: z.string().optional(),
    gradingSystem: z.string().optional(),
    showRankings: z.boolean().optional(),
    allowRetake: z.boolean().optional(),
    autoPublishResults: z.boolean().optional(),
    notifyOnResult: z.boolean().optional(),
    certificateTemplate: z.string().optional(),
    aiGrading: z.boolean().optional(),
    distinguishHonours: z.boolean().optional(),
    examReminders: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

/** Typed preference state extracted from legacy ExaminationsSettings. */
export interface ExaminationsModulePreferences {
  passMark: string;
  maxMark: string;
  gradingSystem: string;
  showRankings: boolean;
  allowRetake: boolean;
  autoPublishResults: boolean;
  notifyOnResult: boolean;
  certificateTemplate: string;
  aiGrading: boolean;
  distinguishHonours: boolean;
  examReminders: boolean;
  defaultViewLayout: string;
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeExaminationsModulePreferences(
  raw: unknown,
): ExaminationsModulePreferences {
  if (!raw || typeof raw !== "object") {
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
      defaultViewLayout: DEFAULT_EXAMINATIONS_SETTINGS.defaultViewLayout || "list",
    };
  }

  const prefs = raw as Partial<ExaminationsModulePreferences>;
  return {
    passMark:
      typeof prefs.passMark === "string" ? prefs.passMark : DEFAULT_EXAMINATIONS_SETTINGS.passMark,
    maxMark:
      typeof prefs.maxMark === "string" ? prefs.maxMark : DEFAULT_EXAMINATIONS_SETTINGS.maxMark,
    gradingSystem:
      typeof prefs.gradingSystem === "string"
        ? prefs.gradingSystem
        : DEFAULT_EXAMINATIONS_SETTINGS.gradingSystem,
    showRankings:
      typeof prefs.showRankings === "boolean"
        ? prefs.showRankings
        : DEFAULT_EXAMINATIONS_SETTINGS.showRankings,
    allowRetake:
      typeof prefs.allowRetake === "boolean"
        ? prefs.allowRetake
        : DEFAULT_EXAMINATIONS_SETTINGS.allowRetake,
    autoPublishResults:
      typeof prefs.autoPublishResults === "boolean"
        ? prefs.autoPublishResults
        : DEFAULT_EXAMINATIONS_SETTINGS.autoPublishResults,
    notifyOnResult:
      typeof prefs.notifyOnResult === "boolean"
        ? prefs.notifyOnResult
        : DEFAULT_EXAMINATIONS_SETTINGS.notifyOnResult,
    certificateTemplate:
      typeof prefs.certificateTemplate === "string"
        ? prefs.certificateTemplate
        : DEFAULT_EXAMINATIONS_SETTINGS.certificateTemplate,
    aiGrading:
      typeof prefs.aiGrading === "boolean"
        ? prefs.aiGrading
        : DEFAULT_EXAMINATIONS_SETTINGS.aiGrading,
    distinguishHonours:
      typeof prefs.distinguishHonours === "boolean"
        ? prefs.distinguishHonours
        : DEFAULT_EXAMINATIONS_SETTINGS.distinguishHonours,
    examReminders:
      typeof prefs.examReminders === "boolean"
        ? prefs.examReminders
        : DEFAULT_EXAMINATIONS_SETTINGS.examReminders,
    defaultViewLayout:
      typeof prefs.defaultViewLayout === "string"
        ? prefs.defaultViewLayout
        : DEFAULT_EXAMINATIONS_SETTINGS.defaultViewLayout || "list",
  };
}

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
