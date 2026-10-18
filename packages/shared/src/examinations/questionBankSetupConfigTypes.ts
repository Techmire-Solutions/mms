import { z } from "zod";
import type { FieldDefinition } from "../contacts/contactTypes.js";
import {
  DEFAULT_QUESTION_BANK_SETTINGS,
  type QuestionBankSettings,
} from "./questionBankModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import {
  QUESTION_BANK_TAB_REGISTRY,
  INITIAL_QUESTION_BANK_FIELD_SEED,
} from "../settings/moduleFieldSetupAcademic.js";
import { getFlatFieldsConfig } from "../settings/moduleFieldConfigUtils.js";
import type {
  QuestionCategory,
  QuestionSourceBook,
  QuestionTypeRegistryEntry,
  QuestionDifficultyRegistryEntry,
} from "./questionBankTypes.js";

/** Deep clone {@link INITIAL_QUESTION_BANK_FIELD_SEED} for default and Setup states. */
export function cloneQuestionBankFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_QUESTION_BANK_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isQuestionBankSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_QUESTION_BANK_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Question Bank. */
export function isQuestionBankSeedFormTab(tabKey: string): boolean {
  return QUESTION_BANK_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Setup tab). */
export function isQuestionBankLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Question Bank `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_QUESTION_BANK_FIELD_SEED}.
 */
export function resolveQuestionBankFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneQuestionBankFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneQuestionBankFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_QUESTION_BANK_FIELD_SEED)) {
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
  const tabbed = cloneQuestionBankFieldSeed();
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

/** PUT /api/question-bank/config/fields — field registry JSON without prefs keys. */
const questionBankFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
    fieldOrder: z.array(z.string()).optional(),
  })
  .strict();

export const questionBankFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, questionBankFieldConfigPutBodyBaseSchema);

/** PUT /api/question-bank/config/preferences — question bank prefs only. */
export const questionBankPreferencesPutBodySchema = z
  .object({
    aiGrading: z.boolean().optional(),
    defaultTestDuration: z.number().optional(),
    categories: z.array(z.record(z.string(), z.unknown())).optional(),
    sourceBooks: z.array(z.record(z.string(), z.unknown())).optional(),
    questionTypes: z.array(z.record(z.string(), z.unknown())).optional(),
    difficultyLevels: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

/** Typed preference state extracted from legacy QuestionBankSettings. */
export interface QuestionBankModulePreferences {
  aiGrading: boolean;
  defaultTestDuration: number;
  categories: QuestionCategory[];
  sourceBooks: QuestionSourceBook[];
  questionTypes: QuestionTypeRegistryEntry[];
  difficultyLevels: QuestionDifficultyRegistryEntry[];
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeQuestionBankModulePreferences(
  raw: unknown,
): QuestionBankModulePreferences {
  if (!raw || typeof raw !== "object") {
    return {
      aiGrading: DEFAULT_QUESTION_BANK_SETTINGS.aiGrading ?? false,
      defaultTestDuration: DEFAULT_QUESTION_BANK_SETTINGS.defaultTestDuration ?? 30,
      categories: DEFAULT_QUESTION_BANK_SETTINGS.categories ?? [],
      sourceBooks: DEFAULT_QUESTION_BANK_SETTINGS.sourceBooks ?? [],
      questionTypes: DEFAULT_QUESTION_BANK_SETTINGS.questionTypes ?? [],
      difficultyLevels: DEFAULT_QUESTION_BANK_SETTINGS.difficultyLevels ?? [],
    };
  }

  const prefs = raw as Partial<QuestionBankSettings>;
  return {
    aiGrading:
      typeof prefs.aiGrading === "boolean"
        ? prefs.aiGrading
        : (DEFAULT_QUESTION_BANK_SETTINGS.aiGrading ?? false),
    defaultTestDuration:
      typeof prefs.defaultTestDuration === "number"
        ? prefs.defaultTestDuration
        : (DEFAULT_QUESTION_BANK_SETTINGS.defaultTestDuration ?? 30),
    categories: Array.isArray(prefs.categories)
      ? prefs.categories
      : (DEFAULT_QUESTION_BANK_SETTINGS.categories ?? []),
    sourceBooks: Array.isArray(prefs.sourceBooks)
      ? prefs.sourceBooks
      : (DEFAULT_QUESTION_BANK_SETTINGS.sourceBooks ?? []),
    questionTypes: Array.isArray(prefs.questionTypes)
      ? prefs.questionTypes
      : (DEFAULT_QUESTION_BANK_SETTINGS.questionTypes ?? []),
    difficultyLevels: Array.isArray(prefs.difficultyLevels)
      ? prefs.difficultyLevels
      : (DEFAULT_QUESTION_BANK_SETTINGS.difficultyLevels ?? []),
  };
}

/** Extracts field-config slice from a raw composed settings blob. */
export function normalizeQuestionBankFieldConfigOnly(raw: unknown): QuestionBankSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_QUESTION_BANK_SETTINGS };
  }

  const safe = raw as Partial<QuestionBankSettings>;
  return {
    aiGrading: DEFAULT_QUESTION_BANK_SETTINGS.aiGrading ?? false,
    defaultTestDuration: DEFAULT_QUESTION_BANK_SETTINGS.defaultTestDuration ?? 30,
    categories: DEFAULT_QUESTION_BANK_SETTINGS.categories ?? [],
    fields: resolveQuestionBankFieldsMap(
      safe.fields && typeof safe.fields === "object" && !Array.isArray(safe.fields)
        ? (safe.fields as Record<string, unknown>)
        : undefined,
    ),
    customFields: safe.customFields ?? DEFAULT_QUESTION_BANK_SETTINGS.customFields ?? [],
    fieldOrder: safe.fieldOrder ?? DEFAULT_QUESTION_BANK_SETTINGS.fieldOrder ?? [],
  };
}

/** Recomposes preferences and field-config into the legacy flat settings shape. */
export function composeQuestionBankSettings(
  fieldConfig: QuestionBankSettings | null,
  prefs: QuestionBankModulePreferences,
): QuestionBankSettings {
  return {
    ...(fieldConfig ?? DEFAULT_QUESTION_BANK_SETTINGS),
    aiGrading: prefs.aiGrading,
    defaultTestDuration: prefs.defaultTestDuration,
    categories: prefs.categories,
    sourceBooks: prefs.sourceBooks,
    questionTypes: prefs.questionTypes,
    difficultyLevels: prefs.difficultyLevels,
  };
}

/** Drops preference keys before saving field-config to avoid overriding prefs layer. */
export function stripQuestionBankFieldConfigForPersist(
  config: Partial<QuestionBankSettings>,
): Partial<QuestionBankSettings> {
  // `_`-prefixed names omit preference keys from the rest object (ESLint-clean, no behavior change).
  const {
    aiGrading: _aiGrading,
    defaultTestDuration: _defaultTestDuration,
    categories: _categories,
    sourceBooks: _sourceBooks,
    questionTypes: _questionTypes,
    difficultyLevels: _difficultyLevels,
    ...fieldConfigOnly
  } = config;
  return fieldConfigOnly;
}
