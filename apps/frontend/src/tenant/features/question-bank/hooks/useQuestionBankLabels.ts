import { QUESTION_BANK_FIELD_LABEL_KEYS, type AppTranslationKey } from "@mms/shared";

export function useQuestionBankLabels(
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
) {
  const fieldLabel = (fieldId: string, fallback?: string): string => {
    const key = QUESTION_BANK_FIELD_LABEL_KEYS[fieldId];
    return key ? t(key) : (fallback ?? fieldId);
  };

  const typeLabel = (typeId: string): string =>
    t(`questionBank.type.${typeId}` as AppTranslationKey);

  const difficultyLabel = (difficultyId: string): string =>
    t(`questionBank.difficulty.${difficultyId}` as AppTranslationKey);

  const questionLanguageLabel = (languageCode: string): string =>
    t(`questionBank.language.${languageCode}` as AppTranslationKey);

  return {
    fieldLabel,
    typeLabel,
    difficultyLabel,
    questionLanguageLabel,
  };
}
