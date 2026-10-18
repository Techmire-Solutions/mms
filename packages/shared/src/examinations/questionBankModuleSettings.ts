import type { TabDefinition, FieldDefinition } from "../contacts/contactTypes.js";
import { INITIAL_QUESTION_BANK_FIELD_SEED } from "../settings/moduleFieldSetupDefaults.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import {
  DEFAULT_QUESTION_CATEGORIES,
  DEFAULT_QUESTION_SOURCE_BOOKS,
  QUESTION_DIFFICULTY_IDS,
  QUESTION_SOURCE_FIELD_IDS,
  QUESTION_TYPE_IDS,
} from "./questionBankTypes.js";

// ─── Question Bank Module Settings ────────────────────────────────────────────

export interface QuestionBankSettings {
  aiGrading: boolean;
  defaultTestDuration: number;
  categories: import("./questionBankTypes.js").QuestionCategory[];
  sourceBooks?: import("./questionBankTypes.js").QuestionSourceBook[];
  questionTypes?: import("./questionBankTypes.js").QuestionTypeRegistryEntry[];
  difficultyLevels?: import("./questionBankTypes.js").QuestionDifficultyRegistryEntry[];
  defaultViewLayout?: string;
  fields?: Record<string, unknown>;
  customFields?: [];
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

export const DEFAULT_QUESTION_BANK_SETTINGS: QuestionBankSettings = {
  aiGrading: false,
  defaultTestDuration: 30,
  categories: [],
  sourceBooks: [],
  questionTypes: [
    { id: "mcq", enabled: true },
    { id: "true_false", enabled: true },
    { id: "short", enabled: true },
    { id: "fill_blank", enabled: true },
    { id: "matching", enabled: true },
    { id: "numeric", enabled: true },
    { id: "ordering", enabled: true },
  ],
  difficultyLevels: [
    { id: "easy", enabled: true },
    { id: "medium", enabled: true },
    { id: "hard", enabled: true },
  ],
  defaultViewLayout: "list",
  fields: {
    basic: INITIAL_QUESTION_BANK_FIELD_SEED.basic.map((f) => ({ ...f })),
    options: INITIAL_QUESTION_BANK_FIELD_SEED.options.map((f) => ({ ...f })),
  },
  fieldOrder: [
    "text",
    "categoryId",
    "questionLanguage",
    "type",
    "difficulty",
    "options",
    "answer",
    ...QUESTION_SOURCE_FIELD_IDS,
  ],
};

export const DEFAULT_QUESTION_BANK_FIELD_DEFS: ModuleFieldDef[] = [
  { id: "text", label: "Question text", type: "textarea", required: true },
  { id: "categoryId", label: "Category", type: "select", required: true },
  { id: "questionLanguage", label: "Question language", type: "select", required: true },
  { id: "type", label: "Question type", type: "select", required: true },
  { id: "difficulty", label: "Difficulty", type: "select", required: true },
  { id: "options", label: "Options", type: "options" },
  { id: "answer", label: "Answer", type: "answer" },
  { id: "sourceBookName", label: "Book name", type: "text" },
  { id: "sourceSeries", label: "Book series", type: "text" },
  { id: "sourceBookVolume", label: "Book volume", type: "text" },
  { id: "sourceVolumePart", label: "Volume part", type: "text" },
  { id: "sourceEdition", label: "Edition", type: "text" },
  { id: "sourceIsbn", label: "ISBN", type: "text" },
  { id: "sourceAuthor", label: "Author", type: "text" },
  { id: "sourceEditor", label: "Editor", type: "text" },
  { id: "sourceTranslator", label: "Translator", type: "text" },
  { id: "sourcePublisher", label: "Publisher", type: "text" },
  { id: "sourceCityOfPublication", label: "City of publication", type: "text" },
  { id: "sourcePublishDate", label: "Publishing date", type: "date" },
  { id: "sourceYearHijri", label: "Hijri year", type: "text" },
  { id: "sourceLanguage", label: "Source language", type: "text" },
  { id: "sourceChapter", label: "Chapter / section", type: "text" },
  { id: "sourcePageNumber", label: "Page number", type: "text" },
  { id: "sourceParagraph", label: "Paragraph", type: "text" },
  { id: "sourceFootnote", label: "Footnote", type: "text" },
  { id: "sourceSurah", label: "Surah", type: "text" },
  { id: "sourceAyah", label: "Ayah / verse", type: "text" },
  { id: "sourceJuz", label: "Juz", type: "text" },
  { id: "sourceHizb", label: "Hizb / rub", type: "text" },
  { id: "sourceHadithCollection", label: "Hadith collection", type: "text" },
  { id: "sourceHadithNumber", label: "Hadith number", type: "text" },
  { id: "sourceManuscript", label: "Manuscript", type: "text" },
  { id: "sourceCatalogNumber", label: "Catalog / shelf number", type: "text" },
  { id: "sourceQuote", label: "Quoted excerpt", type: "textarea" },
  { id: "sourceNotes", label: "Source notes", type: "textarea" },
];

function isTabbedQuestionBankFields(fields: Record<string, unknown> | undefined): boolean {
  if (!fields) return false;
  return Object.values(fields).some(Array.isArray);
}

function questionBankFieldTypeForEditor(
  type: ModuleFieldDef["type"] | undefined,
): FieldDefinition["type"] {
  if (type === "textarea") return "textarea";
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "select") return "select";
  if (type === "boolean") return "boolean";
  return "text";
}

function readQuestionBankFlatFieldConfig(
  storedFields: Record<string, unknown> | undefined,
): Record<string, { enabled: boolean; required: boolean }> {
  const result: Record<string, { enabled: boolean; required: boolean }> = {};
  const fields = {
    ...(DEFAULT_QUESTION_BANK_SETTINGS.fields ?? {}),
    ...(storedFields ?? {}),
  };
  for (const [fieldId, config] of Object.entries(fields)) {
    if (config && typeof config === "object" && !Array.isArray(config)) {
      result[fieldId] = {
        enabled: (config as { enabled?: boolean }).enabled !== false,
        required: !!(config as { required?: boolean }).required,
      };
    }
  }
  return result;
}

function normalizeQuestionBankFieldsForEditor(
  storedFields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (isTabbedQuestionBankFields(storedFields)) {
    const normalized: Record<string, FieldDefinition[]> = {};
    for (const [tabId, tabFields] of Object.entries(storedFields ?? {})) {
      normalized[tabId] = Array.isArray(tabFields) ? tabFields : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_QUESTION_BANK_FIELD_SEED)) {
      const current = normalized[tabId] ?? [];
      const currentKeys = new Set(current.map((field) => field.key));
      normalized[tabId] = [
        ...current,
        ...seedFields.filter((field) => !currentKeys.has(field.key)),
      ];
    }
    return normalized;
  }

  const flatConfig = readQuestionBankFlatFieldConfig(storedFields);
  const normalized: Record<string, FieldDefinition[]> = {};
  const assignedKeys = new Set<string>();

  for (const [tabId, seedFields] of Object.entries(INITIAL_QUESTION_BANK_FIELD_SEED)) {
    normalized[tabId] = seedFields.map((field) => {
      assignedKeys.add(field.key);
      const config = flatConfig[field.key];
      return {
        ...field,
        enabled: config?.enabled ?? field.enabled,
        required: config?.required ?? field.required,
      };
    });
  }

  const fieldDefById = new Map(DEFAULT_QUESTION_BANK_FIELD_DEFS.map((field) => [field.id, field]));
  for (const [fieldId, config] of Object.entries(flatConfig)) {
    if (assignedKeys.has(fieldId)) continue;
    const fieldDef = fieldDefById.get(fieldId);
    normalized.options = [
      ...(normalized.options ?? []),
      {
        key: fieldId,
        label: fieldDef?.label ?? fieldId,
        type: questionBankFieldTypeForEditor(fieldDef?.type),
        enabled: config.enabled,
        required: config.required,
        order: normalized.options?.length ?? 0,
      },
    ];
  }

  for (const fieldId of QUESTION_SOURCE_FIELD_IDS) {
    if (assignedKeys.has(fieldId)) continue;
    const fieldDef = fieldDefById.get(fieldId);
    normalized.options = [
      ...(normalized.options ?? []),
      {
        key: fieldId,
        label: fieldDef?.label ?? fieldId,
        type: questionBankFieldTypeForEditor(fieldDef?.type),
        enabled: (storedFields?.[fieldId] as { enabled?: boolean } | undefined)?.enabled ?? true,
        required:
          (storedFields?.[fieldId] as { required?: boolean } | undefined)?.required ?? false,
        order: normalized.options?.length ?? 0,
      },
    ];
    assignedKeys.add(fieldId);
  }

  return normalized;
}

/**
 * Merges stored question-bank settings with defaults (categories, type/difficulty registries).
 */
export function normalizeQuestionBankSettings(
  stored?: Partial<QuestionBankSettings> | null,
): QuestionBankSettings {
  const merged: QuestionBankSettings = {
    ...DEFAULT_QUESTION_BANK_SETTINGS,
    ...(stored ?? {}),
  };

  merged.categories =
    stored?.categories && stored.categories.length > 0
      ? stored.categories
      : DEFAULT_QUESTION_CATEGORIES;

  merged.sourceBooks =
    stored?.sourceBooks && stored.sourceBooks.length > 0
      ? stored.sourceBooks
      : DEFAULT_QUESTION_SOURCE_BOOKS;

  const typeById = new Map(
    (stored?.questionTypes ?? []).map((questionType) => [questionType.id, questionType]),
  );
  merged.questionTypes = QUESTION_TYPE_IDS.map((questionTypeId) => ({
    id: questionTypeId,
    enabled: typeById.get(questionTypeId)?.enabled ?? true,
  }));

  const diffById = new Map(
    (stored?.difficultyLevels ?? []).map((difficultyLevel) => [
      difficultyLevel.id,
      difficultyLevel,
    ]),
  );
  merged.difficultyLevels = QUESTION_DIFFICULTY_IDS.map((difficultyLevelId) => ({
    id: difficultyLevelId,
    enabled: diffById.get(difficultyLevelId)?.enabled ?? true,
  }));

  merged.fields = normalizeQuestionBankFieldsForEditor(stored?.fields);
  const defaultOrder = DEFAULT_QUESTION_BANK_SETTINGS.fieldOrder ?? [];
  const storedOrder =
    stored?.fieldOrder && stored.fieldOrder.length > 0 ? stored.fieldOrder : defaultOrder;
  const storedOrderSet = new Set(storedOrder);
  const missingSource = QUESTION_SOURCE_FIELD_IDS.filter(
    (sourceFieldId) => !storedOrderSet.has(sourceFieldId),
  );
  merged.fieldOrder = [...storedOrder, ...missingSource];

  return merged;
}
