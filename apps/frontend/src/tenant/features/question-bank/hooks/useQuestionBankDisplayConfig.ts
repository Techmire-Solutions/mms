import {
  QUESTION_TYPE_ICONS,
  isQuestionSourceFieldId,
  type QuestionBankQuestion,
} from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

export function useQuestionBankDisplayConfig(config: QuestionBankConfig) {
  const difficultyConfig = (() => ({
    easy: { label: config.difficultyLabel("easy"), cls: SEMANTIC_BADGE.success },
    medium: { label: config.difficultyLabel("medium"), cls: SEMANTIC_BADGE.warning },
    hard: { label: config.difficultyLabel("hard"), cls: SEMANTIC_BADGE.destructive },
  }))() as Record<string, StatusBadgeConfigItem>;

  const typeConfig = (() =>
    Object.fromEntries(
      Object.keys(QUESTION_TYPE_ICONS).map((typeId) => [
        typeId,
        {
          label: `${QUESTION_TYPE_ICONS[typeId as keyof typeof QUESTION_TYPE_ICONS]} ${config.typeLabel(typeId)}`,
          cls: SEMANTIC_BADGE.muted,
        },
      ]),
    ))() as Record<string, StatusBadgeConfigItem>;

  return { difficultyConfig, typeConfig };
}

export function buildQuestionsListMetaFields(
  config: QuestionBankConfig,
  isColumnVisible?: (key: string) => boolean,
) {
  return config.orderedFields.filter((field) => {
    if (!config.isFieldEnabled(field.id)) return false;
    const colKey =
      field.id === "categoryId"
        ? "category"
        : field.id === "questionLanguage"
          ? "language"
          : field.id;
    return isColumnVisible ? isColumnVisible(colKey) : true;
  });
}

export function shouldShowQuestionSourceCitation(
  config: QuestionBankConfig,
  showSource: boolean,
): boolean {
  return (
    showSource &&
    config.orderedFields.some(
      (field) => isQuestionSourceFieldId(field.id) && config.isFieldEnabled(field.id),
    )
  );
}

export type { QuestionBankQuestion };
