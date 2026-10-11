import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useComposedQuestionBankSettings } from "./useQuestionBankSetupConfig";
import { STANDARD_MODULES_CONFIG_REGISTRY } from "@/hooks/standardModuleConfigRegistry";
import {
  getSortedFields,
  getFlatFieldsConfig,
  mergeQuestionCategories,
  type ModuleFieldDef,
  type ModuleCustomField,
  type QuestionBankSettings,
  type QuestionCategory,
  type QuestionCategoryRef,
  type QuestionSourceBook,
  type QuestionDifficulty,
  type QuestionType,
} from "@mms/shared";
import { useQuestionBankLabels } from "./useQuestionBankLabels";

export interface QuestionBankConfig {
  settings: QuestionBankSettings;
  categories: QuestionCategory[];
  sourceBooks: QuestionSourceBook[];
  orderedFields: ModuleFieldDef[];
  enabledDifficulties: QuestionDifficulty[];
  enabledQuestionTypes: QuestionType[];
  defaultTestDuration: number;
  aiGrading: boolean;
  isFieldEnabled: (fieldId: string) => boolean;
  fieldLabel: (fieldId: string, fallback?: string) => string;
  typeLabel: (typeId: string) => string;
  difficultyLabel: (difficultyId: string) => string;
  questionLanguageLabel: (languageCode: string) => string;
  updateSettings: (settingsDraft: QuestionBankSettings) => void;
  updateSettingsAsync: (settingsDraft: QuestionBankSettings) => Promise<void>;
}

export function useQuestionBankConfig(
  questions?: readonly QuestionCategoryRef[],
): QuestionBankConfig {
  const { t } = useTranslation();
  const { fieldLabel, typeLabel, difficultyLabel, questionLanguageLabel } =
    useQuestionBankLabels(t);

  const registry = STANDARD_MODULES_CONFIG_REGISTRY["question-bank"];
  const { data: settings, updateAsync } = useComposedQuestionBankSettings();

  const defaultSettings = registry.defaultSettings as QuestionBankSettings;
  const defaultFieldDefs = registry.defaultFieldDefs;

  const updateSettingsAsync = useCallback(
    async (settingsDraft: QuestionBankSettings) => {
      await updateAsync(settingsDraft);
    },
    [updateAsync],
  );

  const updateSettings = (settingsDraft: QuestionBankSettings) => {
    // Fire-and-forget for local updates
    updateSettingsAsync(settingsDraft).catch((error) =>
      reportClientError(error, { context: "questionBank.updateSettings" }),
    );
  };

  const fields = (() => getFlatFieldsConfig(settings.fields))();
  const customFields = (() => (settings.customFields || []) as ModuleCustomField[])();
  const fieldOrder = (() => settings.fieldOrder ?? defaultSettings.fieldOrder ?? [])();

  const orderedFields = (() =>
    getSortedFields(defaultFieldDefs, fieldOrder, fields, customFields))();

  const isFieldEnabled = (fieldId: string): boolean => fields[fieldId]?.enabled !== false;

  const enabledDifficulties = (() =>
    (settings.difficultyLevels ?? []).filter((entry) => entry.enabled).map((entry) => entry.id))();

  const enabledQuestionTypes = (() =>
    (settings.questionTypes ?? []).filter((entry) => entry.enabled).map((entry) => entry.id))();

  const categories = (() => mergeQuestionCategories(settings.categories, questions))();

  const sourceBooks = (() => settings.sourceBooks ?? [])();

  return {
    settings,
    categories,
    sourceBooks,
    orderedFields,
    enabledDifficulties,
    enabledQuestionTypes,
    defaultTestDuration: settings.defaultTestDuration ?? 30,
    aiGrading: settings.aiGrading ?? false,
    isFieldEnabled,
    fieldLabel,
    typeLabel,
    difficultyLabel,
    questionLanguageLabel,
    updateSettings,
    updateSettingsAsync,
  };
}
